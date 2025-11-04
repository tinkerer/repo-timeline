/**
 * Database operations for D1
 * Handles storing and retrieving repository data from Cloudflare D1
 */

import type { Commit } from "../types";
import { fetchRepoInfo, fetchCommits, fetchCommitFiles } from "../api/github";

/**
 * Clear cached data for a repository
 */
export async function clearCache(
	db: D1Database,
	fullName: string,
): Promise<void> {
	// Get repo ID first
	const repo = await db
		.prepare("SELECT id FROM repos WHERE full_name = ?")
		.bind(fullName)
		.first();

	if (!repo) {
		console.log(`No cache found for ${fullName}`);
		return;
	}

	// Delete PR files first (foreign key constraint)
	await db
		.prepare(
			"DELETE FROM pr_files WHERE pr_id IN (SELECT id FROM pull_requests WHERE repo_id = ?)",
		)
		.bind(repo.id)
		.run();

	// Delete PRs
	await db
		.prepare("DELETE FROM pull_requests WHERE repo_id = ?")
		.bind(repo.id)
		.run();

	// Delete the repo record
	await db.prepare("DELETE FROM repos WHERE id = ?").bind(repo.id).run();

	console.log(`Cleared cache for ${fullName}`);
}

/**
 * Get cached data from D1
 */
export async function getCachedData(
	db: D1Database,
	fullName: string,
): Promise<{
	prs: any[];
	lastUpdated: number;
	lastPrNumber: number;
} | null> {
	// Get repo metadata
	const repo = await db
		.prepare(
			"SELECT id, last_updated, last_pr_number FROM repos WHERE full_name = ?",
		)
		.bind(fullName)
		.first();

	if (!repo) {
		return null;
	}

	// Get all PRs
	const prs = await db
		.prepare(`
		SELECT pr_number, title, author, merged_at, merge_commit_sha, id
		FROM pull_requests
		WHERE repo_id = ?
		ORDER BY merged_at ASC
	`)
		.bind(repo.id)
		.all();

	if (!prs.results || prs.results.length === 0) {
		return null;
	}

	// Transform data to match GitHub API format
	const transformedPRs = await Promise.all(
		prs.results.map(async (pr: any) => {
			// Get files for this PR
			const filesResult = await db
				.prepare(`
			SELECT filename, status, additions, deletions, previous_filename
			FROM pr_files
			WHERE pr_id = ?
		`)
				.bind(pr.id)
				.all();

			const files = filesResult.results || [];

			return {
				number: pr.pr_number,
				title: pr.title,
				user: { login: pr.author },
				merged_at: new Date(pr.merged_at * 1000).toISOString(),
				merge_commit_sha: pr.merge_commit_sha,
				files: files,
			};
		}),
	);

	return {
		prs: transformedPRs,
		lastUpdated: repo.last_updated,
		lastPrNumber: repo.last_pr_number,
	};
}

/**
 * Store repo data in D1
 */
export async function storeRepoData(
	db: D1Database,
	owner: string,
	name: string,
	prs: any[],
	isUpdate = false,
): Promise<void> {
	const fullName = `${owner}/${name}`;
	const now = Math.floor(Date.now() / 1000);

	// Insert or update repo first
	if (isUpdate) {
		const lastPrNumber = Math.max(...prs.map((pr) => pr.number));
		await db
			.prepare(
				"UPDATE repos SET last_updated = ?, last_pr_number = ? WHERE full_name = ?",
			)
			.bind(now, lastPrNumber, fullName)
			.run();
	} else {
		await db
			.prepare(`
			INSERT INTO repos (owner, name, full_name, last_updated, last_pr_number, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(full_name) DO UPDATE SET last_updated = ?, last_pr_number = ?
		`)
			.bind(
				owner,
				name,
				fullName,
				now,
				prs.length > 0 ? Math.max(...prs.map((pr) => pr.number)) : 0,
				now,
				now,
				prs.length > 0 ? Math.max(...prs.map((pr) => pr.number)) : 0,
			)
			.run();
	}

	// Get repo ID
	const repo = await db
		.prepare("SELECT id FROM repos WHERE full_name = ?")
		.bind(fullName)
		.first();

	if (!repo) {
		throw new Error("Failed to get repo ID");
	}

	// Insert PRs and their files
	for (const pr of prs) {
		// Insert PR first
		await db
			.prepare(`
			INSERT INTO pull_requests (repo_id, pr_number, title, author, merged_at, merge_commit_sha, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(repo_id, pr_number) DO NOTHING
		`)
			.bind(
				repo.id,
				pr.number,
				pr.title,
				pr.user.login,
				Math.floor(new Date(pr.merged_at).getTime() / 1000),
				pr.merge_commit_sha || null,
				now,
			)
			.run();

		// Get PR ID
		const prRow = await db
			.prepare(
				"SELECT id FROM pull_requests WHERE repo_id = ? AND pr_number = ?",
			)
			.bind(repo.id, pr.number)
			.first();

		if (prRow && pr.files && pr.files.length > 0) {
			// Batch insert files for this PR
			const fileBatch = pr.files.map((file: any) =>
				db
					.prepare(`
					INSERT INTO pr_files (pr_id, filename, status, additions, deletions, previous_filename)
					VALUES (?, ?, ?, ?, ?, ?)
					ON CONFLICT DO NOTHING
				`)
					.bind(
						prRow.id,
						file.filename,
						file.status,
						file.additions || 0,
						file.deletions || 0,
						file.previous_filename || null,
					),
			);

			await db.batch(fileBatch);
		}
	}

	console.log(`Stored ${prs.length} PRs for ${fullName}`);
}

