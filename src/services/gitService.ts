import { getDemoCommits } from "../data/demoCommits";
import type { CommitData, LoadProgress, RateLimitInfo } from "../types";
import { buildEdges, buildFileTree } from "../utils/fileTreeBuilder";
import { GitHubApiService } from "./githubApiService";
import { StorageService } from "./storageService";

interface RawCommitData {
	hash: string;
	message: string;
	author: string;
	date: string;
	files: RawFileData[];
}

interface RawFileData {
	path: string;
	size?: number;
	type?: string;
}

// Re-export for convenience
export type { LoadProgress, RateLimitInfo };

export class GitService {
	private repoPath: string;
	private token?: string;
	private workerUrl?: string;
	private githubService?: GitHubApiService;

	constructor(repoPath: string, token?: string, workerUrl?: string) {
		this.repoPath = repoPath;
		this.token = token;
		this.workerUrl = workerUrl;
	}

	getRateLimitInfo(): RateLimitInfo | null {
		return this.githubService?.getRateLimitInfo() || null;
	}

	/**
	 * Fetch metadata for all PRs (fast, no files)
	 */
	async getMetadata(): Promise<{
		prs: Array<{
			number: number;
			title: string;
			author: string;
			date: Date;
		}>;
		timeRange: { start: number; end: number };
	}> {
		this.githubService = new GitHubApiService(
			this.repoPath,
			this.token,
			this.workerUrl,
		);

		const metadata = await this.githubService.fetchMetadata();

		const prs = metadata.map((pr) => ({
			number: pr.number,
			title: pr.title,
			author: pr.user.login,
			date: new Date(pr.merged_at),
		}));

		// Calculate time range
		const timestamps = prs.map((pr) => pr.date.getTime());
		const timeRange = {
			start: Math.min(...timestamps),
			end: Math.max(...timestamps),
		};

		console.log(
			`Metadata: ${prs.length} PRs from ${new Date(timeRange.start).toLocaleDateString()} to ${new Date(timeRange.end).toLocaleDateString()}`,
		);

		return { prs, timeRange };
	}

	/**
	 * Get a cache key for this repository
	 */
	private getCacheKey(): string {
		// Normalize repo path to create consistent key
		return this.repoPath.toLowerCase().replace(/[^a-z0-9]/g, "-");
	}

	/**
	 * Get commit history with caching and incremental loading
	 */
	async getCommitHistory(
		onProgress?: (progress: LoadProgress) => void,
		forceRefresh = false,
		onCommit?: (commit: CommitData) => void,
	): Promise<CommitData[]> {
		const cacheKey = this.getCacheKey();

		// Try to load from cache first
		if (!forceRefresh) {
			const cached = StorageService.loadCommits(cacheKey);
			if (cached) {
				console.log(
					`Loaded ${cached.length} commits from cache for ${this.repoPath}`,
				);
				return cached;
			}
		}

		// Fetch fresh data
		try {
			const commits = await this.fetchCommitsWithProgress(onProgress, onCommit);
			// Save to cache
			StorageService.saveCommits(cacheKey, commits);
			return commits;
		} catch (error) {
			console.error("Error fetching commits:", error);
			// Try cache as fallback
			const cached = StorageService.loadCommits(cacheKey);
			if (cached) {
				console.log("Using stale cache as fallback");
				return cached;
			}
			// Return demo data as last resort
			return this.calculateSizeChanges(getDemoCommits());
		}
	}

