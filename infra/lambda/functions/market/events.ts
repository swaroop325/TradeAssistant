import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const MARKET_DATA_TABLE = process.env.MARKET_DATA_TABLE!;

interface EconomicEvent {
  id: string;
  name: string;
  impact: "low" | "medium" | "high" | "critical";
  time: string;
  currency: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

const GOLD_RELEVANT_EVENTS = [
  "Non-Farm Payrolls",
  "CPI",
  "Core CPI",
  "PPI",
  "Core PPI",
  "FOMC",
  "Fed Interest Rate",
  "Fed Chair Powell",
  "GDP",
  "Initial Jobless Claims",
  "Retail Sales",
  "ISM Manufacturing",
  "ISM Services",
  "PCE Price Index",
  "Core PCE",
  "Durable Goods",
  "Consumer Confidence",
  "ADP Employment",
  "Unemployment Rate",
  "Average Hourly Earnings",
  "Trade Balance",
  "Treasury",
  "Existing Home Sales",
  "New Home Sales",
  "Michigan Consumer",
  "Philadelphia Fed",
  "Empire State",
  "Industrial Production",
  "Capacity Utilization",
  "PMI",
  "ECB",
  "BOE",
  "BOJ",
  "RBA",
  "SNB",
];

function isGoldRelevant(eventName: string): boolean {
  return GOLD_RELEVANT_EVENTS.some((keyword) =>
    eventName.toLowerCase().includes(keyword.toLowerCase())
  );
}

function mapImpact(impact: string): "low" | "medium" | "high" | "critical" {
  switch (impact?.toLowerCase()) {
    case "high":
    case "3":
      return "high";
    case "medium":
    case "2":
      return "medium";
    case "low":
    case "1":
      return "low";
    default:
      return "low";
  }
}

async function fetchFromNagarroCalendar(): Promise<EconomicEvent[]> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const from = weekStart.toISOString().split("T")[0];
  const to = weekEnd.toISOString().split("T")[0];

  const url = `https://nfs.faireconomy.media/ff_calendar_thisweek.json`;

  const res = await fetch(url, {
    headers: { "User-Agent": "TradeAssistant/1.0" },
  });

  if (!res.ok) {
    console.log(`Calendar API returned ${res.status}`);
    return [];
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const events: EconomicEvent[] = [];

  for (const item of data) {
    const eventName = item.title || item.event || "";
    const currency = item.country || item.currency || "USD";

    if (currency !== "USD" && !isGoldRelevant(eventName)) continue;
    if (currency === "USD" || isGoldRelevant(eventName)) {
      const eventDate = item.date ? new Date(item.date) : null;
      if (!eventDate || eventDate < now) continue;

      const impact = item.impact || item.importance || "low";
      const mappedImpact = mapImpact(impact);

      if (mappedImpact === "low" && !isGoldRelevant(eventName)) continue;

      events.push({
        id: `${eventDate.toISOString()}-${eventName.slice(0, 20).replace(/\s/g, "-")}`,
        name: eventName,
        impact: isGoldRelevant(eventName) && mappedImpact === "medium" ? "high" : mappedImpact,
        time: eventDate.toISOString(),
        currency,
        forecast: item.forecast || undefined,
        previous: item.previous || undefined,
        actual: item.actual || undefined,
      });
    }
  }

  return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()).slice(0, 15);
}

