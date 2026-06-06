import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const ALERTS_TABLE = process.env.ALERTS_TABLE!;
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;

interface AlertResult {
  key: string;
  title: string;
  summary: string;
  impact: "low" | "medium" | "high" | "critical";
  category: string;
}

interface MarketContext {
  price: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
}

function checkAlerts(ctx: MarketContext): AlertResult[] {
  const alerts: AlertResult[] = [];

  // Skip weekends
  if (ctx.dayOfWeek === 0 || ctx.dayOfWeek === 6) return alerts;

  // Session alerts (only at specific times)
  if (ctx.hour === 14 && ctx.minute >= 55 && ctx.minute <= 59) {
    alerts.push({
      key: "session:london-open",
      title: "London Opens in 5 Minutes",
      summary: "London session approaching. Expect increased volatility on XAUUSD.",
      impact: "medium",
      category: "session",
    });
  }

  if (ctx.hour === 19 && ctx.minute >= 45 && ctx.minute <= 49) {
    alerts.push({
      key: "session:ny-open",
      title: "New York Opens in 15 Minutes",
      summary: "New York session approaching. Major liquidity incoming.",
      impact: "medium",
      category: "session",
    });
  }

  // Price alerts (once per condition per day)
  if (Math.abs(ctx.changePercent) > 2) {
    const direction = ctx.changePercent > 0 ? "surged" : "crashed";
    alerts.push({
      key: `price:big-move:${direction}`,
      title: `Gold ${direction} ${Math.abs(ctx.changePercent).toFixed(1)}%`,
      summary: `XAUUSD has ${direction} significantly. Current: ${ctx.price.toFixed(2)}`,
      impact: "critical",
      category: "price",
    });
  }

  const range = ctx.high - ctx.low;
  if (range > 80) {
    alerts.push({
      key: "intelligence:high-vol",
      title: "High Volatility Detected",
      summary: `Daily range expanded to ${range.toFixed(0)} pips. Exercise caution.`,
      impact: "high",
      category: "intelligence",
    });
  }

  return alerts;
}

export async function handler(event: any) {
  if (event.source === "aws.events") {
    return runAlertEngine();
  }
  return getAlerts();
}

async function runAlertEngine() {
  const latestResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "LATEST#XAUUSD" } },
      Limit: 1,
    })
  );

  const latestItem = latestResult.Items?.[0];
  if (!latestItem?.data?.S) {
    return { statusCode: 200, body: "No data" };
  }

  const marketData = JSON.parse(latestItem.data.S);
  const now = new Date();
  const sgtStr = now.toLocaleString("en-US", { timeZone: "Asia/Singapore" });
  const sgt = new Date(sgtStr);

  const context: MarketContext = {
    price: marketData.price,
    high: marketData.high,
    low: marketData.low,
    change: marketData.change,
    changePercent: marketData.changePercent,
    hour: sgt.getHours(),
    minute: sgt.getMinutes(),
    dayOfWeek: sgt.getDay(),
  };

  const candidates = checkAlerts(context);
  const today = now.toISOString().split("T")[0];
  let newAlerts = 0;

  for (const alert of candidates) {
    // Dedup: check if this alert key was already sent today
    const dedupKey = `DEDUP#${today}#${alert.key}`;
    const existing = await dynamo.send(
      new GetItemCommand({
        TableName: ALERTS_TABLE,
        Key: { pk: { S: dedupKey }, sk: { S: "sent" } },
      })
    );

    if (existing.Item) continue;

    // Mark as sent
    await dynamo.send(
      new PutItemCommand({
        TableName: ALERTS_TABLE,
        Item: {
          pk: { S: dedupKey },
          sk: { S: "sent" },
          ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) },
        },
      })
    );

    // Store the alert
    const alertId = `${now.toISOString()}:${alert.key}`;
    await dynamo.send(
      new PutItemCommand({
        TableName: ALERTS_TABLE,
        Item: {
          pk: { S: "ALERT" },
          sk: { S: alertId },
          title: { S: alert.title },
          summary: { S: alert.summary },
          impact: { S: alert.impact },
          category: { S: alert.category },
          timestamp: { S: now.toISOString() },
          read: { BOOL: false },
          ttl: { N: String(Math.floor(Date.now() / 1000) + 86400 * 3) },
        },
      })
    );

    newAlerts++;
  }

  console.log(`Alert engine: ${newAlerts} new alerts (${candidates.length} candidates, ${candidates.length - newAlerts} deduped)`);
  return { statusCode: 200, body: `${newAlerts} alerts` };
}

async function getAlerts() {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: ALERTS_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "ALERT" } },
      ScanIndexForward: false,
      Limit: 50,
    })
  );

  const alerts = (result.Items || []).map((item) => ({
    id: item.sk.S,
    title: item.title.S,
    summary: item.summary.S,
    impact: item.impact.S,
    category: item.category.S,
    timestamp: item.timestamp.S,
    read: item.read.BOOL,
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ alerts }),
  };
}
