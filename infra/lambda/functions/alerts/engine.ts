import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const dynamo = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});
const ALERTS_TABLE = process.env.ALERTS_TABLE!;
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;
const PUSH_FUNCTION = process.env.PUSH_FUNCTION || "tradeassistant-push-notify";

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

async function checkMomentumAlerts(price: number): Promise<AlertResult[]> {
  const alerts: AlertResult[] = [];

  // Get recent price history (last 30 data points = ~30 minutes)
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const historyResult = await dynamo.send(
    new QueryCommand({
      TableName: MARKET_DATA_TABLE,
      KeyConditionExpression: "pk = :pk AND sk >= :start",
      ExpressionAttributeValues: {
        ":pk": { S: "XAUUSD" },
        ":start": { S: thirtyMinAgo.toISOString() },
      },
      ScanIndexForward: true,
    })
  );

  const items = historyResult.Items || [];
  if (items.length < 6) return alerts;

  const prices: number[] = [];
  for (const item of items) {
    if (!item.data?.S) continue;
    const data = JSON.parse(item.data.S);
    if (data.price) prices.push(data.price);
  }

  if (prices.length < 6) return alerts;

  // Check for sustained move: consistent direction over last 6+ data points
  const recentPrices = prices.slice(-10);
  let consecutiveUp = 0;
  let consecutiveDown = 0;

  for (let i = 1; i < recentPrices.length; i++) {
    if (recentPrices[i] > recentPrices[i - 1]) {
      consecutiveUp++;
      consecutiveDown = 0;
    } else if (recentPrices[i] < recentPrices[i - 1]) {
      consecutiveDown++;
      consecutiveUp = 0;
    }
  }

  const totalMove = recentPrices[recentPrices.length - 1] - recentPrices[0];
  const absMove = Math.abs(totalMove);

  // Alert if 6+ consecutive moves in same direction AND total move > 10 pips
  if (consecutiveUp >= 6 && absMove > 10) {
    alerts.push({
      key: `momentum:rally:${Math.floor(absMove / 5)}`,
      title: `Sustained Rally: +${absMove.toFixed(1)} in ${recentPrices.length} min`,
      summary: `Gold rising continuously. ${consecutiveUp} consecutive up-ticks, moved +${absMove.toFixed(1)} pips. Current: ${price.toFixed(2)}`,
      impact: absMove > 20 ? "high" : "medium",
      category: "price",
    });
  }

  if (consecutiveDown >= 6 && absMove > 10) {
    alerts.push({
      key: `momentum:selloff:${Math.floor(absMove / 5)}`,
      title: `Sustained Selloff: -${absMove.toFixed(1)} in ${recentPrices.length} min`,
      summary: `Gold falling continuously. ${consecutiveDown} consecutive down-ticks, dropped -${absMove.toFixed(1)} pips. Current: ${price.toFixed(2)}`,
      impact: absMove > 20 ? "high" : "medium",
      category: "price",
    });
  }

  // Also detect rapid moves (>15 pips in 5 minutes regardless of tick direction)
  if (prices.length >= 5) {
    const last5 = prices.slice(-5);
    const rapid = Math.abs(last5[last5.length - 1] - last5[0]);
    if (rapid > 15) {
      const dir = last5[last5.length - 1] > last5[0] ? "up" : "down";
      alerts.push({
        key: `rapid:${dir}:${Math.floor(rapid / 5)}`,
        title: `Rapid ${dir === "up" ? "Spike" : "Drop"}: ${rapid.toFixed(1)} pips in 5 min`,
        summary: `Gold moved ${rapid.toFixed(1)} pips in ~5 minutes. Possible news event or liquidity sweep.`,
        impact: "high",
        category: "intelligence",
      });
    }
  }

  return alerts;
}

