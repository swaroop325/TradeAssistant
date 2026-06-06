import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const dynamo = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({});
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;
const ALERTS_TABLE = process.env.ALERTS_TABLE!;

export async function handler(event: any) {
  if (event.source === "aws.events") {
    return generateBriefing();
  }

  return getLatestBriefing();
}

async function generateBriefing() {
  const priceResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "LATEST#XAUUSD" } },
      Limit: 1,
    })
  );

  const priceItem = priceResult.Items?.[0];
  if (!priceItem?.data?.S) {
    console.log("No market data for briefing");
    return { statusCode: 404, body: JSON.stringify({ error: "No market data" }) };
  }

  const marketData = JSON.parse(priceItem.data.S);
  const now = new Date();
  const sgtHour = parseInt(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Singapore" })
  );

  const isMorning = sgtHour < 12;
  const briefingType = isMorning ? "morning" : "evening";

  const prompt = `You are a Gold (XAUUSD) trading analyst. Generate a concise ${briefingType} briefing.

Current market data:
- Price: ${marketData.price}
- Change: ${marketData.change} (${marketData.changePercent}%)
- High: ${marketData.high}
- Low: ${marketData.low}
- Open: ${marketData.open}

Provide a JSON response with:
{
  "bias": "Bullish" | "Bearish" | "Neutral",
  "support": [3 levels],
  "resistance": [3 levels],
  "events": ["key upcoming events today"],
  "volatilityOutlook": "one sentence outlook",
  "bestWindow": "recommended trading window in SGT"
}

Be concise. Focus on actionable intelligence. Respond with only valid JSON.`;

  try {
    const bedrockResponse = await bedrock.send(
      new InvokeModelCommand({
        modelId: "apac.amazon.nova-micro-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [{ role: "user", content: [{ text: prompt }] }],
          inferenceConfig: {
            maxTokens: 500,
            temperature: 0.3,
          },
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const content = responseBody.output?.message?.content?.[0]?.text || "{}";

    let briefing;
    try {
      briefing = JSON.parse(content);
    } catch {
      briefing = generateFallbackBriefing(marketData);
    }

    await dynamo.send(
      new PutItemCommand({
        TableName: MARKET_DATA_TABLE,
        Item: {
          pk: { S: "BRIEFING" },
          sk: { S: `${briefingType}:${now.toISOString().split("T")[0]}` },
          data: { S: JSON.stringify(briefing) },
          type: { S: briefingType },
          createdAt: { S: now.toISOString() },
          ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) },
        },
      })
    );

    console.log(`${briefingType} briefing generated successfully`);
    return { statusCode: 200, body: JSON.stringify(briefing) };
  } catch (error) {
    console.error("Bedrock error, using fallback:", error);
    const fallback = generateFallbackBriefing(marketData);

    await dynamo.send(
      new PutItemCommand({
        TableName: MARKET_DATA_TABLE,
        Item: {
          pk: { S: "BRIEFING" },
          sk: { S: `${briefingType}:${now.toISOString().split("T")[0]}` },
          data: { S: JSON.stringify(fallback) },
          type: { S: briefingType },
          createdAt: { S: now.toISOString() },
          ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) },
        },
      })
    );

    return { statusCode: 200, body: JSON.stringify(fallback) };
  }
}

function generateFallbackBriefing(marketData: any) {
  const isBullish = marketData.changePercent > 0;
  const price = marketData.price;
  const range = marketData.high - marketData.low;

  return {
    bias: isBullish ? "Bullish" : marketData.changePercent < -0.5 ? "Bearish" : "Neutral",
    support: [
      Math.round(price - range * 0.382),
      Math.round(price - range * 0.618),
      Math.round(price - range),
    ],
    resistance: [
      Math.round(price + range * 0.382),
      Math.round(price + range * 0.618),
      Math.round(price + range),
    ],
    events: ["Check economic calendar for upcoming events"],
    volatilityOutlook: range > 40
      ? "High volatility expected. Wide stops recommended."
      : "Normal volatility. Standard risk parameters apply.",
    bestWindow: "15:00 - 17:00 SGT (London Open)",
  };
}

async function getLatestBriefing() {
  const now = new Date();
  const sgtHour = parseInt(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Singapore" })
  );
  const briefingType = sgtHour < 12 ? "morning" : "evening";
  const dateKey = now.toISOString().split("T")[0];

  const result = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: {
        ":pk": { S: "BRIEFING" },
        ":sk": { S: `${briefingType}:${dateKey}` },
      },
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (item?.data?.S) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: item.data.S,
    };
  }

  // No briefing yet — generate on demand
  const genResult = await generateBriefing();
  if (genResult.statusCode === 200 && genResult.body) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: genResult.body,
    };
  }

  // No market data available — return fallback
  const fallback = generateFallbackBriefing({ price: 0, change: 0, changePercent: 0, high: 0, low: 0, open: 0 });
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(fallback),
  };
}
