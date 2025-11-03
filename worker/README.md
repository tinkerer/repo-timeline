# Repo Timeline API Worker

Cloudflare Worker that provides cached GitHub PR data for the Repo Timeline Visualizer.

## Features

- **Global caching** - All users share cached PR data in D1 database
- **Opportunistic updates** - Background updates when cache is stale (>1 hour)
- **Rate limit efficient** - Single GitHub PAT serves all users
- **Fast responses** - Serves stale data immediately while updating in background

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Create D1 Database

```bash
npx wrangler d1 create repo_timeline
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "repo_timeline"
database_id = "your-database-id-here"  # <- Add this
```

### 3. Run Migrations

```bash
# Local development
npm run db:migrate:local

# Production
npm run db:migrate
```

### 4. Set GitHub Token(s)

Create a GitHub Personal Access Token with `public_repo` scope:
https://github.com/settings/tokens/new?scopes=public_repo&description=Repo%20Timeline%20Worker

Then set it as a secret:

**Single token:**
```bash
npx wrangler secret put GITHUB_TOKENS
# Paste: ghp_yourtoken
```

**Multiple tokens (load balancing):**
```bash
npx wrangler secret put GITHUB_TOKENS
# Paste: ghp_token1,ghp_token2,ghp_token3
```

The worker will round-robin through multiple tokens, giving you:
- 1 token = 5,000 req/hour
- 2 tokens = 10,000 req/hour
- 3 tokens = 15,000 req/hour
- etc.

### 5. Deploy

```bash
npm run deploy
```

Your worker will be deployed to: `https://repo-timeline-api.<your-subdomain>.workers.dev`

## Development

```bash
# Start local dev server
npm run dev
```

Access at: `http://localhost:8787`

## API Endpoints

### Get Repo Metadata (Fast)

```
GET /api/repo/:owner/:repo/metadata
```

Returns PR list without file data - perfect for initializing timeline range.

**Example:**
```bash
curl https://repo-timeline-api.your-subdomain.workers.dev/api/repo/facebook/react/metadata
```

**Response:**
```json
[
  {
    "number": 1,
    "title": "Initial commit",
    "user": { "login": "username" },
    "merged_at": "2023-01-01T00:00:00Z"
  }
]
```

**Headers:**
- `X-Cache: HIT|MISS` - Cache status
- `X-Cache-Age: <seconds>` - Age of cached data

### Get Full Repo Timeline

```
GET /api/repo/:owner/:repo
```

Returns complete PR data including all file changes.

**Example:**
```bash
curl https://repo-timeline-api.your-subdomain.workers.dev/api/repo/facebook/react
```

**Response:**
```json
[
  {
    "number": 1,
    "title": "Initial commit",
    "user": { "login": "username" },
    "merged_at": "2023-01-01T00:00:00Z",
    "files": [
      {
        "filename": "src/index.js",
        "status": "added",
        "additions": 100,
        "deletions": 0
      }
    ]
  }
]
```

**Headers:**
- `X-Cache: HIT|MISS` - Whether data was served from cache
- `X-Cache-Age: <seconds>` - Age of cached data (only on cache hits)

### Health Check

```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "tokens": 3  // Number of tokens configured
}
```

## Database Schema

### repos
- `id` - Primary key
- `owner` - GitHub username/org
- `name` - Repository name
- `full_name` - owner/name
- `last_updated` - Unix timestamp of last update
- `last_pr_number` - Highest PR number fetched
- `created_at` - Unix timestamp of first fetch

### pull_requests
- `id` - Primary key
- `repo_id` - Foreign key to repos
- `pr_number` - GitHub PR number
- `title` - PR title
- `author` - PR author username
- `merged_at` - Unix timestamp when merged
- `created_at` - Unix timestamp of record creation

### pr_files
- `id` - Primary key
- `pr_id` - Foreign key to pull_requests
- `filename` - File path
- `status` - 'added', 'modified', 'removed', 'renamed'
- `additions` - Lines added
- `deletions` - Lines deleted
- `previous_filename` - For renamed files

## Caching Strategy

1. **First Request** - Fetches all PRs from GitHub API, stores in D1, returns data
2. **Subsequent Requests** - Returns cached data immediately
3. **Stale Cache (>1 hour)** - Returns cached data, triggers background update
4. **Background Update** - Fetches only new PRs since last update, updates D1

## Rate Limiting

- Uses your GitHub PAT (5000 requests/hour)
- Shared across all users of the worker
- 100ms delay between PR file fetches to avoid hitting limits
- Background updates don't block responses

## Cost Estimate

**Cloudflare Workers Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request

**D1 Free Tier:**
- 5GB storage
- 5 million reads/day
- 100,000 writes/day

**Expected usage:**
- Storage: ~1MB per 1000 PRs
- Reads: 1-5 per request (depending on cache)
- Writes: Only on updates

**Estimated cost:** $0-5/month for typical usage

## Monitoring

Check logs:
```bash
npx wrangler tail
```

View D1 data:
```bash
npx wrangler d1 execute repo_timeline --command "SELECT * FROM repos LIMIT 10"
```

## Update Frontend

Update `src/config.ts` with your worker URL:

```typescript
export const WORKER_URL = "https://your-worker.workers.dev";
```

The frontend automatically uses the worker when `WORKER_URL` is configured. No other changes needed!
