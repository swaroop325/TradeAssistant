import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const TABLE = process.env.MARKET_DATA_TABLE!;

const YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d";
const CORR_SYMBOLS = ["DX-Y.NYB", "%5ETNX", "%5EVIX"];

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

export async function handler(event: any) {
  if (event.source === "aws.events") {
    return pollMarketData();
  }

  return getLatestData();
}

async function pollMarketData() {
  try {
    const response = await fetch(YAHOO_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      console.error("Yahoo Finance error:", response.status);
      return { statusCode: 500, body: "Yahoo API error" };
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      console.error("No chart data returned");
      return { statusCode: 500, body: "No data" };
    }

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    const indicators = result.indicators?.quote?.[0];
    const highs = indicators?.high?.filter((v: number | null) => v !== null) || [];
    const lows = indicators?.low?.filter((v: number | null) => v !== null) || [];

    const dayHigh = highs.length > 0 ? Math.max(...highs) : price;
    const dayLow = lows.length > 0 ? Math.min(...lows) : price;
    const dayOpen = indicators?.open?.find((v: number | null) => v !== null) || price;

    // Pivot points (from previous day's H/L/C)
    const pp = (dayHigh + dayLow + price) / 3;
    const pivots = {
      pp: parseFloat(pp.toFixed(2)),
      r1: parseFloat((2 * pp - dayLow).toFixed(2)),
      r2: parseFloat((pp + (dayHigh - dayLow)).toFixed(2)),
      r3: parseFloat((dayHigh + 2 * (pp - dayLow)).toFixed(2)),
      s1: parseFloat((2 * pp - dayHigh).toFixed(2)),
      s2: parseFloat((pp - (dayHigh - dayLow)).toFixed(2)),
      s3: parseFloat((dayLow - 2 * (dayHigh - pp)).toFixed(2)),
    };

    // Average daily range (use current range vs typical 30-pip average for gold)
    const currentRange = dayHigh - dayLow;
    const avgDailyRange = 35;
    const rangeConsumed = Math.min(100, Math.round((currentRange / avgDailyRange) * 100));

    // Fetch correlations
    const correlations = await fetchCorrelations();

    const priceData: PriceData = {
      symbol: "XAUUSD",
      price,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      high: dayHigh,
      low: dayLow,
      open: dayOpen,
      previousClose,
      timestamp: new Date().toISOString(),
      rangeConsumed,
      avgDailyRange,
      pivots,
      correlations,
    };

    const now = new Date();
    const dateKey = now.toISOString().split("T")[0];

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

    console.log(`Price updated: ${priceData.price} (${priceData.changePercent}%)`);
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
