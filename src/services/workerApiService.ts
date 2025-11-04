import type { GitHubPR, GitHubWorkerCommit } from "../types/github";

/**
 * Service for interacting with the Cloudflare Worker API
 * Handles all worker-specific endpoints and caching
 */
export class WorkerApiService {
	private workerUrl: string;
	private owner: string;
	private repo: string;

	constructor(workerUrl: string, owner: string, repo: string) {
		this.workerUrl = workerUrl;
		this.owner = owner;
		this.repo = repo;
	}

	/**
	 * Fetch metadata from Cloudflare Worker (fast, all commits without files)
	 */
	async fetchMetadata(): Promise<
		Array<{
			sha: string;
			message: string;
			author: string;
			date: string;
		}>
	> {
		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}/metadata`;
		const response = await fetch(url);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				error.error || `Worker request failed: ${response.status}`,
			);
		}

		const data = await response.json();
		return data;
	}

	/**
	 * Fetch cache status from Cloudflare Worker (instant!)
	 */
	async fetchCacheStatus(): Promise<{
		cache: {
			exists: boolean;
			cachedCommits: number;
			ageSeconds: number | null;
			lastCommitSha: string | null;
			defaultBranch: string | null;
			firstCommit: { sha: string; date: string } | null;
			lastCommit: { sha: string; date: string } | null;
		};
		status: "ready" | "partial" | "fetching";
	}> {
		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}/cache`;

		const response = await fetch(url);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				error.error || `Cache status request failed: ${response.status}`,
			);
		}

		const data = await response.json();

		const cacheStatus = {
			cache: data.cache,
			status: data.status,
		};

		return cacheStatus;
	}

	/**
	 * Fetch repo summary from GitHub (fast, just first page)
	 */
	async fetchRepoSummary(): Promise<{
		github: {
			estimatedTotalPRs: number;
			hasMoreThan100PRs: boolean;
			firstMergedPR: { number: number; merged_at: string } | null;
		};
	}> {
		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}/summary`;

		const response = await fetch(url);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				error.error || `Summary request failed: ${response.status}`,
			);
		}

		const data = await response.json();

		return { github: data.github };
	}

	/**
	 * Fetch a single PR with files from Cloudflare Worker (instant from cache!)
	 */
	async fetchSinglePR(prNumber: number): Promise<GitHubPR | null> {
		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}/pr/${prNumber}`;

		const response = await fetch(url);

		if (response.status === 404) {
			return null;
		}

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				error.error || `Single PR request failed: ${response.status}`,
			);
		}

		const data = await response.json();
		return data;
	}

	/**
	 * Fetch commit data from Cloudflare Worker with pagination
	 */
	async fetchCommits(
		offset = 0,
		limit = 40,
	): Promise<{
		commits: GitHubWorkerCommit[];
		totalCount: number;
		hasMore: boolean;
		offset: number;
		limit: number;
	}> {
		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}?offset=${offset}&limit=${limit}`;
		const response = await fetch(url);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				error.error || `Worker request failed: ${response.status}`,
			);
		}

		const commits = await response.json();

		// Parse pagination headers
		const totalCount = Number.parseInt(
			response.headers.get("X-Total-Count") || "0",
			10,
		);
		const hasMore = response.headers.get("X-Has-More") === "true";
		const responseOffset = Number.parseInt(
			response.headers.get("X-Offset") || "0",
			10,
		);
		const responseLimit = Number.parseInt(
			response.headers.get("X-Limit") || "40",
			10,
		);

		return {
			commits,
			totalCount,
			hasMore,
			offset: responseOffset,
			limit: responseLimit,
		};
	}
}
