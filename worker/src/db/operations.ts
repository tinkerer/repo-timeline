/**
 * Database operations for D1
 * Handles storing and retrieving repository data from Cloudflare D1
 */

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