/**
 * Fetch repo data from GitHub and cache it
 */
export async function fetchAndCacheRepo(
	db: D1Database,
	token: string,
	owner: string,
	repo: string,
	fetchMergedPRs: (
		token: string,
		owner: string,
		repo: string,
		sinceNumber?: number,
		maxPages?: number,
	) => Promise<any[]>,
): Promise<any[]> {
	const fullName = `${owner}/${repo}`;

	// Fetch merged PRs from GitHub
	const prs = await fetchMergedPRs(token, owner, repo);

	if (prs.length === 0) {
		return [];
	}

	// Store in database
	await storeRepoData(db, owner, repo, prs);

	return prs;
}

/**
 * Fetch a specific number of PRs and cache them (for opportunistic collection)
 */
export async function fetchAndCachePartialRepo(
	db: D1Database,
	token: string,
	owner: string,
	repo: string,
	fromPRNumber: number,
	maxPRs: number,
	fetchMergedPRs: (
		token: string,
		owner: string,
		repo: string,
		sinceNumber?: number,
		maxPages?: number,
	) => Promise<any[]>,
): Promise<void> {
	try {
		console.log(
			`Opportunistic fetch: ${maxPRs} PRs for ${owner}/${repo} from PR #${fromPRNumber + 1}`,
		);

		// Fetch specific number of PRs
		const prs = await fetchMergedPRs(
			token,
			owner,
			repo,
			fromPRNumber > 0 ? fromPRNumber + 1 : undefined,
			Math.ceil(maxPRs / 100), // Calculate pages needed
		);

		// Limit to requested count
		const prsToStore = prs.slice(0, maxPRs);

		if (prsToStore.length > 0) {
			console.log(`Caching ${prsToStore.length} PRs opportunistically`);
			await storeRepoData(db, owner, repo, prsToStore, fromPRNumber > 0);
		}
	} catch (error) {
		console.error("Error in opportunistic fetch:", error);
	}
}

/**
 * Update repo data in background (opportunistic)
 */
export async function updateRepoData(
	db: D1Database,
	token: string,
	owner: string,
	repo: string,
	lastPrNumber: number,
	fetchMergedPRs: (
		token: string,
		owner: string,
		repo: string,
		sinceNumber?: number,
		maxPages?: number,
	) => Promise<any[]>,
): Promise<void> {
	try {
		console.log(
			`Background update for ${owner}/${repo} from PR #${lastPrNumber + 1}`,
		);

		// Fetch only new PRs since last update
		const newPRs = await fetchMergedPRs(token, owner, repo, lastPrNumber + 1);

		if (newPRs.length > 0) {
			console.log(`Found ${newPRs.length} new PRs, updating cache`);
			await storeRepoData(db, owner, repo, newPRs, true);
		} else {
			console.log("No new PRs, cache is up to date");
			// Update timestamp anyway
			await db
				.prepare(
					"UPDATE repos SET last_updated = ? WHERE owner = ? AND name = ?",
				)
				.bind(Math.floor(Date.now() / 1000), owner, repo)
				.run();
		}
	} catch (error) {
		console.error("Error in background update:", error);
	}
}

/**
 * Get cached commit data from D1
 */
