import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const TABLE = process.env.MARKET_DATA_TABLE!;

const YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d";

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
