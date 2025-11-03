/**
 * Cloudflare Worker for Repo Timeline API
 *
 * Provides cached GitHub PR data with opportunistic background updates
 */

interface Env {
	DB: D1Database;
	GITHUB_TOKENS: string; // Comma-separated list of tokens
}

// Token rotation state (persisted in D1)
class TokenRotator {
	private tokens: string[];
	private currentIndex = 0;

	constructor(tokensString: string) {
		this.tokens = tokensString
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);
		if (this.tokens.length === 0) {
			throw new Error("No GitHub tokens configured");
		}
		console.log(`Initialized with ${this.tokens.length} GitHub token(s)`);
	}

	getNextToken(): string {
		const token = this.tokens[this.currentIndex];
		this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
		return token;
	}

	getTokenCount(): number {
		return this.tokens.length;
	}
}

interface PRFile {
	filename: string;
	status: string;
	additions: number;
	deletions: number;
	previous_filename?: string;
}

interface PullRequest {
	number: number;
	title: string;
	user: { login: string };
	merged_at: string;
	merge_commit_sha?: string;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		// CORS headers for browser requests
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);

		// Initialize token rotator
		const tokenRotator = new TokenRotator(env.GITHUB_TOKENS);

		// Health check endpoint
		if (url.pathname === "/health") {
			return new Response(
				JSON.stringify({
					status: "ok",
					tokens: tokenRotator.getTokenCount(),
				}),
				{
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				},
			);
		}

		// API endpoint: /api/repo/:owner/:repo/metadata (PR list without files)
		const metadataMatch = url.pathname.match(
			/^\/api\/repo\/([^/]+)\/([^/]+)\/metadata$/,
		);
		if (metadataMatch) {
			const [, owner, repo] = metadataMatch;
			return handleMetadataRequest(env, owner, repo, corsHeaders);
		}

		// API endpoint: /api/repo/:owner/:repo (full data with files)
		const match = url.pathname.match(/^\/api\/repo\/([^/]+)\/([^/]+)$/);
		if (!match) {
			return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
				status: 404,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}

		const [, owner, repo] = match;
		const fullName = `${owner}/${repo}`;

		// Check for force refresh parameter
		const forceRefresh = url.searchParams.get("refresh") === "true";

		try {
			// Clear cache if force refresh requested
			if (forceRefresh) {
				console.log(`Force refresh requested for ${fullName}, clearing cache`);
				await clearRepoCache(env.DB, fullName);
			}

			// Get cached data immediately
			const cached = forceRefresh ? null : await getCachedData(env.DB, fullName);

			if (cached) {
				console.log(
					`Serving cached data for ${fullName} (${cached.prs.length} PRs)`,
				);

				// Trigger background update if cache is old (> 1 hour)
				const cacheAge = Date.now() / 1000 - cached.lastUpdated;
				if (cacheAge > 3600) {
					console.log(
						`Cache is ${Math.round(cacheAge / 60)} minutes old, triggering background update`,
					);
					ctx.waitUntil(
						updateRepoData(
							env.DB,
							tokenRotator.getNextToken(),
							owner,
							repo,
							cached.lastPrNumber,
						),
					);
				}

				return new Response(JSON.stringify(cached.prs), {
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
						"X-Cache": "HIT",
						"X-Cache-Age": Math.round(cacheAge).toString(),
					},
				});
			}

			// No cache - fetch synchronously for first request
			console.log(`No cache for ${fullName}, fetching from GitHub`);
			const prs = await fetchAndCacheRepo(
				env.DB,
				tokenRotator.getNextToken(),
				owner,
				repo,
			);

			return new Response(JSON.stringify(prs), {
				headers: {
					...corsHeaders,
					"Content-Type": "application/json",
					"X-Cache": "MISS",
				},
			});
		} catch (error) {
			console.error("Error processing request:", error);
			return new Response(
				JSON.stringify({
					error:
						error instanceof Error ? error.message : "Internal server error",
				}),
				{
					status: 500,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				},
			);
		}
	},
};

