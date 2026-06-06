import { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { randomBytes } from "crypto";

const dynamo = new DynamoDBClient({});
const TABLE = process.env.CREDENTIALS_TABLE!;

const RP_NAME = "TradeAssistant";
const RP_ID = process.env.RP_ID || "dp5ho4pdlyl6w.cloudfront.net";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";

export async function handler(event: any) {
  const path = event.path || event.rawPath || "";
  const body = event.body ? JSON.parse(event.body) : {};

  if (path.endsWith("/options")) {
    return generateRegistrationOptions();
  }

  if (path.endsWith("/verify")) {
    return verifyRegistration(body);
  }

  return response(404, { error: "Not found" });
}

async function generateRegistrationOptions() {
  const existingCreds = await dynamo.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression: "NOT begins_with(credentialId, :prefix)",
      ExpressionAttributeValues: {
        ":prefix": { S: "challenge:" },
      },
      Select: "COUNT",
    })
  );

  if ((existingCreds.Count || 0) > 0) {
    return response(403, { error: "Registration closed. Owner already registered." });
  }

  const userId = randomBytes(16).toString("base64url");
  const challenge = randomBytes(32).toString("base64url");

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        credentialId: { S: `challenge:${challenge}` },
        userId: { S: userId },
        challenge: { S: challenge },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 300) },
      },
    })
  );

  const options = {
    rp: { name: RP_NAME, id: RP_ID },
    user: {
      id: userId,
      name: "owner",
      displayName: "War Room Owner",
    },
    challenge,
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "required",
      requireResidentKey: true,
    },
  };

  return response(200, options);
}

async function verifyRegistration(body: any) {
  const { id, rawId, type, response: credResponse } = body;

  if (!id || !rawId || type !== "public-key") {
    return response(400, { error: "Invalid credential" });
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        credentialId: { S: id },
        userId: { S: "owner" },
        rawId: { S: rawId },
        publicKey: { S: credResponse.attestationObject },
        counter: { N: "0" },
        createdAt: { S: new Date().toISOString() },
        deviceName: { S: "Primary Device" },
      },
    })
  );

  return response(200, { success: true, credentialId: id });
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