export async function getCachedCommits(
	db: D1Database,
	fullName: string,
): Promise<{
	commits: Commit[];
	lastUpdated: number;
	lastCommitSha: string | null;
	defaultBranch: string;
	totalCommitsAvailable: number;
} | null> {
	// Get repo metadata
	const repo = await db
		.prepare(
			"SELECT id, last_updated, last_commit_sha, default_branch, total_commits_available FROM repos WHERE full_name = ?",
		)
		.bind(fullName)
		.first();

	if (!repo) {
		return null;
	}

	// Get all commits
	const commits = await db
		.prepare(`
		SELECT commit_sha, message, author, committed_at, id
		FROM commits
		WHERE repo_id = ?
		ORDER BY committed_at ASC
	`)
		.bind(repo.id)
		.all();

	if (!commits.results || commits.results.length === 0) {
		return null;
	}

	// Transform data to match GitHub API format
	const transformedCommits = await Promise.all(
		commits.results.map(async (commit: any) => {
			// Get files for this commit
			const filesResult = await db
				.prepare(`
			SELECT filename, status, additions, deletions, previous_filename
			FROM commit_files
			WHERE commit_id = ?
		`)
				.bind(commit.id)
				.all();

			const files = filesResult.results || [];

			return {
				sha: commit.commit_sha,
				commit: {
					message: commit.message,
					author: {
						name: commit.author,
						date: new Date(commit.committed_at * 1000).toISOString(),
					},
				},
				files: files,
			};
		}),
	);

	return {
		commits: transformedCommits,
		lastUpdated: repo.last_updated as number,
		lastCommitSha: (repo.last_commit_sha as string) || null,
		defaultBranch: (repo.default_branch as string) || "main",
		totalCommitsAvailable: (repo.total_commits_available as number) || 0,
	};
}

/**
 * Store commit data in D1
 */
export async function storeCommitData(
	db: D1Database,
	owner: string,
	name: string,
	defaultBranch: string,
	commits: Commit[],
	totalCommitsAvailable?: number,
	isUpdate = false,
): Promise<void> {
	const fullName = `${owner}/${name}`;
	const now = Math.floor(Date.now() / 1000);
	const lastCommitSha = commits.length > 0 ? commits[0].sha : null;

	// Insert or update repo first
	if (isUpdate) {
		const updateFields = ["last_updated = ?", "last_commit_sha = ?", "default_branch = ?"];
		const updateValues = [now, lastCommitSha, defaultBranch];

		if (totalCommitsAvailable !== undefined) {
			updateFields.push("total_commits_available = ?");
			updateValues.push(totalCommitsAvailable);
		}

		updateValues.push(fullName);

		await db
			.prepare(
				`UPDATE repos SET ${updateFields.join(", ")} WHERE full_name = ?`,
			)
			.bind(...updateValues)
			.run();
	} else {
		await db
			.prepare(`
			INSERT INTO repos (owner, name, full_name, last_updated, last_commit_sha, default_branch, total_commits_available, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(full_name) DO UPDATE SET last_updated = ?, last_commit_sha = ?, default_branch = ?, total_commits_available = ?
		`)
			.bind(
				owner,
				name,
				fullName,
				now,
				lastCommitSha,
				defaultBranch,
				totalCommitsAvailable || 0,
				now,
				now,
				lastCommitSha,
				defaultBranch,
				totalCommitsAvailable || 0,
			)
			.run();
	}

	// Get repo ID
	const repo = await db
		.prepare("SELECT id FROM repos WHERE full_name = ?")
		.bind(fullName)
		.first();

	if (!repo) {
		throw new Error("Failed to get repo ID");
	}

	// Insert commits and their files
	for (const commit of commits) {
		// Insert commit first
		await db
			.prepare(`
			INSERT INTO commits (repo_id, commit_sha, message, author, committed_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(repo_id, commit_sha) DO NOTHING
		`)
			.bind(
				repo.id,
				commit.sha,
				commit.commit.message,
				commit.commit.author.name,
				Math.floor(new Date(commit.commit.author.date).getTime() / 1000),
				now,
			)
			.run();

		// Get commit ID
		const commitRow = await db
			.prepare(
				"SELECT id FROM commits WHERE repo_id = ? AND commit_sha = ?",
			)
			.bind(repo.id, commit.sha)
			.first();

		if (commitRow && commit.files && commit.files.length > 0) {
			// Batch insert files for this commit
			const fileBatch = commit.files.map((file: any) =>
				db
					.prepare(`
					INSERT INTO commit_files (commit_id, filename, status, additions, deletions, previous_filename)
					VALUES (?, ?, ?, ?, ?, ?)
					ON CONFLICT DO NOTHING
				`)
					.bind(
						commitRow.id,
						file.filename,
						file.status,
						file.additions || 0,
						file.deletions || 0,
						file.previous_filename || null,
					),
			);

			await db.batch(fileBatch);
		}
	}

	console.log(`Stored ${commits.length} commits for ${fullName}`);
}

