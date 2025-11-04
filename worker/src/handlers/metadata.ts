/**
 * Metadata endpoint handler
 * Handles fetching commit metadata without file details
 */

import type { Env } from "../types";
import { TokenRotator } from "../utils/tokenRotator";
import { fetchRepoInfo, fetchCommits } from "../api/github";

/**
 * Handle metadata request - fetches all commits without file details (fast!)
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
		// Get repository default branch
		const repoInfo = await fetchRepoInfo(
			tokenRotator.getNextToken(),
			owner,
			repo,
		);

		// Fetch commits without file details (fast!)
		const commits = await fetchCommits(
			tokenRotator.getNextToken(),
			owner,
			repo,
			repoInfo.default_branch,
			undefined,
			5, // Fetch up to 5 pages (500 commits)
		);

		// Return commits with basic metadata only (no files)
		const metadata = commits.map((commit) => ({
			sha: commit.sha,
			message: commit.commit?.message || "",
			author: commit.commit?.author?.name || "",
			date: commit.commit?.author?.date || "",
		}));

		return new Response(JSON.stringify(metadata), {
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
