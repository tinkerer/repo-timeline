import { CommitData, FileEdge, FileNode } from "../types";

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

export class GitService {
	private repoPath: string;

	constructor(repoPath: string) {
		this.repoPath = repoPath;
	}

	async getCommitHistory(): Promise<CommitData[]> {
		// This will be implemented to fetch git history
		// For now, we'll use the browser's ability to call a backend API
		// or use a demo/mock implementation
		try {
			const response = await fetch(
				`/api/commits?path=${encodeURIComponent(this.repoPath)}`,
			);
			if (!response.ok) {
				throw new Error("Failed to fetch commits");
			}
			const data = await response.json();
			return this.parseCommits(data);
		} catch (error) {
			console.error("Error fetching commits:", error);
			// Return demo data for development
			return this.calculateSizeChanges(this.getDemoData());
		}
	}

	private calculateSizeChanges(commits: CommitData[]): CommitData[] {
		// Process commits in order to track size changes
		for (let i = 0; i < commits.length; i++) {
			if (i === 0) {
				// First commit: no previous data, mark all as unchanged
				commits[i].files.forEach((file) => {
					file.sizeChange = "unchanged";
				});
			} else {
				// Compare with previous commit
				const previousCommit = commits[i - 1];
				const previousFileMap = new Map(
					previousCommit.files.map((f) => [f.path, f]),
				);

				commits[i].files.forEach((file) => {
					const prevFile = previousFileMap.get(file.path);
					if (prevFile) {
						file.previousSize = prevFile.size;
						if (file.size > prevFile.size) {
							file.sizeChange = "increase";
						} else if (file.size < prevFile.size) {
							file.sizeChange = "decrease";
						} else {
							file.sizeChange = "unchanged";
						}
					} else {
						// New file
						file.sizeChange = "increase";
					}
				});
			}
		}
		return commits;
	}

	private parseCommits(data: RawCommitData[]): CommitData[] {
		return data.map((commit) => ({
			hash: commit.hash,
			message: commit.message,
			author: commit.author,
			date: new Date(commit.date),
			files: this.buildFileTree(commit.files),
			edges: this.buildEdges(commit.files),
		}));
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