async function checkEscalation(price: number): Promise<AlertResult[]> {
  const alerts: AlertResult[] = [];

  try {
    // Check if there was a momentum alert recently, and price continued same direction
    const prevResult = await dynamo.send(
      new GetItemCommand({
        TableName: MARKET_DATA_TABLE,
        Key: { pk: { S: "ALERT_STATE" }, sk: { S: "last-momentum" } },
      })
    );

    if (prevResult.Item?.data?.S) {
      const prev = JSON.parse(prevResult.Item.data.S);
      const timeSince = Date.now() - new Date(prev.timestamp).getTime();

      // Only escalate if 3-10 minutes since last alert
      if (timeSince > 3 * 60 * 1000 && timeSince < 10 * 60 * 1000) {
        const continued = prev.direction === "up" ? price > prev.price : price < prev.price;
        const additionalMove = Math.abs(price - prev.price);

        if (continued && additionalMove > 5) {
          const dir = prev.direction === "up" ? "rising" : "falling";
          alerts.push({
            key: `escalation:${prev.direction}:${Math.floor(additionalMove / 5)}`,
            title: `Still ${dir} — now ${prev.direction === "up" ? "+" : "-"}${(additionalMove + prev.initialMove).toFixed(0)} pips`,
            summary: `Price continued ${dir} after initial alert. Total move: ${(additionalMove + prev.initialMove).toFixed(1)} pips in ${Math.round(timeSince / 60000)} min.`,
            impact: additionalMove > 15 ? "critical" : "high",
            category: "price",
          });
        }
      }
    }
  } catch (err) {
    console.error("Escalation check error:", err);
  }

  return alerts;
}

async function checkPostEventSummary(now: Date): Promise<AlertResult[]> {
  const alerts: AlertResult[] = [];

  try {
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

    const eventsItem = eventsResult.Items?.[0];
    if (!eventsItem?.data?.S) return alerts;

    const events = JSON.parse(eventsItem.data.S);

    for (const event of events) {
      if (event.impact !== "high" && event.impact !== "critical") continue;

      const eventTime = new Date(event.time);
      const minutesSince = (now.getTime() - eventTime.getTime()) / 60000;

      // 25-35 min after event (runs every min, so catches within window)
      if (minutesSince >= 25 && minutesSince <= 35) {
        // Get price at event time and now
        const priceAtEventResult = await dynamo.send(
          new QueryCommand({
            TableName: MARKET_DATA_TABLE,
            KeyConditionExpression: "pk = :pk AND sk <= :time",
            ExpressionAttributeValues: {
              ":pk": { S: "XAUUSD" },
              ":time": { S: eventTime.toISOString() },
            },
            ScanIndexForward: false,
            Limit: 1,
          })
        );

        const latestResult = await dynamo.send(
          new QueryCommand({
            TableName: MARKET_DATA_TABLE,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: { ":pk": { S: "LATEST#XAUUSD" } },
            Limit: 1,
          })
        );

        const priceAtEvent = priceAtEventResult.Items?.[0]?.data?.S
          ? JSON.parse(priceAtEventResult.Items[0].data.S).price
          : null;
        const currentPrice = latestResult.Items?.[0]?.data?.S
          ? JSON.parse(latestResult.Items[0].data.S).price
          : null;

        if (priceAtEvent && currentPrice) {
          const move = currentPrice - priceAtEvent;
          const dir = move > 0 ? "+" : "";
          alerts.push({
            key: `post-event:${event.id}`,
            title: `Post-${event.name}: Gold ${dir}${move.toFixed(1)}`,
            summary: `30 min after ${event.name}: Gold moved ${dir}${move.toFixed(1)} pips (${priceAtEvent.toFixed(0)} → ${currentPrice.toFixed(0)}).`,
            impact: Math.abs(move) > 15 ? "high" : "medium",
            category: "economic",
          });
        }
      }
    }
  } catch (err) {
    console.error("Post-event summary error:", err);
  }

  return alerts;
}

