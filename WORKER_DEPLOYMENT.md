# Cloudflare Worker Deployment Guide

Quick guide to deploy the Repo Timeline API worker.

## Prerequisites

- Cloudflare account (free tier works fine)
- GitHub Personal Access Token with `public_repo` scope

## Step-by-Step Deployment

### 1. Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Navigate to Worker Directory

```bash
cd worker
npm install
```

### 3. Create D1 Database

```bash
npx wrangler d1 create repo_timeline
```

**Output will look like:**
```
✅ Successfully created DB 'repo_timeline'

[[d1_databases]]
binding = "DB"
database_name = "repo_timeline"
database_id = "xxxx-xxxx-xxxx-xxxx"
```

**Copy the `database_id`** and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "repo_timeline"
database_id = "paste-your-id-here"  # <-- Update this line
```

### 4. Run Database Migrations

```bash
# Apply migrations to production
npx wrangler d1 migrations apply repo_timeline --remote
```

### 5. Set GitHub Token Secret

Create a token at: https://github.com/settings/tokens/new?scopes=public_repo

Then set it:

```bash
npx wrangler secret put GITHUB_TOKEN
# Paste your token when prompted
```

### 6. Deploy Worker

```bash
npm run deploy
```

**Success!** Your worker is now deployed. The output will show your worker URL:

```
Published repo-timeline-api
  https://repo-timeline-api.your-subdomain.workers.dev
```

### 7. Test the Worker

```bash
# Health check
curl https://repo-timeline-api.your-subdomain.workers.dev/health

# Test with a repo
curl https://repo-timeline-api.your-subdomain.workers.dev/api/repo/facebook/react
```

### 8. Update Frontend

Update your frontend to use the worker URL instead of GitHub API:

In `src/services/githubApiService.ts`, change:

```typescript
// Add worker URL as optional parameter
constructor(repoPath: string, token?: string, workerUrl?: string) {
  this.workerUrl = workerUrl || null;
  // ... existing code
}

// In fetch methods, use worker if available
async fetchMergedPRs() {
  const url = this.workerUrl
    ? `${this.workerUrl}/api/repo/${this.owner}/${this.repo}`
    : `https://api.github.com/repos/${this.owner}/${this.repo}/pulls`;
  // ... rest of code
}
```

## Monitoring

### View Logs

```bash
npx wrangler tail
```

### Query Database

```bash
# See all repos
npx wrangler d1 execute repo_timeline --remote \
  --command "SELECT full_name, last_pr_number, datetime(last_updated, 'unixepoch') as last_updated FROM repos"

# Count PRs per repo
npx wrangler d1 execute repo_timeline --remote \
  --command "SELECT r.full_name, COUNT(pr.id) as pr_count FROM repos r LEFT JOIN pull_requests pr ON r.id = pr.repo_id GROUP BY r.id"

# See recent PRs
npx wrangler d1 execute repo_timeline --remote \
  --command "SELECT pr.title, pr.author, datetime(pr.merged_at, 'unixepoch') as merged_at FROM pull_requests pr ORDER BY pr.merged_at DESC LIMIT 10"
```

### Check Metrics

Visit: https://dash.cloudflare.com/
- Workers & Pages → Your Worker → Metrics

## Cost Estimate

With Cloudflare's free tier:
- **100,000 requests/day** (more than enough)
- **D1: 5GB storage** (~5 million PRs)
- **5 million row reads/day**

Expected actual usage: **$0/month** for most cases

## Troubleshooting

### "Database not found"
- Make sure you ran migrations: `npm run db:migrate`
- Check `database_id` in `wrangler.toml` matches your D1 database

### "GitHub API rate limit exceeded"
- Your token may not be set: `npx wrangler secret list`
- Set it: `npx wrangler secret put GITHUB_TOKEN`

### "CORS error" in browser
- Worker includes CORS headers, but check browser console
- Make sure you're calling `/api/repo/:owner/:repo` endpoint

### Slow responses
- First request to a repo will be slow (fetching from GitHub)
- Subsequent requests should be <100ms (cached)
- Check cache hit rate: Look for `X-Cache: HIT` header

## Local Development

```bash
# Start local dev server with D1
npm run dev
```

Access at: http://localhost:8787

Note: Uses local D1 instance, separate from production

## Updating

To update the worker code:

```bash
# Pull latest changes
git pull

cd worker

# Deploy update
npm run deploy
```

Migrations are automatic if you add new ones.

## Next Steps

Once deployed:
1. Update frontend to use worker URL
2. Remove GitHub token requirement from UI
3. Test with various repos
4. Monitor usage in Cloudflare dashboard
5. Consider adding analytics/metrics
