import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const LINKS_TABLE = "Links";

export const handler = async () => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const result = await ddb.send(new ScanCommand({ TableName: LINKS_TABLE }));

    const links = (result.Items || [])
      .map(item => ({
        shortcode: item.shortcode,
        longUrl: item.longUrl,
        clickCount: item.clickCount ?? 0,
        createdAt: item.createdAt,
      }))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return { statusCode: 200, headers, body: JSON.stringify({ links }) };
  } catch (err) {
    console.error("Scan failed:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to fetch links" }) };
  }
};