async function checkEventCountdowns(now: Date): Promise<AlertResult[]> {
  const alerts: AlertResult[] = [];

  try {
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

    const eventsItem = eventsResult.Items?.[0];
    if (!eventsItem?.data?.S) return alerts;

    const events = JSON.parse(eventsItem.data.S);

    for (const event of events) {
      if (event.impact !== "high" && event.impact !== "critical") continue;

      const eventTime = new Date(event.time);
      const minutesUntil = (eventTime.getTime() - now.getTime()) / 60000;

      // Fire alert when event is 10-15 minutes away (runs every 5min so this catches it)
      if (minutesUntil > 0 && minutesUntil <= 15) {
        const mins = Math.round(minutesUntil);
        alerts.push({
          key: `economic:countdown:${event.id}`,
          title: `${event.name} in ${mins} min`,
          summary: `${event.impact.toUpperCase()} impact event approaching. ${event.forecast ? `Forecast: ${event.forecast}` : ""}${event.previous ? ` Previous: ${event.previous}` : ""} Expect sharp gold movement.`,
          impact: event.impact === "critical" ? "critical" : "high",
          category: "economic",
        });
      }
    }
  } catch (err) {
    console.error("Event countdown check failed:", err);
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

  // Check momentum/streak alerts
  const momentumAlerts = await checkMomentumAlerts(marketData.price);
  candidates.push(...momentumAlerts);

  // Check escalation (price continuing after a momentum alert)
  const escalationAlerts = await checkEscalation(marketData.price);
  candidates.push(...escalationAlerts);

  // Check economic events for countdown alerts
  const eventAlerts = await checkEventCountdowns(now);
  candidates.push(...eventAlerts);

  // Check post-event summaries (30 min after high-impact events)
  const postEventAlerts = await checkPostEventSummary(now);
  candidates.push(...postEventAlerts);

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

    // Save momentum state for escalation tracking
    if (alert.key.startsWith("momentum:")) {
      const direction = alert.key.includes("rally") ? "up" : "down";
      const moveMatch = alert.title.match(/([\d.]+) in/);
      await dynamo.send(
        new PutItemCommand({
          TableName: MARKET_DATA_TABLE,
          Item: {
            pk: { S: "ALERT_STATE" },
            sk: { S: "last-momentum" },
            data: { S: JSON.stringify({ direction, price: marketData.price, initialMove: parseFloat(moveMatch?.[1] || "10"), timestamp: now.toISOString() }) },
            ttl: { N: String(Math.floor(Date.now() / 1000) + 900) },
          },
        })
      );
    }

    // Track alert accuracy: store directional prediction for later evaluation
    if (alert.category === "price" || alert.category === "intelligence") {
      const predictedDir = alert.key.includes("rally") || alert.key.includes("up") || alert.key.includes("surged") ? "up" : "down";
      await dynamo.send(
        new PutItemCommand({
          TableName: MARKET_DATA_TABLE,
          Item: {
            pk: { S: "ALERT_ACCURACY" },
            sk: { S: `${now.toISOString()}:${alert.key}` },
            data: { S: JSON.stringify({ predictedDirection: predictedDir, priceAtAlert: marketData.price, timestamp: now.toISOString(), alertKey: alert.key }) },
            ttl: { N: String(Math.floor(Date.now() / 1000) + 86400 * 8) },
          },
        })
      );
    }

    // Send push notification for medium+ alerts
    if (alert.impact === "medium" || alert.impact === "high" || alert.impact === "critical") {
      try {
        await lambdaClient.send(
          new InvokeCommand({
            FunctionName: PUSH_FUNCTION,
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify({
              httpMethod: "POST",
              path: "/send",
              body: JSON.stringify({
                title: alert.title,
                message: alert.summary,
                tag: `${alert.category}-alert`,
              }),
            })),
          })
        );
      } catch (pushErr) {
        console.error("Push invoke failed:", pushErr);
      }
    }
  }

  // Evaluate past alerts for accuracy (30 min after they fired)
  await evaluateAlertAccuracy(marketData.price, now);

  console.log(`Alert engine: ${newAlerts} new alerts (${candidates.length} candidates, ${candidates.length - newAlerts} deduped)`);
  return { statusCode: 200, body: `${newAlerts} alerts` };
}

async function evaluateAlertAccuracy(currentPrice: number, now: Date) {
  try {
    const thirtyMinAgo = new Date(now.getTime() - 35 * 60 * 1000);
    const fortyMinAgo = new Date(now.getTime() - 45 * 60 * 1000);

    const pendingResult = await dynamo.send(
      new QueryCommand({
        TableName: MARKET_DATA_TABLE,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": { S: "ALERT_ACCURACY" },
          ":start": { S: fortyMinAgo.toISOString() },
          ":end": { S: thirtyMinAgo.toISOString() },
        },
      })
    );

    for (const item of pendingResult.Items || []) {
      if (!item.data?.S) continue;
      const record = JSON.parse(item.data.S);
      if (record.evaluated) continue;

      const priceDelta = currentPrice - record.priceAtAlert;
      const actualDir = priceDelta > 0 ? "up" : "down";
      const correct = actualDir === record.predictedDirection;

      // Update the record with outcome
      await dynamo.send(
        new PutItemCommand({
          TableName: MARKET_DATA_TABLE,
          Item: {
            pk: { S: "ALERT_ACCURACY" },
            sk: item.sk,
            data: { S: JSON.stringify({ ...record, evaluated: true, correct, actualDirection: actualDir, priceAfter30m: currentPrice, pnlPips: priceDelta }) },
            ttl: { N: String(Math.floor(Date.now() / 1000) + 86400 * 8) },
          },
        })
      );
    }
  } catch (err) {
    console.error("Alert accuracy evaluation error:", err);
  }
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
