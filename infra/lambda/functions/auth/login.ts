import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { randomBytes } from "crypto";

const dynamo = new DynamoDBClient({});
const TABLE = process.env.CREDENTIALS_TABLE!;

const RP_ID = process.env.RP_ID || "dp5ho4pdlyl6w.cloudfront.net";

export async function handler(event: any) {
  const path = event.path || event.rawPath || "";
  const body = event.body ? JSON.parse(event.body) : {};

  if (path.endsWith("/options")) {
    return generateAuthenticationOptions();
  }

  if (path.endsWith("/verify")) {
    return verifyAuthentication(body);
  }

  return response(404, { error: "Not found" });
}

async function generateAuthenticationOptions() {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression: "NOT begins_with(credentialId, :prefix)",
      ExpressionAttributeValues: {
        ":prefix": { S: "challenge:" },
      },
    })
  );

  const credentials = result.Items || [];

  if (credentials.length === 0) {
    return response(404, { error: "No credentials registered" });
  }

  const challenge = randomBytes(32).toString("base64url");

  const options = {
    challenge,
    rpId: RP_ID,
    timeout: 60000,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId.S,
      type: "public-key",
      transports: ["internal"],
    })),
  };

  return response(200, options);
}

async function verifyAuthentication(body: any) {
  const { id, rawId, type, response: credResponse } = body;

  if (!id || !rawId || type !== "public-key") {
    return response(400, { error: "Invalid credential" });
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE,
      Key: { credentialId: { S: id } },
      UpdateExpression: "SET #counter = #counter + :inc, lastUsed = :now",
      ExpressionAttributeNames: { "#counter": "counter" },
      ExpressionAttributeValues: {
        ":inc": { N: "1" },
        ":now": { S: new Date().toISOString() },
      },
    })
  );

  const token = randomBytes(32).toString("base64url");

  return response(200, {
    success: true,
    token,
    expiresIn: 86400,
  });
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
