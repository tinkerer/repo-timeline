/**
 * GitHub API interaction functions
 * Handles fetching PR data, files, and metadata from GitHub REST API
 */

import type { PRFile, PullRequest } from "../types";

/**
 * Fetch repository metadata including default branch
 */
export async function fetchRepoInfo(
	token: string,
	owner: string,
	repo: string,
): Promise<{ default_branch: string }> {
	const url = `https://api.github.com/repos/${owner}/${repo}`;

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
		throw new Error(`GitHub API error: ${response.status}`);
	}

	return await response.json();
}

/**
 * Get total commit count for a branch by parsing Link header
 * This is efficient - only makes 1 API call with per_page=1
 */
export async function fetchCommitCount(
	token: string,
	owner: string,
	repo: string,
	branch: string,
): Promise<number> {
	// Request just 1 commit to get Link header with pagination info
	const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=1&page=1`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "Repo-Timeline-Worker",
		},
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new Error(`Repository ${owner}/${repo} or branch ${branch} not found`);
		}
		if (response.status === 403) {
			throw new Error("GitHub API rate limit exceeded");
		}
		throw new Error(`GitHub API error: ${response.status}`);
	}

	// Parse Link header to get last page number
	// Example: Link: <https://api.github.com/repositories/123/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/123/commits?per_page=1&page=117>; rel="last"
	const linkHeader = response.headers.get("Link");

	if (!linkHeader) {
		// No Link header means there's only 1 page (1 commit total)
		const commits = await response.json();
		return commits.length;
	}

	// Parse the "last" link to get total page count
	const lastLinkMatch = linkHeader.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/);

	if (lastLinkMatch) {
		const lastPage = parseInt(lastLinkMatch[1], 10);
		// Since we requested 1 per page, last page number = total commits
		return lastPage;
	}

	// Fallback: no "last" link means we're on the last page
	const commits = await response.json();
	return commits.length;
}

/**
 * Fetch commits from default branch
 */
export async function fetchCommits(
	token: string,
	owner: string,
	repo: string,
	branch: string,
	sinceCommit?: string,
	maxPages: number = 10,
): Promise<any[]> {
	const allCommits: any[] = [];
	let page = 1;
	const perPage = 100;

	console.log(`Fetching commits from ${owner}/${repo}@${branch}`);

	while (page <= maxPages) {
		const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}&page=${page}`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "Repo-Timeline-Worker",
			},
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error(`Repository ${owner}/${repo} or branch ${branch} not found`);
			}
			if (response.status === 403) {
				throw new Error("GitHub API rate limit exceeded");
			}
			throw new Error(`GitHub API error: ${response.status}`);
		}

		const commits: any[] = await response.json();

		if (commits.length === 0) {
			break;
		}

		// If we have a sinceCommit, stop when we reach it
		if (sinceCommit) {
			const sinceIndex = commits.findIndex((c) => c.sha === sinceCommit);
			if (sinceIndex >= 0) {
				allCommits.push(...commits.slice(0, sinceIndex));
				break;
			}
		}

		allCommits.push(...commits);

		// If we got fewer commits than requested, we're done
		if (commits.length < perPage) {
			break;
		}

		page++;
	}

	console.log(`Fetched ${allCommits.length} commits from ${owner}/${repo}@${branch}`);
	return allCommits;
}

/**
 * Fetch files for a specific commit
 */
export async function fetchCommitFiles(
	token: string,
	owner: string,
	repo: string,
	commitSha: string,
): Promise<any> {
	const url = `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`;

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
