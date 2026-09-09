import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const LINKS_TABLE = "Links";

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const shortcode = event.pathParameters?.shortcode;
  if (!shortcode) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing shortcode" }) };
  }

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: LINKS_TABLE,
        Key: { shortcode },
        ConditionExpression: "attribute_exists(shortcode)",
      })
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Link not found" }) };
    }
    console.error("Delete failed:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to delete link" }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ shortcode, deleted: true }) };
};