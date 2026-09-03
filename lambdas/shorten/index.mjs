import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomBytes } from "crypto";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Links";

function generateShortcode(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { longUrl } = body;

  if (!longUrl || !isValidUrl(longUrl)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "A valid longUrl (http/https) is required" }),
    };
  }

  const shortcode = generateShortcode();

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          shortcode,
          longUrl,
          createdAt: new Date().toISOString(),
          clickCount: 0,
        },
        // Ensures we never silently overwrite an existing shortcode
        ConditionExpression: "attribute_not_exists(shortcode)",
      })
    );
  } catch (err) {
    console.error("DynamoDB PutItem failed:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to save link" }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ shortcode, longUrl }),
  };
};