/**
 * Handle metadata-only request (all PRs without files)
 */
async function handleMetadataRequest(
	env: Env,
	owner: string,
	repo: string,
	corsHeaders: Record<string, string>,
): Promise<Response> {
	const fullName = `${owner}/${repo}`;
	const tokenRotator = new TokenRotator(env.GITHUB_TOKENS);

	try {
		// Fetch all merged PRs without files (fast!)
		const prs = await fetchAllMergedPRsMetadata(
			tokenRotator.getNextToken(),
			owner,
			repo,
		);

		return new Response(JSON.stringify(prs), {
			headers: {
				...corsHeaders,
				"Content-Type": "application/json",
				"X-Metadata-Only": "true",
			},
		});
	} catch (error) {
		console.error("Error fetching metadata:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal server error",
			}),
			{
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			},
		);
	}
}

/**
 * Clear cached data for a repo
 */
async function clearRepoCache(
	db: D1Database,
	fullName: string,
): Promise<void> {
	const repo = await db
		.prepare("SELECT id FROM repos WHERE full_name = ?")
		.bind(fullName)
		.first();

	if (!repo) {
		return; // No cache to clear
	}

	// Delete all files for this repo's PRs
	await db
		.prepare(
			`DELETE FROM pr_files WHERE pr_id IN (SELECT id FROM pull_requests WHERE repo_id = ?)`,
		)
		.bind(repo.id)
		.run();

	// Delete all PRs for this repo
	await db
		.prepare("DELETE FROM pull_requests WHERE repo_id = ?")
		.bind(repo.id)
		.run();

	// Delete the repo record
	await db.prepare("DELETE FROM repos WHERE id = ?").bind(repo.id).run();

	console.log(`Cleared cache for ${fullName}`);
}

/**
 * Get cached data from D1
 */
async function getCachedData(
	db: D1Database,
	fullName: string,
): Promise<{
	prs: any[];
	lastUpdated: number;
	lastPrNumber: number;
} | null> {
	// Get repo metadata
	const repo = await db
		.prepare(
			"SELECT id, last_updated, last_pr_number FROM repos WHERE full_name = ?",
		)
		.bind(fullName)
		.first();

	if (!repo) {
		return null;
	}

	// Get all PRs
	const prs = await db
		.prepare(`
		SELECT pr_number, title, author, merged_at, merge_commit_sha, id
		FROM pull_requests
		WHERE repo_id = ?
		ORDER BY merged_at ASC
	`)
		.bind(repo.id)
		.all();

	if (!prs.results || prs.results.length === 0) {
		return null;
	}

	// Transform data to match GitHub API format
	const transformedPRs = await Promise.all(
		prs.results.map(async (pr: any) => {
			// Get files for this PR
			const filesResult = await db
				.prepare(`
			SELECT filename, status, additions, deletions, previous_filename
			FROM pr_files
			WHERE pr_id = ?
		`)
				.bind(pr.id)
				.all();

			const files = filesResult.results || [];

			return {
				number: pr.pr_number,
				title: pr.title,
				user: { login: pr.author },
				merged_at: new Date(pr.merged_at * 1000).toISOString(),
				merge_commit_sha: pr.merge_commit_sha,
				files: files,
			};
		}),
	);

	return {
		prs: transformedPRs,
		lastUpdated: repo.last_updated,
		lastPrNumber: repo.last_pr_number,
	};
}

/**
 * Fetch repo data from GitHub and cache it
 */
async function fetchAndCacheRepo(
	db: D1Database,
	token: string,
	owner: string,
	repo: string,
): Promise<any[]> {
	const fullName = `${owner}/${repo}`;

	// Fetch merged PRs from GitHub
	const prs = await fetchMergedPRs(token, owner, repo);

	if (prs.length === 0) {
		return [];
	}

	// Store in database
	await storeRepoData(db, owner, repo, prs);

	return prs;
}

