/**
 * Cloudflare Worker for Repo Timeline API
 *
 * Provides cached GitHub commit data from default branch with opportunistic background updates
 */

import type { Env } from "./types";
import { TokenRotator } from "./utils/tokenRotator";
import {
	getCachedData,
	clearCache,
	fetchAndCacheRepo,
	updateRepoData,
	getCachedCommits,
	fetchAndCacheCommits,
	updateCommitData,
} from "./db/operations";
import { fetchMergedPRs } from "./api/github";
import { handleCacheStatusRequest } from "./handlers/cache";
import { handleRepoSummaryRequest } from "./handlers/summary";
import { handleMetadataRequest } from "./handlers/metadata";
import { handleSinglePRRequest } from "./handlers/pr";

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

		// API endpoint: /api/repo/:owner/:repo/cache (cache status only - instant!)
		const cacheMatch = url.pathname.match(
			/^\/api\/repo\/([^/]+)\/([^/]+)\/cache$/,
		);
		if (cacheMatch) {
			const [, owner, repo] = cacheMatch;
			return handleCacheStatusRequest(env, ctx, owner, repo, corsHeaders);
		}

		// API endpoint: /api/repo/:owner/:repo/summary (GitHub repo summary - fast)
		const summaryMatch = url.pathname.match(
			/^\/api\/repo\/([^/]+)\/([^/]+)\/summary$/,
		);
		if (summaryMatch) {
			const [, owner, repo] = summaryMatch;
			return handleRepoSummaryRequest(
				env,
				ctx,
				tokenRotator.getNextToken(),
				owner,
				repo,
				corsHeaders,
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

		// API endpoint: /api/repo/:owner/:repo/pr/:number (single PR with files)
		const prMatch = url.pathname.match(
			/^\/api\/repo\/([^/]+)\/([^/]+)\/pr\/(\d+)$/,
		);
		if (prMatch) {
			const [, owner, repo, prNumber] = prMatch;
			return handleSinglePRRequest(
				env,
				owner,
				repo,
				Number.parseInt(prNumber),
				corsHeaders,
			);
		}

		// API endpoint: /api/repo/:owner/:repo (full data with commits and files)
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

		// Get pagination parameters
		const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);
		const limit = Number.parseInt(url.searchParams.get("limit") || "40", 10);

		try {
			// Clear cache if force refresh requested
			if (forceRefresh) {
				console.log(`Force refresh requested for ${fullName}, clearing cache`);
				await clearCache(env.DB, fullName);
			}

			// Get cached commit data immediately
			const cached = forceRefresh
				? null
				: await getCachedCommits(env.DB, fullName);

			if (cached) {
				console.log(
					`Serving cached data for ${fullName} (${cached.commits.length} commits)`,
				);

				// Apply pagination to cached data
				const paginatedCommits = cached.commits.slice(offset, offset + limit);
				// hasMore is true if either:
			// 1. There are more cached commits to paginate through, OR
			// 2. There are more commits available from GitHub than we've cached
			const hasMore =
				(offset + limit < cached.commits.length) ||
				(cached.totalCommitsAvailable > cached.commits.length);

				// Trigger background update if cache is old (> 1 hour)
				const cacheAge = Date.now() / 1000 - cached.lastUpdated;
				if (cacheAge > 3600) {
					console.log(
						`Cache is ${Math.round(cacheAge / 60)} minutes old, triggering background update`,
					);
					ctx.waitUntil(
						updateCommitData(
							env.DB,
							tokenRotator.getNextToken(),
							owner,
							repo,
							cached.lastCommitSha,
							cached.defaultBranch,
						),
					);
				}

				return new Response(JSON.stringify(paginatedCommits), {
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
						"X-Cache": "HIT",
						"X-Cache-Age": Math.round(cacheAge).toString(),
						"X-Total-Count": Math.max(cached.commits.length, cached.totalCommitsAvailable).toString(),
						"X-Has-More": hasMore.toString(),
						"X-Offset": offset.toString(),
						"X-Limit": limit.toString(),
					},
				});
			}

			// No cache - fetch synchronously for first request
			console.log(`No cache for ${fullName}, fetching commits from GitHub`);
			const result = await fetchAndCacheCommits(
				env.DB,
				tokenRotator.getNextToken(),
				owner,
				repo,
			);

			// Apply pagination
			const paginatedCommits = result.commits.slice(offset, offset + limit);
			// hasMore is true if either:
			// 1. There are more cached commits to paginate through, OR
			// 2. There are more commits available from GitHub than we've cached
			const hasMore =
				offset + limit < result.commits.length ||
				result.totalCommitsAvailable > result.commits.length;

			return new Response(JSON.stringify(paginatedCommits), {
				headers: {
					...corsHeaders,
					"Content-Type": "application/json",
					"X-Cache": "MISS",
					"X-Total-Count": Math.max(
						result.commits.length,
						result.totalCommitsAvailable,
					).toString(),
					"X-Has-More": hasMore.toString(),
					"X-Offset": offset.toString(),
					"X-Limit": limit.toString(),
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
