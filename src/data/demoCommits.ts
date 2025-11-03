import { CommitData } from "../types";

/**
 * Demo data showing a simple project evolution
 * Used as fallback when API is unavailable
 */
export function getDemoCommits(): CommitData[] {
	return [
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
}