/**
 * Update repo data in background (opportunistic)
 */
async function updateRepoData(
	db: D1Database,
	token: string,
	owner: string,
	repo: string,
	lastPrNumber: number,
): Promise<void> {
	try {
		console.log(
			`Background update for ${owner}/${repo} from PR #${lastPrNumber + 1}`,
		);

		// Fetch only new PRs since last update
		const newPRs = await fetchMergedPRs(token, owner, repo, lastPrNumber + 1);

		if (newPRs.length > 0) {
			console.log(`Found ${newPRs.length} new PRs, updating cache`);
			await storeRepoData(db, owner, repo, newPRs, true);
		} else {
			console.log("No new PRs, cache is up to date");
			// Update timestamp anyway
			await db
				.prepare(
					"UPDATE repos SET last_updated = ? WHERE owner = ? AND name = ?",
				)
				.bind(Math.floor(Date.now() / 1000), owner, repo)
				.run();
		}
	} catch (error) {
		console.error("Error in background update:", error);
	}
}

/**
 * Fetch all merged PRs metadata only (no files) - fast!
 */
async function fetchAllMergedPRsMetadata(
	token: string,
	owner: string,
	repo: string,
): Promise<any[]> {
	const allPRs: any[] = [];
	let page = 1;
	const perPage = 100;
	const maxPages = 100; // Can fetch many pages since no file requests

	console.log(`Fetching metadata for ${owner}/${repo}`);

	while (page <= maxPages) {
		const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=${perPage}&page=${page}&sort=created&direction=asc`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "Repo-Timeline-Worker",
			},
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error(`Repository ${owner}/${repo} not found`);
			}
			if (response.status === 403) {
				throw new Error("GitHub API rate limit exceeded");
			}
			throw new Error(`GitHub API error: ${response.status}`);
		}

		const prs: PullRequest[] = await response.json();

		if (prs.length === 0) {
			break;
		}

		// Filter for merged PRs and transform to simple format
		const mergedPRs = prs
			.filter((pr) => pr.merged_at)
			.map((pr) => ({
				number: pr.number,
				title: pr.title,
				user: { login: pr.user.login },
				merged_at: pr.merged_at,
				merge_commit_sha: pr.merge_commit_sha,
			}));

		allPRs.push(...mergedPRs);

		// If we got fewer PRs than requested, we're done
		if (prs.length < perPage) {
			break;
		}

		page++;
	}

	console.log(`Fetched ${allPRs.length} PRs metadata for ${owner}/${repo}`);
	return allPRs;
}

/**
 * Fetch merged PRs from GitHub API (with files)
 */
async function fetchMergedPRs(
	token: string,
	owner: string,
	repo: string,
	sinceNumber?: number,
	maxPages: number = 10, // Fetch up to 1000 PRs (100 per page)
): Promise<any[]> {
	const allPRs: any[] = [];
	let page = 1;
	const perPage = 100;

	while (page <= maxPages) {
		const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=${perPage}&page=${page}&sort=created&direction=asc`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "Repo-Timeline-Worker",
			},
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error(`Repository ${owner}/${repo} not found`);
			}
			if (response.status === 403) {
				throw new Error("GitHub API rate limit exceeded");
			}
			throw new Error(`GitHub API error: ${response.status}`);
		}

		const prs: PullRequest[] = await response.json();

		if (prs.length === 0) {
			break;
		}

		// Filter for merged PRs
		const mergedPRs = prs.filter((pr) => pr.merged_at);

		// If we're doing incremental update, skip PRs we already have
		const newPRs = sinceNumber
			? mergedPRs.filter((pr) => pr.number >= sinceNumber)
			: mergedPRs;

		// Limit total PRs to avoid subrequest limit (50 per worker invocation)
		const prLimit = 45; // Leave room for other requests (PR list + up to 45 file requests)
		const prsToFetch =
			allPRs.length + newPRs.length > prLimit
				? newPRs.slice(0, prLimit - allPRs.length)
				: newPRs;

		// Fetch files for each PR
		for (const pr of prsToFetch) {
			const filesUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/files`;
			const filesResponse = await fetch(filesUrl, {
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github.v3+json",
					"User-Agent": "Repo-Timeline-Worker",
				},
			});

			if (filesResponse.ok) {
				const files: PRFile[] = await filesResponse.json();
				allPRs.push({ ...pr, files });
			} else {
				console.error(`Failed to fetch files for PR #${pr.number}`);
				allPRs.push({ ...pr, files: [] });
			}
		}

		// If we hit the PR limit, stop fetching more pages
		if (allPRs.length >= prLimit) {
			console.log(`Hit PR limit of ${prLimit}, stopping pagination`);
			break;
		}

		// If we got fewer PRs than requested, we're done
		if (prs.length < perPage) {
			break;
		}

		page++;
	}

	return allPRs;
}

