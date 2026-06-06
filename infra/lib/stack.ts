import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

export class TradeAssistantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const credentialsTable = new dynamodb.Table(this, "Credentials", {
      tableName: "tradeassistant-credentials",
      partitionKey: { name: "credentialId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: "ttl",
    });

    credentialsTable.addGlobalSecondaryIndex({
      indexName: "userId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
    });

    const alertsTable = new dynamodb.Table(this, "Alerts", {
      tableName: "tradeassistant-alerts",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    const subscriptionsTable = new dynamodb.Table(this, "Subscriptions", {
      tableName: "tradeassistant-subscriptions",
      partitionKey: { name: "endpoint", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const marketDataTable = new dynamodb.Table(this, "MarketData", {
      tableName: "tradeassistant-market-data",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // Lambda Functions
    const FUNCTIONS_DIR = path.join(__dirname, "../lambda/functions");
    const defaultEnv = {
      CREDENTIALS_TABLE: credentialsTable.tableName,
      ALERTS_TABLE: alertsTable.tableName,
      SUBSCRIPTIONS_TABLE: subscriptionsTable.tableName,
      MARKET_DATA_TABLE: marketDataTable.tableName,
      REGION: cdk.Aws.REGION,
    };
    const nodejsProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: defaultEnv,
      bundling: { minify: true, sourceMap: false },
    };

    // Auth Lambdas
    const authRegisterFn = new NodejsFunction(this, "AuthRegister", {
      ...nodejsProps,
      functionName: "tradeassistant-auth-register",
      entry: path.join(FUNCTIONS_DIR, "auth/register.ts"),
    });

    const authLoginFn = new NodejsFunction(this, "AuthLogin", {
      ...nodejsProps,
      functionName: "tradeassistant-auth-login",
      entry: path.join(FUNCTIONS_DIR, "auth/login.ts"),
    });

    credentialsTable.grantReadWriteData(authRegisterFn);
    credentialsTable.grantReadWriteData(authLoginFn);

    // Market Data Lambda (Yahoo Finance - no API key needed)
    const marketDataFn = new NodejsFunction(this, "MarketDataFn", {
      ...nodejsProps,
      functionName: "tradeassistant-market-data",
      entry: path.join(FUNCTIONS_DIR, "market/data.ts"),
    });

    marketDataTable.grantReadWriteData(marketDataFn);

    // Market Score Lambda
    const marketScoreFn = new NodejsFunction(this, "MarketScore", {
      ...nodejsProps,
      functionName: "tradeassistant-market-score",
      entry: path.join(FUNCTIONS_DIR, "market/score.ts"),
    });

    marketDataTable.grantReadData(marketScoreFn);

    // Economic Calendar Lambda
    const marketEventsFn = new NodejsFunction(this, "MarketEvents", {
      ...nodejsProps,
      functionName: "tradeassistant-market-events",
      entry: path.join(FUNCTIONS_DIR, "market/events.ts"),
    });

    marketDataTable.grantReadWriteData(marketEventsFn);

    // Market Intelligence Lambda
    const marketIntelFn = new NodejsFunction(this, "MarketIntel", {
      ...nodejsProps,
      functionName: "tradeassistant-market-intel",
      entry: path.join(FUNCTIONS_DIR, "market/intelligence.ts"),
    });

    marketDataTable.grantReadWriteData(marketIntelFn);

    // Push Notification Lambda
    const pushNotifyFn = new NodejsFunction(this, "PushNotify", {
      ...nodejsProps,
      functionName: "tradeassistant-push-notify",
      entry: path.join(FUNCTIONS_DIR, "notifications/push.ts"),
      environment: {
        ...defaultEnv,
        VAPID_PUBLIC_KEY: "BP-X2vX3-dpA-XaMYFarXgH6Xg9Rj3GvWMX0adFFaDElVe-TRQWG9O4RNHuY6gDvKFGzhe-Eoa9ZPdqtPsrH_eQ",
        VAPID_PRIVATE_KEY: "NZostPRA9GqJSFnBx9e04rd7zaHOavizb0UOxUjXipI",
        VAPID_SUBJECT: "mailto:swaroopanand325@gmail.com",
      },
    });

    subscriptionsTable.grantReadWriteData(pushNotifyFn);

    // Alert Engine Lambda
    const alertEngineFn = new NodejsFunction(this, "AlertEngine", {
      ...nodejsProps,
      timeout: cdk.Duration.seconds(60),
      functionName: "tradeassistant-alert-engine",
      entry: path.join(FUNCTIONS_DIR, "alerts/engine.ts"),
    });

    alertsTable.grantReadWriteData(alertEngineFn);
    subscriptionsTable.grantReadData(alertEngineFn);
    marketDataTable.grantReadData(alertEngineFn);
    pushNotifyFn.grantInvoke(alertEngineFn);
    alertEngineFn.addEnvironment("PUSH_FUNCTION", pushNotifyFn.functionName);

    // Daily Briefing Lambda (uses Bedrock)
    const dailyBriefingFn = new NodejsFunction(this, "DailyBriefing", {
      ...nodejsProps,
      timeout: cdk.Duration.seconds(120),
      functionName: "tradeassistant-daily-briefing",
      entry: path.join(FUNCTIONS_DIR, "intelligence/briefing.ts"),
    });

    dailyBriefingFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    marketDataTable.grantReadWriteData(dailyBriefingFn);
    alertsTable.grantReadWriteData(dailyBriefingFn);

    // API Gateway
    const api = new apigateway.RestApi(this, "Api", {
      restApiName: "tradeassistant-api",
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const authResource = api.root.addResource("auth");
    const registerResource = authResource.addResource("register");
    registerResource
      .addResource("options")
      .addMethod("POST", new apigateway.LambdaIntegration(authRegisterFn));
    registerResource
      .addResource("verify")
      .addMethod("POST", new apigateway.LambdaIntegration(authRegisterFn));

    const loginResource = authResource.addResource("login");
    loginResource
      .addResource("options")
      .addMethod("POST", new apigateway.LambdaIntegration(authLoginFn));
    loginResource
      .addResource("verify")
      .addMethod("POST", new apigateway.LambdaIntegration(authLoginFn));

    const marketResource = api.root.addResource("market");
    marketResource
      .addResource("data")
      .addMethod("GET", new apigateway.LambdaIntegration(marketDataFn));
    marketResource
      .addResource("score")
      .addMethod("GET", new apigateway.LambdaIntegration(marketScoreFn));
    marketResource
      .addResource("events")
      .addMethod("GET", new apigateway.LambdaIntegration(marketEventsFn));
    marketResource
      .addResource("intelligence")
      .addMethod("GET", new apigateway.LambdaIntegration(marketIntelFn));

    const alertsResource = api.root.addResource("alerts");
    alertsResource.addMethod("GET", new apigateway.LambdaIntegration(alertEngineFn));

    const subscribeResource = api.root.addResource("subscribe");
    subscribeResource.addMethod("POST", new apigateway.LambdaIntegration(pushNotifyFn));

    const briefingResource = api.root.addResource("briefing");
    briefingResource.addMethod("GET", new apigateway.LambdaIntegration(dailyBriefingFn));

    // EventBridge Schedules
    new events.Rule(this, "MarketDataSchedule", {
      ruleName: "tradeassistant-market-data-poll",
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(marketDataFn)],
    });

    new events.Rule(this, "AlertEngineSchedule", {
      ruleName: "tradeassistant-alert-engine",
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(alertEngineFn)],
    });

    new events.Rule(this, "MarketEventsSchedule", {
      ruleName: "tradeassistant-market-events",
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(marketEventsFn)],
    });

    new events.Rule(this, "MarketIntelSchedule", {
      ruleName: "tradeassistant-market-intel",
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(marketIntelFn)],
    });

    new events.Rule(this, "DailyBriefingSchedule", {
      ruleName: "tradeassistant-daily-briefing",
      schedule: events.Schedule.cron({ hour: "23", minute: "0" }), // 07:00 SGT
      targets: [new targets.LambdaFunction(dailyBriefingFn)],
    });

    new events.Rule(this, "EveningBriefingSchedule", {
      ruleName: "tradeassistant-evening-briefing",
      schedule: events.Schedule.cron({ hour: "12", minute: "0" }), // 20:00 SGT
      targets: [new targets.LambdaFunction(dailyBriefingFn)],
    });

    // S3 + CloudFront for hosting
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `tradeassistant-site-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront Distribution URL",
    });

    new cdk.CfnOutput(this, "SiteBucketName", {
      value: siteBucket.bucketName,
      description: "S3 Bucket for static site",
    });
  }
}
