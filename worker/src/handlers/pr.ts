/**
 * PR endpoint handlers
 * Handles fetching individual PRs with file information
 */

import type { Env } from "../types";
import { TokenRotator } from "../utils/tokenRotator";
import { getCachedData } from "../db/operations";
import { fetchSinglePR, fetchPRFiles } from "../api/github";

/**
 * Handle single PR request - returns one PR with files from cache or fetches from GitHub
 */
export async function handleSinglePRRequest(
	env: Env,
	owner: string,
	repo: string,
	prNumber: number,
	corsHeaders: Record<string, string>,
): Promise<Response> {
	const fullName = `${owner}/${repo}`;
	const tokenRotator = new TokenRotator(env.GITHUB_TOKENS);

	try {
		// First check cache for this specific PR
		const cached = await getCachedData(env.DB, fullName);
		if (cached) {
			const cachedPR = cached.prs.find((pr) => pr.number === prNumber);
			if (cachedPR && cachedPR.files) {
				console.log(`Cache hit for ${fullName} PR #${prNumber}`);
				return new Response(JSON.stringify(cachedPR), {
					headers: {
						...corsHeaders,
						"Content-Type": "application/json",
						"X-Cache-Hit": "true",
					},
				});
			}
		}

		// Not in cache or cache doesn't have files - fetch from GitHub
		console.log(`Fetching ${fullName} PR #${prNumber} from GitHub`);
		const pr = await fetchSinglePR(
			tokenRotator.getNextToken(),
			owner,
			repo,
			prNumber,
		);

		if (!pr || !pr.merged_at) {
			return new Response(
				JSON.stringify({
					error: `PR #${prNumber} not found or not merged`,
				}),
				{
					status: 404,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				},
			);
		}

		// Fetch files for this PR
		const files = await fetchPRFiles(
			tokenRotator.getNextToken(),
			owner,
			repo,
			prNumber,
		);

		const prWithFiles = {
			...pr,
			files,
		};

		return new Response(JSON.stringify(prWithFiles), {
			headers: {
				...corsHeaders,
				"Content-Type": "application/json",
				"X-Cache-Hit": "false",
			},
		});
	} catch (error) {
		console.error(`Error fetching PR #${prNumber}:`, error);
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
