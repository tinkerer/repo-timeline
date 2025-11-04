/**
 * GitHub API interaction functions
 * Handles fetching PR data, files, and metadata from GitHub REST API
 */

import type { PRFile, PullRequest } from "../types";

/**
 * Fetch a single PR from GitHub
 */
export async function fetchSinglePR(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
): Promise<PullRequest | null> {
	const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "Repo-Timeline-Worker",
		},
	});

	if (!response.ok) {
		if (response.status === 404) {
			return null;
		}
		throw new Error(`GitHub API error: ${response.status}`);
	}

	return await response.json();
}

/**
 * Fetch files for a specific PR
 */
export async function fetchPRFiles(
	token: string,
	owner: string,
	repo: string,
	prNumber: number,
): Promise<PRFile[]> {
	const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "Repo-Timeline-Worker",
		},
	});

	if (!response.ok) {
		throw new Error(`GitHub API error: ${response.status}`);
	}

	return await response.json();
}

/**
 * Fetch all merged PRs metadata only (no files) - fast!
 */
export async function fetchAllMergedPRsMetadata(
	token: string,
	owner: string,
	repo: string,
): Promise<any[]> {
	const allPRs: any[] = [];
	let page = 1;
	const perPage = 100;
	const maxPages = 50; // Cloudflare Workers subrequest limit

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
export async function fetchMergedPRs(
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
