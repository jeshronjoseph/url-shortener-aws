# URL Shortener — Serverless on AWS

A personal URL shortener with click analytics, built entirely on AWS serverless services.

## Architecture

```
Browser → S3 (static frontend)
Browser → API Gateway (HTTP API)
              ├── POST /shorten     → Lambda: shorten   → DynamoDB (Links)
              └── GET  /{shortcode} → Lambda: redirect  → DynamoDB (Links, Clicks)
```

1. The frontend is a single static HTML page hosted on **S3**.
2. Creating a link calls **API Gateway** (`POST /shorten`), which triggers a **Lambda** function that generates a random 6-character code and writes `{shortcode, longUrl}` to a **DynamoDB** table (`Links`).
3. Visiting a short link (`GET /{shortcode}`) triggers a second **Lambda**, which looks up the long URL in `Links`, logs the click (timestamp + user agent) to a second table (`Clicks`), atomically increments a click counter on the `Links` row, and returns an HTTP 302 redirect.

## Tech stack

- **AWS Lambda** (Node.js 24.x) — `shorten` and `redirect` functions
- **API Gateway** (HTTP API) — routes `POST /shorten` and `GET /{shortcode}`
- **DynamoDB** — two on-demand tables: `Links` (shortcode → longUrl) and `Clicks` (click log)
- **S3** — static website hosting for the frontend
- **IAM** — a scoped execution role granting Lambda only `GetItem`, `PutItem`, and `UpdateItem` on the two tables 

## Repo structure

```
frontend/           Static HTML/JS frontend (upload directly to an S3 bucket)
lambdas/shorten/    Lambda that creates a new short link
lambdas/redirect/   Lambda that resolves a short link and logs the click
iam/                IAM policy JSON for the Lambda execution role
```

## Deploying your own copy

1. **DynamoDB** — create two tables:
   - `Links`: partition key `shortcode` (String)
   - `Clicks`: partition key `shortcode` (String), sort key `timestamp` (String)
2. **IAM role** — create a Lambda execution role, attach `AWSLambdaBasicExecutionRole`, and add the inline policy from `iam/dynamodb-policy.json`.
3. **Lambda functions** — create `shorten-url` and `redirect-url` (Node.js 20.x), using the role above, and paste in the code from `lambdas/shorten/index.mjs` and `lambdas/redirect/index.mjs`.
4. **API Gateway** — create an HTTP API with two routes:
   - `POST /shorten` → `shorten-url`
   - `GET /{shortcode}` → `redirect-url`
   Enable CORS (`Access-Control-Allow-Origin: *`, methods `GET, POST, OPTIONS`, headers `Content-Type`).
5. **Frontend** — in `frontend/index.html`, replace `API_GATEWAY_INVOKE_URL` with your API Gateway invoke URL, then upload the file to an S3 bucket with static website hosting enabled and a public-read bucket policy.

