# URL Shortener: Serverless on AWS

A personal URL shortener with click analytics, built entirely on AWS serverless services.

## Architecture

```
Browser → S3 (static frontend)
Browser → API Gateway (HTTP API)
              ├── POST   /shorten     → Lambda: shorten     → DynamoDB (Links)
              ├── GET    /{shortcode} → Lambda: redirect    → DynamoDB (Links, Clicks)
              ├── GET    /links       → Lambda: list-links  → DynamoDB (Links)
              └── DELETE /{shortcode} → Lambda: delete-link → DynamoDB (Links)
```

1. The frontend is a single static HTML page hosted on **S3**.
2. Creating a link calls **API Gateway** (`POST /shorten`), which triggers a **Lambda** function that generates a random 6-character code and writes `{shortcode, longUrl}` to a **DynamoDB** table (`Links`).
3. Visiting a short link (`GET /{shortcode}`) triggers a second **Lambda**, which looks up the long URL in `Links`, logs the click (timestamp and user agent) to a second table (`Clicks`), atomically increments a click counter on the `Links` row, and returns an HTTP 302 redirect.
4. The links list on the frontend is fetched live from DynamoDB via `GET /links`, so it always reflects the current state of the database.
5. Deleting a link (`DELETE /{shortcode}`) removes its row from `Links` after a confirmation prompt, and the list updates immediately without a page refresh. Click history in `Clicks` is left untouched.

## Tech stack

- **AWS Lambda** (Node.js 24.x): `shorten`, `redirect`, `list-links`, and `delete-link` functions
- **API Gateway** (HTTP API): routes for `POST /shorten`, `GET /{shortcode}`, `GET /links`, and `DELETE /{shortcode}`
- **DynamoDB**: two on-demand tables, `Links` (shortcode to longUrl, with a running click count) and `Clicks` (a per-click log)
- **S3**: static website hosting for the frontend
- **IAM**: a scoped execution role granting Lambda only `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, and `Scan` on the two tables above

## Repo structure

```
frontend/           Static HTML, CSS, and JS frontend (upload directly to an S3 bucket)
lambdas/shorten/    Lambda that creates a new short link
lambdas/redirect/   Lambda that resolves a short link and logs the click
lambdas/links/      Lambda that lists all links with current click counts
lambdas/delete/     Lambda that deletes a link by shortcode
iam/                IAM policy JSON for the Lambda execution role
```

## Deploying your own copy

1. **DynamoDB**: create two tables.
   - `Links`: partition key `shortcode` (String)
   - `Clicks`: partition key `shortcode` (String), sort key `timestamp` (String)
2. **IAM role**: create a Lambda execution role, attach `AWSLambdaBasicExecutionRole`, and add the inline policy from `iam/dynamodb-policy.json`.
3. **Lambda functions**: create `shorten-url`, `redirect-url`, `list-links`, and `delete-link` (Node.js 24.x) using the role above, and paste in the code from the matching folder under `lambdas/`.
4. **API Gateway**: create an HTTP API with four routes.
   - `POST /shorten` → `shorten-url`
   - `GET /{shortcode}` → `redirect-url`
   - `GET /links` → `list-links`
   - `DELETE /{shortcode}` → `delete-link`

   Enable CORS with `Access-Control-Allow-Origin: *`, methods `GET, POST, DELETE, OPTIONS`, and headers `Content-Type`.
5. **Frontend**: in `frontend/index.html`, replace `API_GATEWAY_INVOKE_URL` with your API Gateway invoke URL, then upload `index.html` and `button-icon.png` to an S3 bucket with static website hosting enabled and a public-read bucket policy.

## Notes

- This is a personal project built for learning. The open CORS policy and public bucket policy are fine at this scale but should be tightened before any production use.
- Deleting a link removes it from `Links` only. Its click history remains in `Clicks`.
