/**
 * Summary endpoint handler
 * Returns quick repository statistics from GitHub API
 */

import type { Env, PullRequest } from "../types";

/**
 * Handle repo summary request - Fast GitHub API check (just first page)
 * Returns quick stats about the repo from GitHub
 */
export async function handleRepoSummaryRequest(
	env: Env,
	ctx: ExecutionContext,
	token: string,
	owner: string,
	repo: string,
	corsHeaders: Record<string, string>,
): Promise<Response> {
	try {
		// Fetch just first page to get basic stats
		const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=100&page=1&sort=created&direction=asc`;

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
		const mergedPRs = prs.filter((pr) => pr.merged_at);

		// Estimate total from Link header if available
		const linkHeader = response.headers.get("Link");
		let estimatedTotal = mergedPRs.length;
		if (linkHeader && linkHeader.includes('rel="last"')) {
			const match = linkHeader.match(/page=(\d+)>; rel="last"/);
			if (match) {
				estimatedTotal = Number.parseInt(match[1]) * 70; // Rough estimate
			}
		}

		const summary = {
			owner,
			repo,
			github: {
				estimatedTotalPRs: estimatedTotal,
				hasMoreThan100PRs: !!linkHeader && linkHeader.includes('rel="last"'),
				firstMergedPR: mergedPRs[0]
					? {
							number: mergedPRs[0].number,
							merged_at: mergedPRs[0].merged_at,
						}
					: null,
			},
		};

		return new Response(JSON.stringify(summary), {
			headers: {
				...corsHeaders,
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Error fetching summary:", error);
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
