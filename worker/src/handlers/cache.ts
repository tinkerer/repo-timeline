/**
 * Cache endpoint handlers
 * Handles cache status checking and triggering background updates
 */

import type { Env } from "../types";
import { TokenRotator } from "../utils/tokenRotator";
import { getCachedCommits, fetchAndCacheCommits } from "../db/operations";

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
		const cached = await getCachedCommits(env.DB, fullName);
		const cachedCommitCount = cached ? cached.commits.length : 0;
		const cacheAge = cached ? Date.now() / 1000 - cached.lastUpdated : null;

		// Get metadata from cache if available
		const firstCommit = cached?.commits[0];
		const lastCommit = cached?.commits[cachedCommitCount - 1];

		// Trigger background cache population if cache is empty or old
		const tokenRotator = new TokenRotator(env.GITHUB_TOKENS);
		if (!cached || (cacheAge && cacheAge > 3600)) {
			console.log(
				`Cache ${!cached ? "missing" : "old"} for ${fullName}, triggering background fetch`,
			);
			ctx.waitUntil(
				fetchAndCacheCommits(
					env.DB,
					tokenRotator.getNextToken(),
					owner,
					repo,
				),
			);
		}

		const response = {
			owner,
			repo,
			cache: {
				exists: !!cached,
				cachedCommits: cachedCommitCount,
				ageSeconds: cacheAge ? Math.round(cacheAge) : null,
				lastCommitSha: cached?.lastCommitSha || null,
				defaultBranch: cached?.defaultBranch || null,
				firstCommit: firstCommit
					? {
							sha: firstCommit.sha.substring(0, 7),
							date: firstCommit.commit.author.date,
						}
					: null,
				lastCommit: lastCommit
					? {
							sha: lastCommit.sha.substring(0, 7),
							date: lastCommit.commit.author.date,
						}
					: null,
			},
			status: !cached ? "fetching" : cachedCommitCount < 10 ? "partial" : "ready",
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
