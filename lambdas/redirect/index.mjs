import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const LINKS_TABLE = "Links";
const CLICKS_TABLE = "Clicks";

export const handler = async (event) => {
  const shortcode = event.pathParameters?.shortcode;

  if (!shortcode) {
    return { statusCode: 400, body: "Missing shortcode" };
  }

  let result;
  try {
    result = await ddb.send(
      new GetCommand({
        TableName: LINKS_TABLE,
        Key: { shortcode },
      })
    );
  } catch (err) {
    console.error("DynamoDB GetItem failed:", err);
    return { statusCode: 500, body: "Internal error" };
  }

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "text/html" },
      body: "<h1>404 - Short link not found</h1>",
    };
  }

  const { longUrl } = result.Item;

  const timestamp = new Date().toISOString();
  const userAgent = event.headers?.["user-agent"] || "unknown";

  const logClick = ddb.send(
    new PutCommand({
      TableName: CLICKS_TABLE,
      Item: { shortcode, timestamp, userAgent },
    })
  );

  const incrementCount = ddb.send(
    new UpdateCommand({
      TableName: LINKS_TABLE,
      Key: { shortcode },
      UpdateExpression: "SET clickCount = if_not_exists(clickCount, :zero) + :one",
      ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    })
  );

  try {
    await Promise.all([logClick, incrementCount]);
  } catch (err) {
    console.error("Click logging failed:", err);
  }

  return {
    statusCode: 302,
    headers: { Location: longUrl },
  };
};