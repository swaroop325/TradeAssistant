import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;

export async function handler() {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "LATEST#XAUUSD" } },
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item?.data?.S) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ score: 50, drivers: [], risks: [] }),
    };
  }

  const data = JSON.parse(item.data.S);
  const { price, change, changePercent, high, low, open } = data;
  const range = high - low;

  let score = 50;
  const drivers: string[] = [];
  const risks: string[] = [];

  // Trend contribution (+/- 20)
  if (changePercent > 1) { score += 20; drivers.push(`Strong momentum +${changePercent.toFixed(1)}%`); }
  else if (changePercent > 0.3) { score += 10; drivers.push(`Positive trend +${changePercent.toFixed(1)}%`); }
  else if (changePercent < -1) { score -= 20; risks.push(`Sharp decline ${changePercent.toFixed(1)}%`); }
  else if (changePercent < -0.3) { score -= 10; risks.push(`Negative trend ${changePercent.toFixed(1)}%`); }

  // Price vs range (+/- 15)
  const rangePosition = range > 0 ? (price - low) / range : 0.5;
  if (rangePosition > 0.75) { score += 10; drivers.push("Near session high"); }
  else if (rangePosition < 0.25) { score -= 10; risks.push("Near session low"); }

  // Volatility (high vol = risk)
  if (range > 80) { score -= 10; risks.push(`High volatility (${range.toFixed(0)} pip range)`); }
  else if (range > 50) { score -= 5; risks.push("Elevated volatility"); }
  else if (range < 20) { drivers.push("Low volatility — stable"); }

  // Weekend check
  const now = new Date();
  const sgt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const day = sgt.getDay();
  if (day === 0 || day === 6) { risks.push("Weekend — markets closed"); }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ score, drivers, risks }),
  };
}
