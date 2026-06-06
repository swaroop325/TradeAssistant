import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const dynamo = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});
const bedrock = new BedrockRuntimeClient({});
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;
const ALERTS_TABLE = process.env.ALERTS_TABLE!;
const PUSH_FUNCTION = process.env.PUSH_FUNCTION || "tradeassistant-push-notify";

interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  priceOpen: number;
  priceClose: number;
  weekHigh: number;
  weekLow: number;
  weekChange: number;
  weekChangePercent: number;
  totalAlerts: number;
  alertBreakdown: { session: number; price: number; economic: number; intelligence: number };
  briefingAccuracy: string;
  keyEvents: string[];
  outlook: string;
}

export async function handler(event: any) {
  if (event.source === "aws.events") {
    return generateWeeklyReport();
  }
  return getLatestReport();
}

async function generateWeeklyReport() {
  const now = new Date();
  const weekEnd = new Date(now);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const startKey = weekStart.toISOString().split("T")[0];
  const endKey = weekEnd.toISOString().split("T")[0];

  // Get week's price data
  const priceResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": { S: "XAUUSD" },
        ":start": { S: startKey },
        ":end": { S: `${endKey}~` },
      },
      ScanIndexForward: true,
    })
  );

  const priceItems = priceResult.Items || [];
  let weekHigh = 0;
  let weekLow = Infinity;
  let priceOpen = 0;
  let priceClose = 0;

  for (const item of priceItems) {
    if (!item.data?.S) continue;
    const data = JSON.parse(item.data.S);
    if (priceOpen === 0) priceOpen = data.open || data.price;
    priceClose = data.price;
    if (data.high > weekHigh) weekHigh = data.high;
    if (data.low < weekLow && data.low > 0) weekLow = data.low;
  }

  // Fallback: use latest data if no historical
  if (priceOpen === 0) {
    const latestResult = await dynamo.send(
      new QueryCommand({
        TableName: MARKET_DATA_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: "LATEST#XAUUSD" } },
        Limit: 1,
      })
    );
    const latest = latestResult.Items?.[0];
    if (latest?.data?.S) {
      const data = JSON.parse(latest.data.S);
      priceOpen = data.open || data.previousClose || data.price;
      priceClose = data.price;
      weekHigh = data.high;
      weekLow = data.low;
    }
  }

  if (weekLow === Infinity) weekLow = 0;
  const weekChange = priceClose - priceOpen;
  const weekChangePercent = priceOpen > 0 ? (weekChange / priceOpen) * 100 : 0;

  // Count alerts this week
  const alertsResult = await dynamo.send(
    new QueryCommand({
      TableName: ALERTS_TABLE,
      KeyConditionExpression: "pk = :pk AND sk >= :start",
      ExpressionAttributeValues: {
        ":pk": { S: "ALERT" },
        ":start": { S: weekStart.toISOString() },
      },
    })
  );

  const alerts = alertsResult.Items || [];
  const alertBreakdown = { session: 0, price: 0, economic: 0, intelligence: 0 };
  for (const alert of alerts) {
    const cat = alert.category?.S as keyof typeof alertBreakdown;
    if (cat && cat in alertBreakdown) alertBreakdown[cat]++;
  }

  // Get briefings from this week
  const briefingsResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk AND sk >= :start",
      ExpressionAttributeValues: {
        ":pk": { S: "BRIEFING" },
        ":start": { S: `morning:${startKey}` },
      },
    })
  );

  const briefings = briefingsResult.Items || [];
  let correctBias = 0;
  let totalBriefings = 0;
  for (const b of briefings) {
    if (!b.data?.S) continue;
    const data = JSON.parse(b.data.S);
    totalBriefings++;
    if (
      (data.bias === "Bullish" && weekChange > 0) ||
      (data.bias === "Bearish" && weekChange < 0) ||
      (data.bias === "Neutral" && Math.abs(weekChangePercent) < 0.5)
    ) {
      correctBias++;
    }
  }

  const accuracy = totalBriefings > 0
    ? `${Math.round((correctBias / totalBriefings) * 100)}% (${correctBias}/${totalBriefings} correct)`
    : "No briefings this week";

  // Generate AI outlook
  let outlook = "";
  try {
    const prompt = `Gold (XAUUSD) weekly summary:
- Week open: ${priceOpen.toFixed(0)}, close: ${priceClose.toFixed(0)} (${weekChangePercent > 0 ? "+" : ""}${weekChangePercent.toFixed(2)}%)
- Range: ${weekLow.toFixed(0)} - ${weekHigh.toFixed(0)} (${(weekHigh - weekLow).toFixed(0)} pips)
- Total alerts fired: ${alerts.length}

In 1-2 sentences, give a forward-looking outlook for gold next week. Be specific about levels to watch.`;

    const bedrockResponse = await bedrock.send(
      new InvokeModelCommand({
        modelId: "apac.amazon.nova-micro-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [{ role: "user", content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 150, temperature: 0.4 },
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    outlook = responseBody.output?.message?.content?.[0]?.text || "";
  } catch (err) {
    console.error("Bedrock outlook failed:", err);
    outlook = weekChange > 0
      ? `Bullish momentum may continue. Watch resistance at ${weekHigh.toFixed(0)}.`
      : `Bearish pressure persists. Support at ${weekLow.toFixed(0)} is key.`;
  }

  const report: WeeklyReport = {
    weekStart: startKey,
    weekEnd: endKey,
    priceOpen,
    priceClose,
    weekHigh,
    weekLow,
    weekChange,
    weekChangePercent,
    totalAlerts: alerts.length,
    alertBreakdown,
    briefingAccuracy: accuracy,
    keyEvents: alerts.slice(0, 5).map((a) => a.title?.S || ""),
    outlook,
  };

  // Store report
  await dynamo.send(
    new PutItemCommand({
      TableName: MARKET_DATA_TABLE,
      Item: {
        pk: { S: "REPORT" },
        sk: { S: `weekly:${endKey}` },
        data: { S: JSON.stringify(report) },
        createdAt: { S: now.toISOString() },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 86400 * 30) },
      },
    })
  );

  // Send push notification with weekly summary
  const pushBody = [
    `${weekChangePercent > 0 ? "+" : ""}${weekChangePercent.toFixed(1)}% (${priceOpen.toFixed(0)} → ${priceClose.toFixed(0)})`,
    `Range: ${weekLow.toFixed(0)}-${weekHigh.toFixed(0)}`,
    `Alerts: ${alerts.length} | Briefing accuracy: ${accuracy}`,
  ].join("\n");

  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: PUSH_FUNCTION,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({
          httpMethod: "POST",
          path: "/send",
          body: JSON.stringify({
            title: `Weekly Report: Gold ${weekChange > 0 ? "Up" : "Down"} ${Math.abs(weekChangePercent).toFixed(1)}%`,
            message: pushBody,
            tag: "briefing",
          }),
        })),
      })
    );
  } catch (pushErr) {
    console.error("Weekly report push failed:", pushErr);
  }

  console.log(`Weekly report generated: ${weekChangePercent.toFixed(2)}%`);
  return { statusCode: 200, body: JSON.stringify(report) };
}

async function getLatestReport() {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "REPORT" } },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item?.data?.S) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "No report available" }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: item.data.S,
  };
}
