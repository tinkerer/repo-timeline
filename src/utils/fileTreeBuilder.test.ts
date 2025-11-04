import { describe, expect, it } from "vitest";
import { buildEdges, buildFileTree, type FileData } from "./fileTreeBuilder";

describe("buildFileTree", () => {
	describe("basic file tree construction", () => {
		it("should create nodes for single root-level file", () => {
			const files: FileData[] = [{ path: "README.md", size: 100 }];

			const nodes = buildFileTree(files);

			// Should have: file + virtual root
			expect(nodes).toHaveLength(2);

			const fileNode = nodes.find((n) => n.path === "README.md");
			expect(fileNode).toEqual({
				id: "README.md",
				path: "README.md",
				name: "README.md",
				size: 100,
				type: "file",
			});

			const rootNode = nodes.find((n) => n.path === "/");
			expect(rootNode).toEqual({
				id: "/",
				path: "/",
				name: "root",
				size: 0,
				type: "directory",
			});
		});

		it("should create nodes for multiple root-level files", () => {
			const files: FileData[] = [
				{ path: "README.md", size: 100 },
				{ path: "package.json", size: 200 },
			];

			const nodes = buildFileTree(files);

			// Should have: 2 files + virtual root
			expect(nodes).toHaveLength(3);

			const readmeNode = nodes.find((n) => n.path === "README.md");
			expect(readmeNode?.size).toBe(100);

			const packageNode = nodes.find((n) => n.path === "package.json");
			expect(packageNode?.size).toBe(200);

			const rootNode = nodes.find((n) => n.path === "/");
			expect(rootNode?.type).toBe("directory");
		});

		it("should create file in single directory", () => {
			const files: FileData[] = [{ path: "src/index.ts", size: 500 }];

			const nodes = buildFileTree(files);

			// Should have: file + src directory + virtual root
			expect(nodes).toHaveLength(3);

			const fileNode = nodes.find((n) => n.path === "src/index.ts");
			expect(fileNode).toEqual({
				id: "src/index.ts",
				path: "src/index.ts",
				name: "index.ts",
				size: 500,
				type: "file",
			});

			const dirNode = nodes.find((n) => n.path === "src");
			expect(dirNode).toEqual({
				id: "src",
				path: "src",
				name: "src",
				size: 0,
				type: "directory",
			});
		});

		it("should extract correct filename from path", () => {
			const files: FileData[] = [{ path: "src/utils/helpers.ts", size: 300 }];

			const nodes = buildFileTree(files);

			const fileNode = nodes.find((n) => n.path === "src/utils/helpers.ts");
			expect(fileNode?.name).toBe("helpers.ts");

			const utilsDir = nodes.find((n) => n.path === "src/utils");
			expect(utilsDir?.name).toBe("utils");

			const srcDir = nodes.find((n) => n.path === "src");
			expect(srcDir?.name).toBe("src");
		});
	});

	describe("nested directory structure", () => {
		it("should create all intermediate directory nodes", () => {
			const files: FileData[] = [
				{ path: "src/components/Button.tsx", size: 400 },
			];

			const nodes = buildFileTree(files);

			// Should have: file + src dir + components dir + root
			expect(nodes).toHaveLength(4);

			expect(nodes.find((n) => n.path === "src")).toBeDefined();
			expect(nodes.find((n) => n.path === "src/components")).toBeDefined();
			expect(
				nodes.find((n) => n.path === "src/components/Button.tsx"),
			).toBeDefined();

			// All directories should have size 0
			const srcDir = nodes.find((n) => n.path === "src");
			expect(srcDir?.size).toBe(0);
			expect(srcDir?.type).toBe("directory");

			const componentsDir = nodes.find((n) => n.path === "src/components");
			expect(componentsDir?.size).toBe(0);
			expect(componentsDir?.type).toBe("directory");
		});

		it("should handle deeply nested paths", () => {
			const files: FileData[] = [{ path: "a/b/c/d/e/file.txt", size: 100 }];

			const nodes = buildFileTree(files);

			// Should have: file + 5 directory nodes (a, a/b, a/b/c, a/b/c/d, a/b/c/d/e) + root
			expect(nodes).toHaveLength(7);

			expect(nodes.find((n) => n.path === "a")).toBeDefined();
			expect(nodes.find((n) => n.path === "a/b")).toBeDefined();
			expect(nodes.find((n) => n.path === "a/b/c")).toBeDefined();
			expect(nodes.find((n) => n.path === "a/b/c/d")).toBeDefined();
			expect(nodes.find((n) => n.path === "a/b/c/d/e")).toBeDefined();
			expect(nodes.find((n) => n.path === "a/b/c/d/e/file.txt")).toBeDefined();
		});

		it("should not duplicate directory nodes when multiple files share path", () => {
			const files: FileData[] = [
				{ path: "src/utils/helpers.ts", size: 100 },
				{ path: "src/utils/constants.ts", size: 200 },
			];

			const nodes = buildFileTree(files);

			// Should have: 2 files + src dir + utils dir + root
			expect(nodes).toHaveLength(5);

			const utilsDirs = nodes.filter((n) => n.path === "src/utils");
			expect(utilsDirs).toHaveLength(1);

			const srcDirs = nodes.filter((n) => n.path === "src");
			expect(srcDirs).toHaveLength(1);
		});
	});

	describe("mixed root and nested files", () => {
		it("should handle both root-level and nested files", () => {
			const files: FileData[] = [
				{ path: "README.md", size: 100 },
				{ path: "src/index.ts", size: 200 },
			];

			const nodes = buildFileTree(files);

			// Should have: 2 files + src dir + virtual root
			expect(nodes).toHaveLength(4);

			// Virtual root should exist
			expect(nodes.find((n) => n.path === "/")).toBeDefined();
		});

		it("should create complex tree with multiple levels", () => {
			const files: FileData[] = [
				{ path: "package.json", size: 100 },
				{ path: "src/index.ts", size: 200 },
				{ path: "src/components/Button.tsx", size: 300 },
				{ path: "src/utils/helpers.ts", size: 150 },
				{ path: "tests/unit/Button.test.tsx", size: 250 },
			];

			const nodes = buildFileTree(files);

			// Files: 5
			// Directories: src, src/components, src/utils, tests, tests/unit
			// Virtual root: /
			// Total: 11
			expect(nodes).toHaveLength(11);

			// Check all expected nodes exist
			expect(nodes.find((n) => n.path === "/")).toBeDefined();
			expect(nodes.find((n) => n.path === "package.json")).toBeDefined();
			expect(nodes.find((n) => n.path === "src")).toBeDefined();
			expect(nodes.find((n) => n.path === "src/components")).toBeDefined();
			expect(nodes.find((n) => n.path === "src/utils")).toBeDefined();
			expect(nodes.find((n) => n.path === "tests")).toBeDefined();
			expect(nodes.find((n) => n.path === "tests/unit")).toBeDefined();
		});
	});

	describe("edge cases", () => {
		it("should handle empty file list", () => {
			const files: FileData[] = [];

			const nodes = buildFileTree(files);

			expect(nodes).toHaveLength(0);
		});

		it("should handle file with explicit type", () => {
			const files: FileData[] = [
				{ path: "src/index.ts", size: 100, type: "file" },
			];

			const nodes = buildFileTree(files);

			const fileNode = nodes.find((n) => n.path === "src/index.ts");
			expect(fileNode?.type).toBe("file");
		});

		it("should handle directory as input (edge case)", () => {
			const files: FileData[] = [{ path: "src", size: 0, type: "directory" }];

			const nodes = buildFileTree(files);

			// Should have: directory node + virtual root
			expect(nodes).toHaveLength(2);

			const dirNode = nodes.find((n) => n.path === "src");
			expect(dirNode?.type).toBe("directory");
		});

		it("should handle files with dots in directory names", () => {
			const files: FileData[] = [
				{ path: ".github/workflows/test.yml", size: 100 },
			];

			const nodes = buildFileTree(files);

			expect(nodes.find((n) => n.path === ".github")).toBeDefined();
			expect(nodes.find((n) => n.path === ".github/workflows")).toBeDefined();

			const fileNode = nodes.find(
				(n) => n.path === ".github/workflows/test.yml",
			);
			expect(fileNode?.name).toBe("test.yml");
		});

		it("should handle single character paths", () => {
			const files: FileData[] = [
				{ path: "a", size: 100 },
				{ path: "b/c", size: 200 },
			];

			const nodes = buildFileTree(files);

			expect(nodes.find((n) => n.path === "a")).toBeDefined();
			expect(nodes.find((n) => n.path === "b")).toBeDefined();
			expect(nodes.find((n) => n.path === "/")).toBeDefined();
		});

		it("should always create virtual root when files exist", () => {
			const files: FileData[] = [
				{ path: "src/index.ts", size: 100 },
				{ path: "src/utils/helpers.ts", size: 200 },
			];

			const nodes = buildFileTree(files);

			const rootNode = nodes.find((n) => n.path === "/");
			expect(rootNode).toBeDefined();
			expect(rootNode?.type).toBe("directory");
		});
	});

	describe("file sizes", () => {
		it("should preserve file sizes", () => {
			const files: FileData[] = [
				{ path: "small.txt", size: 10 },
				{ path: "large.txt", size: 1000000 },
			];

			const nodes = buildFileTree(files);

			const smallFile = nodes.find((n) => n.path === "small.txt");
			expect(smallFile?.size).toBe(10);

			const largeFile = nodes.find((n) => n.path === "large.txt");
			expect(largeFile?.size).toBe(1000000);
		});

		it("should set directory sizes to 0", () => {
			const files: FileData[] = [
				{ path: "src/components/Button.tsx", size: 500 },
			];

			const nodes = buildFileTree(files);

			const srcDir = nodes.find((n) => n.path === "src");
			expect(srcDir?.size).toBe(0);

			const componentsDir = nodes.find((n) => n.path === "src/components");
			expect(componentsDir?.size).toBe(0);
		});

		it("should handle zero-sized files", () => {
			const files: FileData[] = [{ path: "empty.txt", size: 0 }];

			const nodes = buildFileTree(files);

			const fileNode = nodes.find((n) => n.path === "empty.txt");
			expect(fileNode?.size).toBe(0);
			expect(fileNode?.type).toBe("file");
		});
	});
});

