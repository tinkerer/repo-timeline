/**
 * Cache endpoint handlers
 * Handles cache status checking and triggering background updates
 */

import type { Env } from "../types";
import { TokenRotator } from "../utils/tokenRotator";
import { getCachedData } from "../db/operations";
import { fetchAndCachePartialRepo } from "../db/operations";
import { fetchMergedPRs } from "../api/github";

/**
 * Handle cache status request - INSTANT response, just D1 query
 * Also triggers background cache population if needed
 */
export async function handleCacheStatusRequest(
	env: Env,
	ctx: ExecutionContext,
	owner: string,
	repo: string,
	corsHeaders: Record<string, string>,
): Promise<Response> {
	const fullName = `${owner}/${repo}`;

	try {
		// Get cache status (instant D1 query)
		const cached = await getCachedData(env.DB, fullName);
		const cachedPRCount = cached ? cached.prs.length : 0;
		const cacheAge = cached ? Date.now() / 1000 - cached.lastUpdated : null;

		// Get metadata from cache if available
		const firstPR = cached?.prs[0];
		const lastPR = cached?.prs[cachedPRCount - 1];

		// Trigger background cache population if cache is empty or old
		const tokenRotator = new TokenRotator(env.GITHUB_TOKENS);
		if (!cached || (cacheAge && cacheAge > 3600)) {
			console.log(
				`Cache ${!cached ? "missing" : "old"} for ${fullName}, triggering background fetch`,
			);
			ctx.waitUntil(
				fetchAndCachePartialRepo(
					env.DB,
					tokenRotator.getNextToken(),
					owner,
					repo,
					cached?.lastPrNumber || 0,
					45, // Fetch up to 45 PRs (subrequest limit)
					fetchMergedPRs,
				),
			);
		}

		const response = {
			owner,
			repo,
			cache: {
				exists: !!cached,
				cachedPRs: cachedPRCount,
				ageSeconds: cacheAge ? Math.round(cacheAge) : null,
				lastPRNumber: cached?.lastPrNumber || null,
				firstPR: firstPR
					? {
							number: firstPR.number,
							merged_at: firstPR.merged_at,
						}
					: null,
				lastPR: lastPR
					? {
							number: lastPR.number,
							merged_at: lastPR.merged_at,
						}
					: null,
			},
			status: !cached ? "fetching" : cachedPRCount < 10 ? "partial" : "ready",
		};

		return new Response(JSON.stringify(response), {
			headers: {
				...corsHeaders,
				"Content-Type": "application/json",
				"X-Cache-Hit": cached ? "true" : "false",
			},
		});
	} catch (error) {
		console.error("Error checking cache:", error);
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
