import { FileEdge, FileNode } from "../types";

/**
 * Input data for building file tree - minimal file information
 */
export interface FileData {
	path: string;
	size: number;
	type?: "file" | "directory";
}

/**
 * Build a complete file tree with directory nodes from a list of files
 *
 * @param files - Array of file data with paths and sizes
 * @returns Array of FileNode objects including both files and generated directory nodes
 */
export function buildFileTree(files: FileData[]): FileNode[] {
	const nodes: FileNode[] = [];
	const pathMap = new Map<string, FileNode>();
	const directoriesNeeded = new Set<string>();
	let hasRootFiles = false;

	// First pass: create file nodes and identify needed directories
	files.forEach((file) => {
		const node: FileNode = {
			id: file.path,
			path: file.path,
			name: file.path.split("/").pop() || file.path,
			size: file.size,
			type: file.type || "file",
		};
		nodes.push(node);
		pathMap.set(file.path, node);

		// Identify all parent directories needed
		const pathParts = file.path.split("/");
		if (pathParts.length === 1) {
			hasRootFiles = true;
		}
		for (let i = 1; i < pathParts.length; i++) {
			const dirPath = pathParts.slice(0, i).join("/");
			directoriesNeeded.add(dirPath);
		}
	});

	// Second pass: create directory nodes
	directoriesNeeded.forEach((dirPath) => {
		if (!pathMap.has(dirPath)) {
			const dirNode: FileNode = {
				id: dirPath,
				path: dirPath,
				name: dirPath.split("/").pop() || dirPath,
				size: 0, // Directories have no size
				type: "directory",
			};
			nodes.push(dirNode);
			pathMap.set(dirPath, dirNode);
		}
	});

	// Add virtual root node if there are root-level files
	if (hasRootFiles) {
		const rootNode: FileNode = {
			id: "/",
			path: "/",
			name: "root",
			size: 0,
			type: "directory",
		};
		nodes.push(rootNode);
		pathMap.set("/", rootNode);
	}

	return nodes;
}

/**
 * Build parent-child edges showing directory hierarchy
 *
 * @param files - Array of file data with paths
 * @returns Array of FileEdge objects connecting parents to children
 */
export function buildEdges(files: FileData[]): FileEdge[] {
	const edges: FileEdge[] = [];

	// Build parent-child relationships based on file paths
	files.forEach((file) => {
		const pathParts = file.path.split("/");
		if (pathParts.length > 1) {
			// Connect to parent directory
			const parentPath = pathParts.slice(0, -1).join("/");
			edges.push({
				source: parentPath,
				target: file.path,
				type: "parent",
			});
		} else {
			// Root-level file - connect to virtual root
			edges.push({
				source: "/",
				target: file.path,
				type: "parent",
			});
		}
	});

	return edges;
}
