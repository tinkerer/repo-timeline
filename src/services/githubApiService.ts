import { CommitData } from "../types";

export interface GitHubPR {
	number: number;
	title: string;
	merged_at: string | null;
	user: {
		login: string;
	};
	files_url: string;
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

export interface LoadProgress {
	loaded: number;
	total: number;
	percentage: number;
	message: string;
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

	constructor(repoPath: string, token?: string) {
		const [owner, repo] = repoPath.split("/");
		this.owner = owner;
		this.repo = repo;
		this.token = token;
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

		if (!response.ok) {
			const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
			const rateLimitReset = response.headers.get("X-RateLimit-Reset");

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
	): Promise<CommitData[]> {
		// Fetch all merged PRs
		const prs = await this.fetchMergedPRs((progress) => {
			if (onProgress) {
				onProgress({
					...progress,
					percentage: 10,
				});
			}
		});

		if (prs.length === 0) {
			// Fall back to fetching commits directly if no PRs found
			console.log("No merged PRs found, falling back to commits");
			return this.buildTimelineFromCommits(onCommit, onProgress);
		}

		const commits: CommitData[] = [];
		const fileState = new Map<string, number>(); // Track file sizes

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

			// Fetch files for this PR
			const prFiles = await this.fetchPRFiles(pr.number);

			// Update file state
			for (const file of prFiles) {
				if (file.status === "removed") {
					fileState.delete(file.filename);
				} else if (file.status === "renamed" && file.previous_filename) {
					// Handle renames
					const oldSize = fileState.get(file.previous_filename) || 0;
					fileState.delete(file.previous_filename);
					fileState.set(
						file.filename,
						oldSize + file.additions - file.deletions,
					);
				} else {
					// Added or modified
					const currentSize = fileState.get(file.filename) || 0;
					fileState.set(
						file.filename,
						currentSize + file.additions - file.deletions,
					);
				}
			}

			// Build commit snapshot from current file state
			const files = Array.from(fileState.entries()).map(([path, size]) => ({
				id: path,
				path,
				name: path.split("/").pop() || path,
				size: Math.max(0, size), // Ensure non-negative
				type: path.includes("/") ? ("file" as const) : ("file" as const), // Simplified for now
			}));

			const commit: CommitData = {
				hash: `pr-${pr.number}`,
				message: pr.title,
				author: pr.user.login,
				date: new Date(pr.merged_at || Date.now()),
				files,
				edges: [], // We'll build edges if needed
			};

			commits.push(commit);

			// Call onCommit callback for incremental updates
			if (onCommit) {
				onCommit(commit);
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
