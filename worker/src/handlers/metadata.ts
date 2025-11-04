/**
 * Metadata endpoint handler
 * Handles fetching PR metadata without files
 */

import type { Env } from "../types";
import { TokenRotator } from "../utils/tokenRotator";
import { fetchAllMergedPRsMetadata } from "../api/github";

/**
 * Handle metadata request - fetches all merged PRs without files (fast!)
 */
export async function handleMetadataRequest(
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