/**
 * Store repo data in D1
 */
async function storeRepoData(
	db: D1Database,
	owner: string,
	name: string,
	prs: any[],
	isUpdate = false,
): Promise<void> {
	const fullName = `${owner}/${name}`;
	const now = Math.floor(Date.now() / 1000);

	// Insert or update repo first
	if (isUpdate) {
		const lastPrNumber = Math.max(...prs.map((pr) => pr.number));
		await db
			.prepare(
				"UPDATE repos SET last_updated = ?, last_pr_number = ? WHERE full_name = ?",
			)
			.bind(now, lastPrNumber, fullName)
			.run();
	} else {
		await db
			.prepare(`
			INSERT INTO repos (owner, name, full_name, last_updated, last_pr_number, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(full_name) DO UPDATE SET last_updated = ?, last_pr_number = ?
		`)
			.bind(
				owner,
				name,
				fullName,
				now,
				prs.length > 0 ? Math.max(...prs.map((pr) => pr.number)) : 0,
				now,
				now,
				prs.length > 0 ? Math.max(...prs.map((pr) => pr.number)) : 0,
			)
			.run();
	}

	// Get repo ID
	const repo = await db
		.prepare("SELECT id FROM repos WHERE full_name = ?")
		.bind(fullName)
		.first();

	if (!repo) {
		throw new Error("Failed to get repo ID");
	}

	// Insert PRs and their files
	for (const pr of prs) {
		// Insert PR first
		await db
			.prepare(`
			INSERT INTO pull_requests (repo_id, pr_number, title, author, merged_at, merge_commit_sha, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(repo_id, pr_number) DO NOTHING
		`)
			.bind(
				repo.id,
				pr.number,
				pr.title,
				pr.user.login,
				Math.floor(new Date(pr.merged_at).getTime() / 1000),
				pr.merge_commit_sha || null,
				now,
			)
			.run();

		// Get PR ID
		const prRow = await db
			.prepare(
				"SELECT id FROM pull_requests WHERE repo_id = ? AND pr_number = ?",
			)
			.bind(repo.id, pr.number)
			.first();

		if (prRow && pr.files && pr.files.length > 0) {
			// Batch insert files for this PR
			const fileBatch = pr.files.map((file: any) =>
				db
					.prepare(`
					INSERT INTO pr_files (pr_id, filename, status, additions, deletions, previous_filename)
					VALUES (?, ?, ?, ?, ?, ?)
					ON CONFLICT DO NOTHING
				`)
					.bind(
						prRow.id,
						file.filename,
						file.status,
						file.additions || 0,
						file.deletions || 0,
						file.previous_filename || null,
					),
			);

			await db.batch(fileBatch);
		}
	}

	console.log(`Stored ${prs.length} PRs for ${fullName}`);
}