describe("buildEdges", () => {
	describe("basic edge construction", () => {
		it("should create edge from virtual root to root-level file", () => {
			const files: FileData[] = [{ path: "README.md", size: 100 }];

			const edges = buildEdges(files);

			expect(edges).toHaveLength(1);
			expect(edges[0]).toEqual({
				source: "/",
				target: "README.md",
				type: "parent",
			});
		});

		it("should create edges for multiple root-level files", () => {
			const files: FileData[] = [
				{ path: "README.md", size: 100 },
				{ path: "package.json", size: 200 },
			];

			const edges = buildEdges(files);

			expect(edges).toHaveLength(2);
			expect(edges).toContainEqual({
				source: "/",
				target: "README.md",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "/",
				target: "package.json",
				type: "parent",
			});
		});

		it("should create edge from directory to file", () => {
			const files: FileData[] = [{ path: "src/index.ts", size: 100 }];

			const edges = buildEdges(files);

			// Now includes: / -> src, src -> src/index.ts
			expect(edges).toHaveLength(2);
			expect(edges).toContainEqual({
				source: "/",
				target: "src",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src",
				target: "src/index.ts",
				type: "parent",
			});
		});

		it("should create edges for nested directories", () => {
			const files: FileData[] = [
				{ path: "src/components/Button.tsx", size: 100 },
			];

			const edges = buildEdges(files);

			// Now creates directory-to-directory edges:
			// / -> src, src -> src/components, src/components -> src/components/Button.tsx
			expect(edges).toHaveLength(3);
			expect(edges).toContainEqual({
				source: "/",
				target: "src",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src",
				target: "src/components",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src/components",
				target: "src/components/Button.tsx",
				type: "parent",
			});
		});
	});

	describe("multiple files in same directory", () => {
		it("should create separate edges for files in same directory", () => {
			const files: FileData[] = [
				{ path: "src/index.ts", size: 100 },
				{ path: "src/app.ts", size: 200 },
			];

			const edges = buildEdges(files);

			// Now includes: / -> src, src -> src/index.ts, src -> src/app.ts
			expect(edges).toHaveLength(3);
			expect(edges).toContainEqual({
				source: "/",
				target: "src",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src",
				target: "src/index.ts",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src",
				target: "src/app.ts",
				type: "parent",
			});
		});

		it("should handle complex tree structure", () => {
			const files: FileData[] = [
				{ path: "package.json", size: 100 },
				{ path: "src/index.ts", size: 200 },
				{ path: "src/components/Button.tsx", size: 300 },
				{ path: "src/utils/helpers.ts", size: 150 },
			];

			const edges = buildEdges(files);

			// Now includes directory-to-directory edges:
			// / -> package.json, / -> src, src -> src/index.ts,
			// src -> src/components, src/components -> Button.tsx,
			// src -> src/utils, src/utils -> helpers.ts
			expect(edges).toHaveLength(7);

			// Root-level file
			expect(edges).toContainEqual({
				source: "/",
				target: "package.json",
				type: "parent",
			});

			// First-level nested files
			expect(edges).toContainEqual({
				source: "src",
				target: "src/index.ts",
				type: "parent",
			});

			// Second-level nested files
			expect(edges).toContainEqual({
				source: "src/components",
				target: "src/components/Button.tsx",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src/utils",
				target: "src/utils/helpers.ts",
				type: "parent",
			});
		});
	});

	describe("edge cases", () => {
		it("should handle empty file list", () => {
			const files: FileData[] = [];

			const edges = buildEdges(files);

			expect(edges).toHaveLength(0);
		});

		it("should handle deeply nested file", () => {
			const files: FileData[] = [{ path: "a/b/c/d/file.txt", size: 100 }];

			const edges = buildEdges(files);

			// Now includes all directory-to-directory edges:
			// / -> a, a -> a/b, a/b -> a/b/c, a/b/c -> a/b/c/d, a/b/c/d -> file.txt
			expect(edges).toHaveLength(5);
			expect(edges).toContainEqual({
				source: "/",
				target: "a",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "a",
				target: "a/b",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "a/b",
				target: "a/b/c",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "a/b/c",
				target: "a/b/c/d",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "a/b/c/d",
				target: "a/b/c/d/file.txt",
				type: "parent",
			});
		});

		it("should handle single character paths", () => {
			const files: FileData[] = [
				{ path: "a", size: 100 },
				{ path: "b/c", size: 200 },
			];

			const edges = buildEdges(files);

			// Now includes: / -> a, / -> b, b -> b/c
			expect(edges).toHaveLength(3);
			expect(edges).toContainEqual({
				source: "/",
				target: "a",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "/",
				target: "b",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "b",
				target: "b/c",
				type: "parent",
			});
		});

		it("should always use type parent for all edges", () => {
			const files: FileData[] = [
				{ path: "README.md", size: 100 },
				{ path: "src/index.ts", size: 200 },
			];

			const edges = buildEdges(files);

			edges.forEach((edge) => {
				expect(edge.type).toBe("parent");
			});
		});
	});

	describe("edge source/target correctness", () => {
		it("should connect all directory levels", () => {
			const files: FileData[] = [
				{ path: "src/components/ui/Button.tsx", size: 100 },
			];

			const edges = buildEdges(files);

			// Now creates full directory chain:
			// / -> src, src -> src/components, src/components -> src/components/ui,
			// src/components/ui -> src/components/ui/Button.tsx
			expect(edges).toHaveLength(4);
			expect(edges).toContainEqual({
				source: "/",
				target: "src",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src",
				target: "src/components",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src/components",
				target: "src/components/ui",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "src/components/ui",
				target: "src/components/ui/Button.tsx",
				type: "parent",
			});
		});

		it("should handle mixed file depths correctly", () => {
			const files: FileData[] = [
				{ path: "a.txt", size: 100 },
				{ path: "b/c.txt", size: 200 },
				{ path: "d/e/f.txt", size: 300 },
			];

			const edges = buildEdges(files);

			// Now includes directory edges:
			// / -> a.txt, / -> b, b -> b/c.txt, / -> d, d -> d/e, d/e -> d/e/f.txt
			expect(edges).toHaveLength(6);

			// Root-level file connects to /
			const rootEdge = edges.find((e) => e.target === "a.txt");
			expect(rootEdge?.source).toBe("/");

			// One-level deep
			const oneLevel = edges.find((e) => e.target === "b/c.txt");
			expect(oneLevel?.source).toBe("b");

			// Two-level deep
			const twoLevel = edges.find((e) => e.target === "d/e/f.txt");
			expect(twoLevel?.source).toBe("d/e");

			// Check directory edges exist
			expect(edges).toContainEqual({
				source: "/",
				target: "b",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "/",
				target: "d",
				type: "parent",
			});
			expect(edges).toContainEqual({
				source: "d",
				target: "d/e",
				type: "parent",
			});
		});
	});
});

