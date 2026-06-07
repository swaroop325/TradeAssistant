const SPOT_URL = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";

export async function handler(event: any) {
  const params = event.queryStringParameters || {};
  const interval = params.interval || "5m";
  const range = params.range || "1d";

  const allowed = ["1m", "5m", "15m", "1h"];
  const allowedRanges = ["1d", "5d", "1mo"];
  if (!allowed.includes(interval) || !allowedRanges.includes(range)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid interval or range" }),
    };
  }

  try {
    const futuresUrl = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${interval}&range=${range}`;

    const [futuresRes, spotRes] = await Promise.all([
      fetch(futuresUrl, { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch(SPOT_URL),
    ]);

    if (!futuresRes.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Upstream error" }),
      };
    }

    // Calculate futures-to-spot offset
    let offset = 0;
    const futuresData = await futuresRes.json();
    const futuresResult = futuresData.chart?.result?.[0];

    if (spotRes.ok) {
      const spotData = await spotRes.json();
      const spotQuote = spotData?.[0]?.spreadProfilePrices?.[0];
      if (spotQuote && futuresResult?.meta?.regularMarketPrice) {
        const spotBid = spotQuote.bid;
        const futuresPrice = futuresResult.meta.regularMarketPrice;
        offset = futuresPrice - spotBid;
      }
    }

    if (!futuresResult) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ candles: [] }),
      };
    }

    const timestamps = futuresResult.timestamp || [];
    const quote = futuresResult.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] != null && highs[i] != null && lows[i] != null && closes[i] != null) {
        candles.push({
          time: timestamps[i],
          open: parseFloat((opens[i] - offset).toFixed(2)),
          high: parseFloat((highs[i] - offset).toFixed(2)),
          low: parseFloat((lows[i] - offset).toFixed(2)),
          close: parseFloat((closes[i] - offset).toFixed(2)),
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({ candles }),
    };
  } catch (err) {
    console.error("Candles error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Internal error" }),
    };
  }
}
