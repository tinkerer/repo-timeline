import { CommitData, FileEdge, FileNode } from "../types";
import {
	GitHubApiService,
	type RateLimitInfo,
} from "./githubApiService";
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

export interface LoadProgress {
	loaded: number;
	total: number;
	percentage: number;
	message?: string;
}

export class GitService {
	private repoPath: string;
	private token?: string;
	private githubService?: GitHubApiService;

	constructor(repoPath: string, token?: string) {
		this.repoPath = repoPath;
		this.token = token;
	}

	getRateLimitInfo(): RateLimitInfo | null {
		return this.githubService?.getRateLimitInfo() || null;
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
			return this.calculateSizeChanges(this.getDemoData());
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
			console.log(`Fetching from GitHub API: ${this.repoPath}`);
			try {
				this.githubService = new GitHubApiService(this.repoPath, this.token);
				const commits = await this.githubService.buildTimelineFromPRsIncremental(
					onCommit
						? (commit) => {
								// Apply size change calculations incrementally
								const calculated = this.calculateSizeChanges([commit]);
								onCommit(calculated[0]);
							}
						: undefined,
					onProgress,
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
			const demoData = this.getDemoData();

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
				files: this.buildFileTree(commit.files),
				edges: this.buildEdges(commit.files),
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

	private buildFileTree(files: RawFileData[]): FileNode[] {
		const nodes: FileNode[] = [];
		const pathMap = new Map<string, FileNode>();

		// First pass: create all nodes
		files.forEach((file) => {
			const node: FileNode = {
				id: file.path,
				path: file.path,
				name: file.path.split("/").pop() || file.path,
				size: file.size || 100,
				type: (file.type as "file" | "directory") || "file",
			};
			nodes.push(node);
			pathMap.set(file.path, node);
		});

		return nodes;
	}

	private buildEdges(files: RawFileData[]): FileEdge[] {
		const edges: FileEdge[] = [];

		// Build parent-child relationships based on file paths
		files.forEach((file) => {
			const pathParts = file.path.split("/");
			if (pathParts.length > 1) {
				// Connect to parent directory
				const parentPath = pathParts.slice(0, -1).join("/");
				edges.push({
					source: parentPath || "root",
					target: file.path,
					type: "parent",
				});
			}
		});

		return edges;
	}

	private getDemoData(): CommitData[] {
		// Demo data showing a simple project evolution
		const commits: CommitData[] = [
			{
				hash: "abc123",
				message: "Initial commit",
				author: "Developer",
				date: new Date("2024-01-01"),
				files: [
					{
						id: "README.md",
						path: "README.md",
						name: "README.md",
						size: 50,
						type: "file",
					},
					{ id: "src", path: "src", name: "src", size: 0, type: "directory" },
					{
						id: "src/index.ts",
						path: "src/index.ts",
						name: "index.ts",
						size: 100,
						type: "file",
					},
				],
				edges: [{ source: "src", target: "src/index.ts", type: "parent" }],
			},
			{
				hash: "def456",
				message: "Add components",
				author: "Developer",
				date: new Date("2024-01-02"),
				files: [
					{
						id: "README.md",
						path: "README.md",
						name: "README.md",
						size: 50,
						type: "file",
					},
					{ id: "src", path: "src", name: "src", size: 0, type: "directory" },
					{
						id: "src/index.ts",
						path: "src/index.ts",
						name: "index.ts",
						size: 150,
						type: "file",
					},
					{
						id: "src/components",
						path: "src/components",
						name: "components",
						size: 0,
						type: "directory",
					},
					{
						id: "src/components/App.tsx",
						path: "src/components/App.tsx",
						name: "App.tsx",
						size: 200,
						type: "file",
					},
					{
						id: "src/components/Header.tsx",
						path: "src/components/Header.tsx",
						name: "Header.tsx",
						size: 80,
						type: "file",
					},
				],
				edges: [
					{ source: "src", target: "src/index.ts", type: "parent" },
					{ source: "src", target: "src/components", type: "parent" },
					{
						source: "src/components",
						target: "src/components/App.tsx",
						type: "parent",
					},
					{
						source: "src/components",
						target: "src/components/Header.tsx",
						type: "parent",
					},
				],
			},
			{
				hash: "ghi789",
				message: "Add styles and utils",
				author: "Developer",
				date: new Date("2024-01-03"),
				files: [
					{
						id: "README.md",
						path: "README.md",
						name: "README.md",
						size: 800, // Significant increase
						type: "file",
					},
					{ id: "src", path: "src", name: "src", size: 0, type: "directory" },
					{
						id: "src/index.ts",
						path: "src/index.ts",
						name: "index.ts",
						size: 150,
						type: "file",
					},
					{
						id: "src/components",
						path: "src/components",
						name: "components",
						size: 0,
						type: "directory",
					},
					{
						id: "src/components/App.tsx",
						path: "src/components/App.tsx",
						name: "App.tsx",
						size: 2500, // Large increase
						type: "file",
					},
					{
						id: "src/components/Header.tsx",
						path: "src/components/Header.tsx",
						name: "Header.tsx",
						size: 80, // Decrease (refactored)
						type: "file",
					},
					{
						id: "src/styles",
						path: "src/styles",
						name: "styles",
						size: 0,
						type: "directory",
					},
					{
						id: "src/styles/main.css",
						path: "src/styles/main.css",
						name: "main.css",
						size: 1500, // New large file
						type: "file",
					},
					{
						id: "src/utils",
						path: "src/utils",
						name: "utils",
						size: 0,
						type: "directory",
					},
					{
						id: "src/utils/helpers.ts",
						path: "src/utils/helpers.ts",
						name: "helpers.ts",
						size: 1000, // New file
						type: "file",
					},
				],
				edges: [
					{ source: "src", target: "src/index.ts", type: "parent" },
					{ source: "src", target: "src/components", type: "parent" },
					{ source: "src", target: "src/styles", type: "parent" },
					{ source: "src", target: "src/utils", type: "parent" },
					{
						source: "src/components",
						target: "src/components/App.tsx",
						type: "parent",
					},
					{
						source: "src/components",
						target: "src/components/Header.tsx",
						type: "parent",
					},
					{
						source: "src/styles",
						target: "src/styles/main.css",
						type: "parent",
					},
					{
						source: "src/utils",
						target: "src/utils/helpers.ts",
						type: "parent",
					},
				],
			},
			{
				hash: "jkl012",
				message: "Refactor and optimize",
				author: "Developer",
				date: new Date("2024-01-04"),
				files: [
					{
						id: "README.md",
						path: "README.md",
						name: "README.md",
						size: 800,
						type: "file",
					},
					{ id: "src", path: "src", name: "src", size: 0, type: "directory" },
					{
						id: "src/index.ts",
						path: "src/index.ts",
						name: "index.ts",
						size: 200, // Small increase
						type: "file",
					},
					{
						id: "src/components",
						path: "src/components",
						name: "components",
						size: 0,
						type: "directory",
					},
					{
						id: "src/components/App.tsx",
						path: "src/components/App.tsx",
						name: "App.tsx",
						size: 1800, // Decrease (optimized)
						type: "file",
					},
					{
						id: "src/components/Header.tsx",
						path: "src/components/Header.tsx",
						name: "Header.tsx",
						size: 300, // Increase
						type: "file",
					},
					{
						id: "src/styles",
						path: "src/styles",
						name: "styles",
						size: 0,
						type: "directory",
					},
					{
						id: "src/styles/main.css",
						path: "src/styles/main.css",
						name: "main.css",
						size: 1200, // Optimized
						type: "file",
					},
					{
						id: "src/utils",
						path: "src/utils",
						name: "utils",
						size: 0,
						type: "directory",
					},
					{
						id: "src/utils/helpers.ts",
						path: "src/utils/helpers.ts",
						name: "helpers.ts",
						size: 1500, // Expanded
						type: "file",
					},
				],
				edges: [
					{ source: "src", target: "src/index.ts", type: "parent" },
					{ source: "src", target: "src/components", type: "parent" },
					{ source: "src", target: "src/styles", type: "parent" },
					{ source: "src", target: "src/utils", type: "parent" },
					{
						source: "src/components",
						target: "src/components/App.tsx",
						type: "parent",
					},
					{
						source: "src/components",
						target: "src/components/Header.tsx",
						type: "parent",
					},
					{
						source: "src/styles",
						target: "src/styles/main.css",
						type: "parent",
					},
					{
						source: "src/utils",
						target: "src/utils/helpers.ts",
						type: "parent",
					},
				],
			},
		];

		return commits;
	}
}
