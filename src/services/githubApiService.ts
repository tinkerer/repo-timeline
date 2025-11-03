import type { CommitData, LoadProgress, RateLimitInfo } from "../types";
import { FileStateTracker } from "../utils/fileStateTracker";
import { buildEdges, buildFileTree } from "../utils/fileTreeBuilder";

export interface GitHubPR {
	number: number;
	title: string;
	merged_at: string | null;
	merge_commit_sha?: string | null;
	user: {
		login: string;
	};
	files_url: string;
	files?: GitHubPRFile[]; // Optional - included when fetched from worker
}

export interface GitHubCommit {
	sha: string;
	commit: {
		message: string;
		author: {
			name: string;
			date: string;
		};
	};
}

export interface GitHubPRFile {
	filename: string;
	status: "added" | "removed" | "modified" | "renamed";
	additions: number;
	deletions: number;
	changes: number;
	previous_filename?: string;
}

/**
 * Service for fetching repository data from GitHub's REST API
 * Handles rate limiting and incremental loading
 */
export class GitHubApiService {
	private owner: string;
	private repo: string;
	private baseUrl = "https://api.github.com";
	private requestDelay = 1000; // 1 second between requests to avoid rate limiting
	private token?: string;
	private lastRateLimit: RateLimitInfo | null = null;
	private workerUrl?: string;

	constructor(repoPath: string, token?: string, workerUrl?: string) {
		const [owner, repo] = repoPath.split("/");
		this.owner = owner;
		this.repo = repo;
		this.token = token;
		this.workerUrl = workerUrl;
		console.log("GitHubApiService initialized:", {
			repoPath,
			hasToken: !!token,
			workerUrl,
			willUseWorker: !!workerUrl,
		});
	}

	/**
	 * Check if we should use the worker for this request
	 */
	private shouldUseWorker(): boolean {
		return !!this.workerUrl;
	}