async function fetchFallbackEvents(): Promise<EconomicEvent[]> {
  const now = new Date();
  const sgt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const day = sgt.getDay();

  if (day === 0 || day === 6) return [];

  const events: EconomicEvent[] = [];
  const today = new Date(sgt);
  today.setHours(0, 0, 0, 0);

  const schedules: { hour: number; min: number; name: string; impact: "medium" | "high" | "critical" }[] = [];

  if (day === 1) {
    schedules.push({ hour: 22, min: 0, name: "ISM Manufacturing PMI", impact: "high" });
  } else if (day === 2) {
    schedules.push({ hour: 20, min: 30, name: "JOLTS Job Openings", impact: "medium" });
  } else if (day === 3) {
    schedules.push({ hour: 20, min: 15, name: "ADP Employment Change", impact: "high" });
    schedules.push({ hour: 22, min: 0, name: "ISM Services PMI", impact: "high" });
  } else if (day === 4) {
    schedules.push({ hour: 20, min: 30, name: "Initial Jobless Claims", impact: "medium" });
  } else if (day === 5) {
    schedules.push({ hour: 20, min: 30, name: "Non-Farm Payrolls", impact: "critical" });
    schedules.push({ hour: 20, min: 30, name: "Unemployment Rate", impact: "high" });
  }

  for (const s of schedules) {
    const eventTime = new Date(today);
    eventTime.setHours(s.hour, s.min, 0, 0);

    if (eventTime > sgt) {
      events.push({
        id: `${eventTime.toISOString()}-${s.name.replace(/\s/g, "-")}`,
        name: s.name,
        impact: s.impact,
        time: eventTime.toISOString(),
        currency: "USD",
      });
    }
  }

  return events;
}

export async function handler(event: any) {
  if (event.source === "aws.events") {
    return refreshCalendar();
  }
  return getEvents();
}

async function refreshCalendar() {
  let events: EconomicEvent[] = [];

  try {
    events = await fetchFromNagarroCalendar();
    console.log(`Fetched ${events.length} events from calendar`);
  } catch (err) {
    console.error("Calendar fetch failed, using fallback:", err);
  }

  if (events.length === 0) {
    events = await fetchFallbackEvents();
    console.log(`Using ${events.length} fallback events`);
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: MARKET_DATA_TABLE,
      Item: {
        pk: { S: "EVENTS" },
        sk: { S: "calendar" },
        data: { S: JSON.stringify(events) },
        updatedAt: { S: new Date().toISOString() },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) },
      },
    })
  );

  return { statusCode: 200, body: `${events.length} events` };
}

async function getEvents() {
  const result = await dynamo.send(
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

  const item = result.Items?.[0];
  let events: EconomicEvent[] = [];

  if (item?.data?.S) {
    events = JSON.parse(item.data.S);
  }

  if (events.length === 0) {
    events = await fetchNextWeekEvents();
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ events }),
  };
}

async function fetchNextWeekEvents(): Promise<EconomicEvent[]> {
  const now = new Date();
  const sgt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const day = sgt.getDay();

  const events: EconomicEvent[] = [];

  const weekEvents: { dayOffset: number; hour: number; min: number; name: string; impact: "medium" | "high" | "critical" }[] = [
    { dayOffset: 1, hour: 22, min: 0, name: "ISM Manufacturing PMI", impact: "high" },
    { dayOffset: 2, hour: 20, min: 30, name: "JOLTS Job Openings", impact: "medium" },
    { dayOffset: 3, hour: 20, min: 15, name: "ADP Employment Change", impact: "high" },
    { dayOffset: 3, hour: 22, min: 0, name: "ISM Services PMI", impact: "high" },
    { dayOffset: 4, hour: 20, min: 30, name: "Initial Jobless Claims", impact: "medium" },
    { dayOffset: 5, hour: 20, min: 30, name: "Non-Farm Payrolls", impact: "critical" },
    { dayOffset: 5, hour: 20, min: 30, name: "Unemployment Rate", impact: "high" },
  ];

  const monday = new Date(sgt);
  if (day === 0) monday.setDate(sgt.getDate() + 1);
  else if (day === 6) monday.setDate(sgt.getDate() + 2);
  else monday.setDate(sgt.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);

  for (const e of weekEvents) {
    const eventTime = new Date(monday);
    eventTime.setDate(monday.getDate() + e.dayOffset - 1);
    eventTime.setHours(e.hour, e.min, 0, 0);

    if (eventTime > sgt) {
      events.push({
        id: `${eventTime.toISOString()}-${e.name.replace(/\s/g, "-")}`,
        name: e.name,
        impact: e.impact,
        time: eventTime.toISOString(),
        currency: "USD",
      });
    }
  }

  return events;
}
