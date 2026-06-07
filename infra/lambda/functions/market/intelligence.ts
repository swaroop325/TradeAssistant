import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;

interface IntelligenceItem {
  id: string;
  timestamp: string;
  type: "liquidity_sweep" | "volatility_spike" | "trend_shift" | "session_break" | "range_breakout" | "sharp_move";
  title: string;
  summary: string;
  confidence: number;
  impact: "bullish" | "bearish" | "neutral";
}

const DEDUP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

function isDuplicate(newItem: IntelligenceItem, existing: IntelligenceItem[]): boolean {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  return existing.some(
    (e) => e.type === newItem.type && e.impact === newItem.impact && e.timestamp > cutoff
  );
}

function getRepeatCount(type: string, impact: string, existing: IntelligenceItem[]): number {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  return existing.filter((e) => e.type === type && e.impact === impact && e.timestamp > cutoff).length;
}

export async function handler(event: any) {
  if (event.source === "aws.events") {
    return analyzeMarket();
  }
  return getIntelligence();
}

async function analyzeMarket() {
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
  const hour = sgt.getHours();
  const dayOfWeek = sgt.getDay();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const price = marketData.price;
  const high = marketData.high;
  const low = marketData.low;
  const change = marketData.change;
  const changePercent = marketData.changePercent;
  const range = high - low;
  const rangePosition = range > 0 ? (price - low) / range : 0.5;

  // Fetch existing items for dedup
  const existingResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: {
        ":pk": { S: "INTELLIGENCE" },
        ":sk": { S: "feed" },
      },
      Limit: 1,
    })
  );

  let existingItems: IntelligenceItem[] = [];
  if (existingResult.Items?.[0]?.data?.S) {
    existingItems = JSON.parse(existingResult.Items[0].data.S);
  }

  const candidates: IntelligenceItem[] = [];

  if (Math.abs(changePercent) > 1.5) {
    const direction = changePercent > 0 ? "bullish" : "bearish";
    candidates.push({
      id: `sharp-${now.toISOString()}`,
      timestamp: now.toISOString(),
      type: "sharp_move",
      title: `Sharp ${changePercent > 0 ? "Rally" : "Selloff"}: ${Math.abs(changePercent).toFixed(1)}%`,
      summary: `Gold has moved ${Math.abs(change).toFixed(1)} points (${Math.abs(changePercent).toFixed(2)}%) today. ${changePercent > 0 ? "Buyers in control" : "Sellers dominating"}.`,
      confidence: Math.min(95, 70 + Math.abs(changePercent) * 10),
      impact: direction,
    });
  }

  if (range > 40) {
    candidates.push({
      id: `vol-${now.toISOString()}`,
      timestamp: now.toISOString(),
      type: "volatility_spike",
      title: `Elevated Volatility: ${range.toFixed(0)} pip range`,
      summary: `Daily range expanded to ${range.toFixed(0)} pips, well above average. Consider wider stops.`,
      confidence: 85,
      impact: "neutral",
    });
  }

  if (rangePosition > 0.9) {
    const repeatCount = getRepeatCount("range_breakout", "bullish", existingItems);
    const title = repeatCount > 0
      ? `Still Testing Highs (attempt #${repeatCount + 1})`
      : "Testing Daily Highs";
    candidates.push({
      id: `breakout-high-${now.toISOString()}`,
      timestamp: now.toISOString(),
      type: "range_breakout",
      title,
      summary: `Price at ${(rangePosition * 100).toFixed(0)}% of daily range. ${repeatCount > 0 ? `${repeatCount + 1}x at highs today — persistence suggests breakout.` : `Breakout potential above ${high.toFixed(0)}.`}`,
      confidence: Math.min(88, 72 + repeatCount * 5),
      impact: "bullish",
    });
  } else if (rangePosition < 0.1) {
    const repeatCount = getRepeatCount("range_breakout", "bearish", existingItems);
    const title = repeatCount > 0
      ? `Still Testing Lows (attempt #${repeatCount + 1})`
      : "Testing Daily Lows";
    candidates.push({
      id: `breakout-low-${now.toISOString()}`,
      timestamp: now.toISOString(),
      type: "range_breakout",
      title,
      summary: `Price at ${(rangePosition * 100).toFixed(0)}% of daily range. ${repeatCount > 0 ? `${repeatCount + 1}x at lows today — persistence suggests breakdown.` : `Potential breakdown below ${low.toFixed(0)}.`}`,
      confidence: Math.min(88, 72 + repeatCount * 5),
      impact: "bearish",
    });
  }

  if (!isWeekend) {
    if (hour === 15 && sgt.getMinutes() < 10) {
      candidates.push({
        id: `session-london-${now.toISOString()}`,
        timestamp: now.toISOString(),
        type: "session_break",
        title: "London Session Active",
        summary: `London session underway. Expect increased liquidity and directional moves on gold.`,
        confidence: 90,
        impact: "neutral",
      });
    } else if (hour === 20 && sgt.getMinutes() < 10) {
      candidates.push({
        id: `session-ny-${now.toISOString()}`,
        timestamp: now.toISOString(),
        type: "session_break",
        title: "New York Session Active",
        summary: `NY session open. London/NY overlap brings highest gold liquidity of the day.`,
        confidence: 90,
        impact: "neutral",
      });
    }
  }

  if (isWeekend && candidates.length === 0 && existingItems.length === 0) {
    candidates.push({
      id: `weekend-summary-${now.toISOString()}`,
      timestamp: now.toISOString(),
      type: "trend_shift",
      title: "Weekend Market Closed",
      summary: `Last close: ${price.toFixed(0)} (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%). Range: ${low.toFixed(0)}-${high.toFixed(0)}. Markets reopen Mon 5am SGT.`,
      confidence: 100,
      impact: changePercent > 0.5 ? "bullish" : changePercent < -0.5 ? "bearish" : "neutral",
    });
  }

  const prevResult = await dynamo.send(
    new GetItemCommand({
      TableName: MARKET_DATA_TABLE,
      Key: { pk: { S: "INTELLIGENCE" }, sk: { S: "prev-price" } },
    })
  );

  const prevPrice = prevResult.Item?.data?.S ? parseFloat(prevResult.Item.data.S) : null;
  if (prevPrice && Math.abs(price - prevPrice) > 10) {
    const direction = price > prevPrice ? "bullish" : "bearish";
    candidates.push({
      id: `trend-${now.toISOString()}`,
      timestamp: now.toISOString(),
      type: "trend_shift",
      title: `${price > prevPrice ? "Upward" : "Downward"} Momentum Shift`,
      summary: `Price moved ${Math.abs(price - prevPrice).toFixed(1)} points since last check. ${price > prevPrice ? "Buying" : "Selling"} pressure building.`,
      confidence: 68,
      impact: direction,
    });
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: MARKET_DATA_TABLE,
      Item: {
        pk: { S: "INTELLIGENCE" },
        sk: { S: "prev-price" },
        data: { S: String(price) },
      },
    })
  );

  // Filter out duplicates — only keep genuinely new insights
  const items = candidates.filter((c) => !isDuplicate(c, existingItems));

  if (items.length > 0) {
    const merged = [...items, ...existingItems].slice(0, 30);

    await dynamo.send(
      new PutItemCommand({
        TableName: MARKET_DATA_TABLE,
        Item: {
          pk: { S: "INTELLIGENCE" },
          sk: { S: "feed" },
          data: { S: JSON.stringify(merged) },
          updatedAt: { S: now.toISOString() },
          ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) },
        },
      })
    );
  }

  console.log(`Intelligence: ${candidates.length} candidates, ${items.length} new (${candidates.length - items.length} deduped)`);
  return { statusCode: 200, body: `${items.length} items` };
}

function deduplicateFeed(items: IntelligenceItem[]): IntelligenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.impact}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getIntelligence() {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: {
        ":pk": { S: "INTELLIGENCE" },
        ":sk": { S: "feed" },
      },
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item?.data?.S) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ intelligence: [] }),
    };
  }

  const feed = JSON.parse(item.data.S) as IntelligenceItem[];
  const dedupedFeed = deduplicateFeed(feed);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ intelligence: dedupedFeed }),
  };
}