	/**
	 * Fetch commits with progress reporting
	 */
	private async fetchCommitsWithProgress(
		onProgress?: (progress: LoadProgress) => void,
		onCommit?: (commit: CommitData) => void,
	): Promise<CommitData[]> {
		// Check if repoPath is in GitHub format (owner/repo)
		if (/^[^/]+\/[^/]+$/.test(this.repoPath)) {
			const source = this.workerUrl ? "Worker Cache" : "GitHub API";
			console.log(`Fetching from ${source}: ${this.repoPath}`);
			try {
				this.githubService = new GitHubApiService(
					this.repoPath,
					this.token,
					this.workerUrl,
				);
				const cacheKey = this.getCacheKey();
				const commits =
					await this.githubService.buildTimelineFromPRsIncremental(
						onCommit
							? (commit) => {
									// Apply size change calculations incrementally
									const calculated = this.calculateSizeChanges([commit]);
									onCommit(calculated[0]);
								}
							: undefined,
						onProgress,
						(partialCommits) => {
							// Save to cache incrementally
							const calculated = this.calculateSizeChanges(partialCommits);
							StorageService.saveCommits(cacheKey, calculated);
							console.log(
								`Saved ${calculated.length} commits to cache incrementally`,
							);
						},
					);
				return this.calculateSizeChanges(commits);
			} catch (error) {
				console.error("GitHub API error:", error);
				throw error;
			}
		}

		// Try backend API (legacy support)
		try {
			const response = await fetch(
				`/api/commits?path=${encodeURIComponent(this.repoPath)}`,
			);
			if (!response.ok) {
				throw new Error("Failed to fetch commits");
			}
			const data = await response.json();

			// Simulate incremental parsing for progress
			const commits = this.parseCommitsWithProgress(data, onProgress);
			return commits;
		} catch (_error) {
			console.log("API not available, using demo data");
			// Return demo data for development
			const demoData = getDemoCommits();

			// Simulate loading progress for demo
			if (onProgress) {
				for (let i = 0; i <= demoData.length; i++) {
					onProgress({
						loaded: i,
						total: demoData.length,
						percentage: Math.round((i / demoData.length) * 100),
					});
					// Small delay to simulate loading
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}

			return this.calculateSizeChanges(demoData);
		}
	}

	/**
	 * Parse commits with progress reporting
	 */
	private parseCommitsWithProgress(
		data: RawCommitData[],
		onProgress?: (progress: LoadProgress) => void,
	): CommitData[] {
		const commits: CommitData[] = [];

		for (let i = 0; i < data.length; i++) {
			const commit = data[i];
			commits.push({
				hash: commit.hash,
				message: commit.message,
				author: commit.author,
				date: new Date(commit.date),
				files: buildFileTree(
					commit.files.map((f) => ({
						path: f.path,
						size: f.size || 100,
						type: f.type as "file" | "directory",
					})),
				),
				edges: buildEdges(
					commit.files.map((f) => ({ path: f.path, size: f.size || 100 })),
				),
			});

			if (onProgress && i % 10 === 0) {
				// Report progress every 10 commits
				onProgress({
					loaded: i + 1,
					total: data.length,
					percentage: Math.round(((i + 1) / data.length) * 100),
				});
			}
		}

		return this.calculateSizeChanges(commits);
	}

	/**
	 * Clear cache for this repository
	 */
	clearCache(): void {
		StorageService.clearCache(this.getCacheKey());
	}

	/**
	 * Get cache information
	 */
	getCacheInfo() {
		return StorageService.getCacheInfo(this.getCacheKey());
	}

	private calculateSizeChanges(commits: CommitData[]): CommitData[] {
		// Process commits in order to track size and status changes
		for (let i = 0; i < commits.length; i++) {
			if (i === 0) {
				// First commit: all files are new
				commits[i].files.forEach((file) => {
					file.sizeChange = "unchanged";
					file.fileStatus = "added";
				});
			} else {
				// Compare with previous commit
				const previousCommit = commits[i - 1];
				const previousFileMap = new Map(
					previousCommit.files.map((f) => [f.path, f]),
				);
				const currentFileMap = new Map(
					commits[i].files.map((f) => [f.path, f]),
				);

				// Check current files
				commits[i].files.forEach((file) => {
					const prevFile = previousFileMap.get(file.path);
					if (prevFile) {
						// File exists in both commits
						file.previousSize = prevFile.size;
						file.fileStatus = "unchanged";

						if (file.size > prevFile.size) {
							file.sizeChange = "increase";
						} else if (file.size < prevFile.size) {
							file.sizeChange = "decrease";
						} else {
							file.sizeChange = "unchanged";
						}
					} else {
						// New file - check if it's a move (same name, different path)
						const fileName = file.path.split("/").pop();
						let isMove = false;

						for (const [prevPath, prevFileNode] of previousFileMap) {
							const prevFileName = prevPath.split("/").pop();
							if (
								prevFileName === fileName &&
								!currentFileMap.has(prevPath) &&
								file.size === prevFileNode.size
							) {
								// Likely a move/rename
								file.fileStatus = "moved";
								file.previousPath = prevPath;
								file.previousSize = prevFileNode.size;
								file.sizeChange = "unchanged";
								isMove = true;
								break;
							}
						}

						if (!isMove) {
							file.fileStatus = "added";
							file.sizeChange = "increase";
						}
					}
				});

				// Add deleted files as zero-size nodes for animation
				for (const [prevPath, prevFile] of previousFileMap) {
					if (!currentFileMap.has(prevPath)) {
						// Check if this file was moved
						let wasMoved = false;

						for (const currentFile of commits[i].files) {
							if (currentFile.previousPath === prevPath) {
								wasMoved = true;
								break;
							}
						}

						if (!wasMoved) {
							// File was deleted - add it with size 0 for animation
							commits[i].files.push({
								...prevFile,
								size: 0,
								previousSize: prevFile.size,
								fileStatus: "deleted",
								sizeChange: "decrease",
							});
						}
					}
				}
			}
		}
		return commits;
	}
}
