import { DynamoDBClient, PutItemCommand, DeleteItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import webpush from "web-push";

const dynamo = new DynamoDBClient({});
const TABLE = process.env.SUBSCRIPTIONS_TABLE!;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function handler(event: any) {
  const path = event.path || event.rawPath || "";
  const method = event.httpMethod || event.requestContext?.http?.method;
  const body = event.body ? JSON.parse(event.body) : {};

  if (method === "POST" && path.endsWith("/subscribe")) {
    return subscribe(body);
  }

  if (method === "DELETE" && path.endsWith("/subscribe")) {
    return unsubscribe(body);
  }

  if (method === "POST" && path.endsWith("/send")) {
    return sendNotification(body);
  }

  return response(200, { vapidPublicKey: VAPID_PUBLIC_KEY });
}

async function subscribe(body: any) {
  const { subscription } = body;

  if (!subscription?.endpoint) {
    return response(400, { error: "Invalid subscription" });
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        endpoint: { S: subscription.endpoint },
        keys: { S: JSON.stringify(subscription.keys) },
        createdAt: { S: new Date().toISOString() },
        userAgent: { S: body.userAgent || "unknown" },
      },
    })
  );

  return response(201, { success: true });
}

async function unsubscribe(body: any) {
  const { endpoint } = body;

  if (!endpoint) {
    return response(400, { error: "Endpoint required" });
  }

  await dynamo.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: { endpoint: { S: endpoint } },
    })
  );

  return response(200, { success: true });
}

async function sendNotification(body: any) {
  const { title, message, url, tag } = body;

  const subs = await dynamo.send(
    new ScanCommand({ TableName: TABLE })
  );

  if (!subs.Items?.length) {
    return response(200, { sent: 0 });
  }

  const payload = JSON.stringify({
    title: title || "TradeAssistant",
    body: message,
    url: url || "/",
    tag: tag || "ta-alert",
  });

  let sent = 0;
  for (const sub of subs.Items) {
    try {
      const subscription = {
        endpoint: sub.endpoint.S!,
        keys: JSON.parse(sub.keys.S!),
      };

      await sendWebPush(subscription, payload);
      sent++;
    } catch (error) {
      console.error(`Push failed for ${sub.endpoint.S}:`, error);
      if ((error as any).statusCode === 410) {
        await dynamo.send(
          new DeleteItemCommand({
            TableName: TABLE,
            Key: { endpoint: { S: sub.endpoint.S! } },
          })
        );
      }
    }
  }

  return response(200, { sent });
}

async function sendWebPush(
  subscription: { endpoint: string; keys: any },
  payload: string
) {
  const pushSub = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  };
  const result = await webpush.sendNotification(pushSub, payload);
  console.log(`Push sent to ${subscription.endpoint.substring(0, 50)}... Status: ${result.statusCode}`);
}

function response(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
    body: JSON.stringify(body),
  };
}
