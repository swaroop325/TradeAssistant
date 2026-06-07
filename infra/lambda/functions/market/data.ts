import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const TABLE = process.env.MARKET_DATA_TABLE!;

const SPOT_URL = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";

interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: string;
  rangeConsumed?: number;
  avgDailyRange?: number;
  pivots?: { pp: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
  correlations?: { dxy: CorrelationData | null; tnx: CorrelationData | null; vix: CorrelationData | null };
}

interface CorrelationData {
  price: number;
  change: number;
  changePercent: number;
  signal: string;
}

interface DailyState {
  open: number;
  high: number;
  low: number;
  previousClose: number;
  date: string;
}

export async function handler(event: any) {
  if (event.source === "aws.events") {
    return pollMarketData();
  }

  return getLatestData();
}

async function pollMarketData() {
  try {
    const response = await fetch(SPOT_URL);

    if (!response.ok) {
      console.error("Swissquote error:", response.status);
      return { statusCode: 500, body: "Spot API error" };
    }

    const data = await response.json();
    const quotes = data?.[0]?.spreadProfilePrices?.[0];

    if (!quotes) {
      console.error("No spot data returned");
      return { statusCode: 500, body: "No data" };
    }

    const price = parseFloat(quotes.bid.toFixed(2));

    // Get or initialize daily state (OHLC tracking)
    const now = new Date();
    const dateKey = now.toISOString().split("T")[0];

    const dailyResult = await dynamo.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: { pk: { S: "DAILY#XAUUSD" }, sk: { S: "state" } },
      })
    );

    let daily: DailyState;
    const existingState = dailyResult.Item?.data?.S ? JSON.parse(dailyResult.Item.data.S) as DailyState : null;

    if (existingState && existingState.date === dateKey) {
      daily = {
        ...existingState,
        high: Math.max(existingState.high, price),
        low: Math.min(existingState.low, price),
      };
    } else {
      // New day — previous close is the last known price
      const prevClose = existingState ? existingState.high > 0 ? parseFloat(((existingState.high + existingState.low) / 2).toFixed(2)) : price : price;
      daily = {
        open: price,
        high: price,
        low: price,
        previousClose: existingState ? prevClose : price,
        date: dateKey,
      };
    }

    // Save updated daily state
    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          pk: { S: "DAILY#XAUUSD" },
          sk: { S: "state" },
          data: { S: JSON.stringify(daily) },
        },
      })
    );

    const change = price - daily.previousClose;
    const changePercent = daily.previousClose > 0 ? (change / daily.previousClose) * 100 : 0;

    // Pivot points
    const pp = (daily.high + daily.low + price) / 3;
    const pivots = {
      pp: parseFloat(pp.toFixed(2)),
      r1: parseFloat((2 * pp - daily.low).toFixed(2)),
      r2: parseFloat((pp + (daily.high - daily.low)).toFixed(2)),
      r3: parseFloat((daily.high + 2 * (pp - daily.low)).toFixed(2)),
      s1: parseFloat((2 * pp - daily.high).toFixed(2)),
      s2: parseFloat((pp - (daily.high - daily.low)).toFixed(2)),
      s3: parseFloat((daily.low - 2 * (daily.high - pp)).toFixed(2)),
    };

    const currentRange = daily.high - daily.low;
    const avgDailyRange = 35;
    const rangeConsumed = Math.min(100, Math.round((currentRange / avgDailyRange) * 100));

    // Fetch correlations
    const correlations = await fetchCorrelations();

    const priceData: PriceData = {
      symbol: "XAUUSD",
      price,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      high: daily.high,
      low: daily.low,
      open: daily.open,
      previousClose: daily.previousClose,
      timestamp: now.toISOString(),
      rangeConsumed,
      avgDailyRange,
      pivots,
      correlations,
    };

    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          pk: { S: "PRICE#XAUUSD" },
          sk: { S: `${dateKey}#${now.toISOString()}` },
          data: { S: JSON.stringify(priceData) },
          price: { N: String(priceData.price) },
          ttl: { N: String(Math.floor(Date.now() / 1000) + 86400 * 7) },
        },
      })
    );

    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          pk: { S: "LATEST#XAUUSD" },
          sk: { S: "current" },
          data: { S: JSON.stringify(priceData) },
          price: { N: String(priceData.price) },
          updatedAt: { S: now.toISOString() },
        },
      })
    );

    console.log(`Price updated: ${priceData.price} (${priceData.changePercent.toFixed(2)}%)`);
    return { statusCode: 200, body: "OK" };
  } catch (error) {
    console.error("Poll error:", error);
    return { statusCode: 500, body: "Error" };
  }
}

async function fetchCorrelations(): Promise<{ dxy: CorrelationData | null; tnx: CorrelationData | null; vix: CorrelationData | null }> {
  const result = { dxy: null as CorrelationData | null, tnx: null as CorrelationData | null, vix: null as CorrelationData | null };

  try {
    const [dxyRes, tnxRes, vixRes] = await Promise.allSettled([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);

    if (dxyRes.status === "fulfilled" && dxyRes.value.ok) {
      const data = await dxyRes.value.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (meta) {
        const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
        const price = meta.regularMarketPrice;
        const chg = price - prev;
        const chgPct = (chg / prev) * 100;
        result.dxy = {
          price: parseFloat(price.toFixed(3)),
          change: parseFloat(chg.toFixed(3)),
          changePercent: parseFloat(chgPct.toFixed(2)),
          signal: chgPct > 0.2 ? "Bearish for gold" : chgPct < -0.2 ? "Bullish for gold" : "Neutral",
        };
      }
    }

    if (tnxRes.status === "fulfilled" && tnxRes.value.ok) {
      const data = await tnxRes.value.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (meta) {
        const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
        const price = meta.regularMarketPrice;
        const chg = price - prev;
        const chgPct = (chg / prev) * 100;
        result.tnx = {
          price: parseFloat(price.toFixed(3)),
          change: parseFloat(chg.toFixed(3)),
          changePercent: parseFloat(chgPct.toFixed(2)),
          signal: chgPct > 1 ? "Headwind for gold" : chgPct < -1 ? "Tailwind for gold" : "Neutral",
        };
      }
    }

    if (vixRes.status === "fulfilled" && vixRes.value.ok) {
      const data = await vixRes.value.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (meta) {
        const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
        const price = meta.regularMarketPrice;
        const chg = price - prev;
        const chgPct = (chg / prev) * 100;
        result.vix = {
          price: parseFloat(price.toFixed(2)),
          change: parseFloat(chg.toFixed(2)),
          changePercent: parseFloat(chgPct.toFixed(2)),
          signal: price > 25 ? "High fear — gold supportive" : price > 18 ? "Elevated — mild gold support" : "Low fear — no catalyst",
        };
      }
    }
  } catch (err) {
    console.error("Correlations fetch error:", err);
  }

  return result;
}

async function getLatestData() {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: "LATEST#XAUUSD" },
      },
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "No data available" }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: item.data.S,
  };
}