/**
 * Fetch repo commits from GitHub and cache them
 */
export async function fetchAndCacheCommits(
	db: D1Database,
	token: string,
	owner: string,
	repo: string,
): Promise<{ commits: Commit[]; totalCommitsAvailable: number }> {
	const fullName = `${owner}/${repo}`;

	// First, get the default branch
	const repoInfo = await fetchRepoInfo(token, owner, repo);
	const defaultBranch = repoInfo.default_branch;

	console.log(`Fetching commits from ${fullName} (${defaultBranch} branch)`);

	// Get accurate total commit count efficiently (only 1 API call)
	const { fetchCommitCount } = await import("../api/github");
	const totalCommitCount = await fetchCommitCount(token, owner, repo, defaultBranch);
	console.log(`Total commits in repo: ${totalCommitCount}`);

	// Fetch commits from default branch
	// Limit pages to avoid fetching too many commits
	const commitList = await fetchCommits(
		token,
		owner,
		repo,
		defaultBranch,
		undefined,
		1, // Fetch only 1 page (100 commits) initially
	);

	if (commitList.length === 0) {
		return { commits: [], totalCommitsAvailable: totalCommitCount };
	}

	// Limit to prevent too many API calls - Cloudflare Workers has 50 subrequest limit
	// We need: 1 for repo info, 1 for commit count, 1 for commit list, N for commit details
	// So maximum N = 47, but let's be conservative and use 40
	const maxCommits = 40;
	const commitsToProcess = commitList.slice(0, maxCommits);
	const commits: Commit[] = [];

	console.log(
		`Processing ${commitsToProcess.length} of ${commitList.length} commits (${totalCommitCount} total in repo)`,
	);

	// Fetch files for each commit
	for (const commitMeta of commitsToProcess) {
		const commitDetails = await fetchCommitFiles(
			token,
			owner,
			repo,
			commitMeta.sha,
		);

		commits.push(commitDetails);
	}

	// Store in database with accurate total available commits
	await storeCommitData(db, owner, repo, defaultBranch, commits, totalCommitCount);

	return { commits, totalCommitsAvailable: totalCommitCount };
}

/**
 * Update commit data in background (incremental)
 */
export async function updateCommitData(
	db: D1Database,
	token: string,
	owner: string,
	repo: string,
	lastCommitSha: string | null,
	defaultBranch: string,
): Promise<void> {
	try {
		console.log(
			`Background update for ${owner}/${repo} from commit ${lastCommitSha}`,
		);

		// Fetch new commits since last update
		const commitList = await fetchCommits(
			token,
			owner,
			repo,
			defaultBranch,
			lastCommitSha || undefined,
			1, // Fetch only 1 page for updates
		);

		if (commitList.length === 0) {
			console.log("No new commits, cache is up to date");
			// Update timestamp and total commits available
			// Even if there are no new commits, we should check total available
			// Use efficient commit count API
			const { fetchCommitCount } = await import("../api/github");
			const totalCommitCount = await fetchCommitCount(token, owner, repo, defaultBranch);
			console.log(`Total commits in repo: ${totalCommitCount}`);
			await db
				.prepare(
					"UPDATE repos SET last_updated = ?, total_commits_available = ? WHERE owner = ? AND name = ?",
				)
				.bind(Math.floor(Date.now() / 1000), totalCommitCount, owner, repo)
				.run();
			return;
		}

		// Fetch files for new commits (limit to 40 to stay under subrequest limit)
		const commitsToProcess = commitList.slice(0, 40);
		const commits: Commit[] = [];

		for (const commitMeta of commitsToProcess) {
			const commitDetails = await fetchCommitFiles(
				token,
				owner,
				repo,
				commitMeta.sha,
			);
			commits.push(commitDetails);
		}

		if (commits.length > 0) {
			console.log(`Found ${commits.length} new commits, updating cache`);
			// Update the total commits available with accurate count
			const { fetchCommitCount } = await import("../api/github");
			const totalCommitCount = await fetchCommitCount(token, owner, repo, defaultBranch);
			console.log(`Total commits in repo: ${totalCommitCount}`);
			await storeCommitData(db, owner, repo, defaultBranch, commits, totalCommitCount, true);
		}
	} catch (error) {
		console.error("Error in background commit update:", error);
	}
}
