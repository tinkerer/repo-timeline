/**
 * Cloudflare Worker for Repo Timeline API
 *
 * Provides cached GitHub PR data with opportunistic background updates
 */

import type { Env } from "./types";
import { TokenRotator } from "./utils/tokenRotator";
import { getCachedData, clearCache, fetchAndCacheRepo, updateRepoData } from "./db/operations";
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
				await clearCache(env.DB, fullName);
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
							fetchMergedPRs,
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
				fetchMergedPRs,
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