describe("buildFileTree and buildEdges integration", () => {
	it("should create matching nodes and edges for simple structure", () => {
		const files: FileData[] = [
			{ path: "README.md", size: 100 },
			{ path: "src/index.ts", size: 200 },
		];

		const nodes = buildFileTree(files);
		const edges = buildEdges(files);

		// Every edge target should exist as a node
		edges.forEach((edge) => {
			const targetNode = nodes.find((n) => n.id === edge.target);
			expect(targetNode).toBeDefined();
		});

		// Every edge source should exist as a node (or be virtual root)
		edges.forEach((edge) => {
			const sourceNode = nodes.find((n) => n.id === edge.source);
			expect(sourceNode).toBeDefined();
		});
	});

	it("should create valid tree structure for complex project", () => {
		const files: FileData[] = [
			{ path: "package.json", size: 1000 },
			{ path: "tsconfig.json", size: 500 },
			{ path: "src/index.ts", size: 2000 },
			{ path: "src/types.ts", size: 1500 },
			{ path: "src/components/App.tsx", size: 3000 },
			{ path: "src/components/Header.tsx", size: 1000 },
			{ path: "src/utils/helpers.ts", size: 800 },
			{ path: "tests/App.test.tsx", size: 1200 },
		];

		const nodes = buildFileTree(files);
		const edges = buildEdges(files);

		// All edges should reference valid nodes
		edges.forEach((edge) => {
			const sourceExists = nodes.some((n) => n.id === edge.source);
			const targetExists = nodes.some((n) => n.id === edge.target);
			expect(sourceExists).toBe(true);
			expect(targetExists).toBe(true);
		});

		// All file nodes should have corresponding edges
		const fileNodes = nodes.filter((n) => n.type === "file");
		expect(fileNodes).toHaveLength(8);

		fileNodes.forEach((fileNode) => {
			const edge = edges.find((e) => e.target === fileNode.id);
			expect(edge).toBeDefined();
		});
	});
});
