import type {
	CommitData,
	FileNode,
	LoadProgress,
	RateLimitInfo,
} from "../types";
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
	 * Load more commits with pagination
	 */
	async loadMoreCommits(
		offset: number,
		limit = 40,
		existingFiles: Map<string, number> = new Map(),
		onCommit?: (commit: CommitData) => void,
		onProgress?: (progress: LoadProgress) => void,
	): Promise<{
		commits: CommitData[];
		hasMore: boolean;
		totalCount: number;
	}> {
		if (!this.githubService) {
			this.githubService = new GitHubApiService(
				this.repoPath,
				this.token,
				this.workerUrl,
			);
		}

		const result = await this.githubService.loadMoreCommits(
			offset,
			limit,
			existingFiles,
			onCommit,
			onProgress,
		);

		// Apply size change calculations
		const calculatedCommits = this.calculateSizeChanges(result.commits);

		// Update cache with all commits
		const cacheKey = this.getCacheKey();
		const existingCached = StorageService.loadCommits(cacheKey) || [];
		const allCommits = [...existingCached, ...calculatedCommits];
		StorageService.saveCommits(cacheKey, allCommits);

		return {
			...result,
			commits: calculatedCommits,
		};
	}

	/**
	 * Get repository status from worker (GitHub state + cache state)
	 */
	// Status methods removed - use new /cache and /summary endpoints directly
	// via GitHubApiService.fetchCacheStatus() and GitHubApiService.fetchRepoSummary()

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

		// Metadata now returns commits, not PRs
		const prs = metadata.map((commit, index) => ({
			number: index + 1, // Use index as commit number since commits don't have PR numbers
			title: commit.message,
			author: commit.author,
			date: new Date(commit.date),
		}));

		// Calculate time range
		const timestamps = prs.map((pr) => pr.date.getTime());
		const timeRange = {
			start: Math.min(...timestamps),
			end: Math.max(...timestamps),
		};

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
	): Promise<{
		commits: CommitData[];
		hasMore?: boolean;
		totalCount?: number;
	}> {
		const cacheKey = this.getCacheKey();

		// Try to load from cache first
		if (!forceRefresh) {
			const cached = StorageService.loadCommits(cacheKey);
			if (cached) {
				return { commits: cached };
			}
		}

		// Fetch fresh data
		try {
			const result = await this.fetchCommitsWithProgress(onProgress, onCommit);
			// Save to cache
			StorageService.saveCommits(cacheKey, result.commits);
			return result;
		} catch (error) {
			console.error("Error fetching commits:", error);
			// Try cache as fallback
			const cached = StorageService.loadCommits(cacheKey);
			if (cached) {
				return { commits: cached };
			}
			// Re-throw the error instead of returning demo data
			throw error;
		}
	}

	/**
	 * Fetch commits with progress reporting
	 */
	private async fetchCommitsWithProgress(
		onProgress?: (progress: LoadProgress) => void,
		onCommit?: (commit: CommitData) => void,
	): Promise<{
		commits: CommitData[];
		hasMore?: boolean;
		totalCount?: number;
	}> {
		// Check if repoPath is in GitHub format (owner/repo)
		if (/^[^/]+\/[^/]+$/.test(this.repoPath)) {
			try {
				this.githubService = new GitHubApiService(
					this.repoPath,
					this.token,
					this.workerUrl,
				);
				const cacheKey = this.getCacheKey();
				const result = await this.githubService.buildTimelineFromPRsIncremental(
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
					},
				);

				console.log("[AUTOLOAD] GitService initial load result:", {
					commits: result.commits.length,
					hasMore: result.hasMore,
					totalCount: result.totalCount,
				});

				return {
					commits: this.calculateSizeChanges(result.commits),
					hasMore: result.hasMore,
					totalCount: result.totalCount,
				};
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
			return { commits };
		} catch (error) {
			// Re-throw error - no demo data fallback
			throw new Error(
				`Failed to fetch repository data. Please check the repository path and try again. ${error instanceof Error ? error.message : ""}`,
			);
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
				const addedDeletedNodes: FileNode[] = [];
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
							const deletedNode: FileNode = {
								...prevFile,
								size: 0,
								previousSize: prevFile.size,
								fileStatus: "deleted",
								sizeChange: "decrease",
							};
							commits[i].files.push(deletedNode);
							addedDeletedNodes.push(deletedNode);
						}
					}
				}

				// Rebuild edges to include deleted nodes
				if (addedDeletedNodes.length > 0) {
					const fileData = commits[i].files.map((f) => ({
						path: f.path,
						size: f.size,
					}));
					commits[i].edges = buildEdges(fileData);
				}
			}
		}
		return commits;
	}
}
