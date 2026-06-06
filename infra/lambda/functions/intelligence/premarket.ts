import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const dynamo = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});
const bedrock = new BedrockRuntimeClient({});
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;
const PUSH_FUNCTION = process.env.PUSH_FUNCTION || "tradeassistant-push-notify";

export async function handler() {
  const latestResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "LATEST#XAUUSD" } },
      Limit: 1,
    })
  );

  const latestItem = latestResult.Items?.[0];
  const marketData = latestItem?.data?.S ? JSON.parse(latestItem.data.S) : null;

  // Get upcoming events
  const eventsResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: {
        ":pk": { S: "EVENTS" },
        ":sk": { S: "calendar" },
      },
      Limit: 1,
    })
  );

  const events = eventsResult.Items?.[0]?.data?.S
    ? JSON.parse(eventsResult.Items[0].data.S)
    : [];

  const highImpactEvents = events
    .filter((e: any) => e.impact === "high" || e.impact === "critical")
    .slice(0, 3)
    .map((e: any) => e.name);

  let outlook = "";
  try {
    const prompt = `Gold (XAUUSD) pre-market Sunday night brief for a trader about to sleep before Monday open.
${marketData ? `Last close: ${marketData.price}, week change: ${marketData.changePercent > 0 ? "+" : ""}${marketData.changePercent.toFixed(2)}%, high: ${marketData.high}, low: ${marketData.low}` : "No data available."}
${highImpactEvents.length > 0 ? `Key events this week: ${highImpactEvents.join(", ")}` : "No major events scheduled."}

In 2-3 short sentences, give an overnight outlook: what to expect at Asia open, key levels to watch, and any gap risk. Be specific with price levels.`;

    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: "apac.amazon.nova-micro-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [{ role: "user", content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 200, temperature: 0.4 },
        }),
      })
    );

    const body = JSON.parse(new TextDecoder().decode(response.body));
    outlook = body.output?.message?.content?.[0]?.text || "";
  } catch (err) {
    console.error("Bedrock pre-market failed:", err);
    if (marketData) {
      const dir = marketData.changePercent > 0 ? "bullish" : "bearish";
      outlook = `Closed ${dir} at ${marketData.price.toFixed(0)}. Watch ${marketData.low.toFixed(0)} support and ${marketData.high.toFixed(0)} resistance at Asia open.`;
    } else {
      outlook = "Market opens in ~4 hours. Check levels on open.";
    }
  }

  const title = "Market Opens Tonight";
  const lines: string[] = [];
  if (marketData) {
    lines.push(`Last: $${marketData.price.toFixed(0)} (${marketData.changePercent > 0 ? "+" : ""}${marketData.changePercent.toFixed(1)}%)`);
  }
  if (highImpactEvents.length > 0) {
    lines.push(`This week: ${highImpactEvents.join(", ")}`);
  }
  lines.push(outlook);

  const message = lines.join("\n");

  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: PUSH_FUNCTION,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({
          httpMethod: "POST",
          path: "/send",
          body: JSON.stringify({ title, message, tag: "briefing" }),
        })),
      })
    );
  } catch (err) {
    console.error("Pre-market push failed:", err);
  }

  console.log("Pre-market notification sent");
  return { statusCode: 200, body: JSON.stringify({ title, message }) };
}