	/**
	 * Fetch metadata from Cloudflare Worker (fast, all PRs without files)
	 */
	async fetchMetadata(): Promise<
		Array<{
			number: number;
			title: string;
			user: { login: string };
			merged_at: string;
		}>
	> {
		if (!this.workerUrl) {
			throw new Error("Worker URL not configured");
		}

		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}/metadata`;
		console.log("Fetching metadata from:", url);
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
		console.log(`Fetched ${data.length} PRs metadata`);
		return data;
	}

	/**
	 * Fetch repository status from Cloudflare Worker
	 */
	async fetchRepoStatus(): Promise<{
		github: {
			totalPRs: number;
			firstPR: number | null;
			lastPR: number | null;
			oldestMerge: string | null;
			newestMerge: string | null;
		};
		cache: {
			cachedPRs: number;
			coveragePercent: number;
			ageSeconds: number | null;
			lastPRNumber: number | null;
		};
		recommendation: "ready" | "partial" | "fetching";
	}> {
		if (!this.workerUrl) {
			throw new Error("Worker URL required for status fetch");
		}

		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}/status`;
		console.log("Fetching status from:", url);
		const response = await fetch(url);

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Unknown error" }));
			throw new Error(
				error.error || `Status request failed: ${response.status}`,
			);
		}

		const data = await response.json();
		console.log(
			`Repository status: ${data.github.totalPRs} total PRs, ${data.cache.cachedPRs} cached (${data.cache.coveragePercent}%)`,
		);
		return data;
	}

	/**
	 * Fetch data from Cloudflare Worker
	 */
	private async fetchFromWorker(): Promise<GitHubPR[]> {
		if (!this.workerUrl) {
			throw new Error("Worker URL not configured");
		}

		const url = `${this.workerUrl}/api/repo/${this.owner}/${this.repo}`;
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

	getRateLimitInfo(): RateLimitInfo | null {
		return this.lastRateLimit;
	}

	/**
	 * Sleep for a specified duration
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Make a GitHub API request with error handling
	 */
	private async fetchGitHub<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const headers: Record<string, string> = {
			Accept: "application/vnd.github.v3+json",
		};

		// Add auth token if available
		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		const response = await fetch(url, {
			...options,
			headers: {
				...headers,
				...options.headers,
			},
		});

		// Always capture rate limit info from headers
		const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
		const rateLimitLimit = response.headers.get("X-RateLimit-Limit");
		const rateLimitReset = response.headers.get("X-RateLimit-Reset");

		if (rateLimitRemaining && rateLimitLimit && rateLimitReset) {
			this.lastRateLimit = {
				remaining: Number.parseInt(rateLimitRemaining),
				limit: Number.parseInt(rateLimitLimit),
				resetTime: new Date(Number.parseInt(rateLimitReset) * 1000),
			};
		}

		if (!response.ok) {
			if (response.status === 403 && rateLimitRemaining === "0") {
				const resetTime = rateLimitReset
					? new Date(Number.parseInt(rateLimitReset) * 1000)
					: new Date();
				throw new Error(
					`GitHub API rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}. Unauthenticated limit is 60/hour. For higher limits, wait or contact the developer.`,
				);
			}

			if (response.status === 404) {
				throw new Error(
					`Repository not found: ${this.owner}/${this.repo}. Repository may be private or doesn't exist.`,
				);
			}

			throw new Error(
				`GitHub API error: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}

	/**
	 * Fetch all merged pull requests for the repository
	 */
	async fetchMergedPRs(
		onProgress?: (progress: LoadProgress) => void,
	): Promise<GitHubPR[]> {
		const prs: GitHubPR[] = [];
		let page = 1;
		const perPage = 100;

		// First, get the total count (approximately)
		if (onProgress) {
			onProgress({
				loaded: 0,
				total: -1,
				percentage: 0,
				message: "Fetching pull requests...",
			});
		}

		while (true) {
			const batch = await this.fetchGitHub<GitHubPR[]>(
				`/repos/${this.owner}/${this.repo}/pulls?state=closed&per_page=${perPage}&page=${page}&sort=created&direction=asc`,
			);

			if (batch.length === 0) break;

			// Filter for merged PRs
			const mergedPRs = batch.filter((pr) => pr.merged_at !== null);
			prs.push(...mergedPRs);

			if (onProgress) {
				onProgress({
					loaded: prs.length,
					total: -1, // Unknown total
					percentage: 0,
					message: `Found ${prs.length} merged pull requests...`,
				});
			}

			// Stop if we got fewer results than requested (last page)
			if (batch.length < perPage) break;

			page++;
			// Throttle requests
			await this.sleep(this.requestDelay);
		}

		return prs;
	}

	/**
	 * Fetch file changes for a specific PR
	 */
	async fetchPRFiles(prNumber: number): Promise<GitHubPRFile[]> {
		const files: GitHubPRFile[] = [];
		let page = 1;
		const perPage = 100;

		while (true) {
			const batch = await this.fetchGitHub<GitHubPRFile[]>(
				`/repos/${this.owner}/${this.repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`,
			);

			if (batch.length === 0) break;

			files.push(...batch);

			if (batch.length < perPage) break;

			page++;
			await this.sleep(this.requestDelay);
		}

		return files;
	}

	/**
	 * Build commit timeline from PRs incrementally
	 * Calls onCommit callback for each PR processed, allowing progressive rendering
	 */
	async buildTimelineFromPRsIncremental(
		onCommit?: (commit: CommitData) => void,
		onProgress?: (progress: LoadProgress) => void,
		onSaveCache?: (commits: CommitData[]) => void,
	): Promise<CommitData[]> {
		// Use worker if available, otherwise fetch from GitHub API
		let prs: GitHubPR[];

		if (this.shouldUseWorker()) {
			if (onProgress) {
				onProgress({
					loaded: 0,
					total: -1,
					percentage: 0,
					message: "Fetching data from cache...",
				});
			}

			prs = await this.fetchFromWorker();

			if (onProgress) {
				onProgress({
					loaded: prs.length,
					total: prs.length,
					percentage: 50,
					message: `Loaded ${prs.length} PRs from cache`,
				});
			}
		} else {
			// Fetch all merged PRs from GitHub API
			prs = await this.fetchMergedPRs((progress) => {
				if (onProgress) {
					onProgress({
						...progress,
						percentage: 10,
					});
				}
			});
		}

		if (prs.length === 0) {
			// Fall back to fetching commits directly if no PRs found
			console.log("No merged PRs found, falling back to commits");
			return this.buildTimelineFromCommits(onCommit, onProgress);
		}

		const commits: CommitData[] = [];
		const fileStateTracker = new FileStateTracker();

		// Process each PR
		for (let i = 0; i < prs.length; i++) {
			const pr = prs[i];

			if (onProgress) {
				onProgress({
					loaded: i + 1,
					total: prs.length,
					percentage: 10 + Math.round((i / prs.length) * 90),
					message: `Processing PR #${pr.number}: ${pr.title}`,
				});
			}

			// Get files - either from worker (already included) or fetch from GitHub
			const prFiles = pr.files || (await this.fetchPRFiles(pr.number));

			// Update file state
			fileStateTracker.updateFromPRFiles(prFiles);

			// Build commit snapshot from current file state using shared utilities
			const fileData = fileStateTracker.getFileData();

			const files = buildFileTree(fileData);
			const edges = buildEdges(fileData);

			const commit: CommitData = {
				hash: pr.merge_commit_sha
					? pr.merge_commit_sha.substring(0, 7)
					: `pr-${pr.number}`,
				message: pr.title,
				author: pr.user.login,
				date: new Date(pr.merged_at || Date.now()),
				files,
				edges,
			};

			commits.push(commit);

			// Call onCommit callback for incremental updates
			if (onCommit) {
				onCommit(commit);
			}

			// Save to cache incrementally so we don't lose data if rate limited
			if (onSaveCache && (i % 5 === 0 || i === prs.length - 1)) {
				// Save every 5 PRs or at the end
				onSaveCache([...commits]);
			}

			// Throttle between PRs
			if (i < prs.length - 1) {
				await this.sleep(this.requestDelay);
			}
		}

		return commits;
	}

	/**
	 * Build commit timeline from commits directly (fallback when no PRs)
	 */
	async buildTimelineFromCommits(
		onCommit?: (commit: CommitData) => void,
		onProgress?: (progress: LoadProgress) => void,
	): Promise<CommitData[]> {
		if (onProgress) {
			onProgress({
				loaded: 0,
				total: -1,
				percentage: 10,
				message: "Fetching commits (no PRs found)...",
			});
		}

		// Fetch commits from default branch
		const commits: CommitData[] = [];
		let page = 1;
		const perPage = 100;
		const maxCommits = 100; // Limit to avoid too many API calls

		while (commits.length < maxCommits) {
			const batch = await this.fetchGitHub<GitHubCommit[]>(
				`/repos/${this.owner}/${this.repo}/commits?per_page=${perPage}&page=${page}`,
			);

			if (batch.length === 0) break;

			// Process each commit
			for (const commitData of batch) {
				if (commits.length >= maxCommits) break;

				const commit: CommitData = {
					hash: commitData.sha.substring(0, 7),
					message: commitData.commit.message.split("\n")[0],
					author: commitData.commit.author.name,
					date: new Date(commitData.commit.author.date),
					files: [], // We'd need to fetch commit details for files
					edges: [],
				};

				commits.push(commit);

				if (onCommit) {
					onCommit(commit);
				}

				if (onProgress) {
					onProgress({
						loaded: commits.length,
						total: maxCommits,
						percentage: 10 + Math.round((commits.length / maxCommits) * 90),
						message: `Loading commits: ${commits.length}/${maxCommits}`,
					});
				}
			}

			if (batch.length < perPage) break;
			page++;
			await this.sleep(this.requestDelay);
		}

		if (commits.length === 0) {
			throw new Error(
				"No commits or pull requests found. Repository may be empty or private.",
			);
		}

		return commits;
	}

	/**
	 * Build commit timeline from PRs (non-incremental version for backward compatibility)
	 */
	async buildTimelineFromPRs(
		onProgress?: (progress: LoadProgress) => void,
	): Promise<CommitData[]> {
		return this.buildTimelineFromPRsIncremental(undefined, onProgress);
	}
}
