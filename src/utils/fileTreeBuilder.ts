import { FileEdge, FileNode } from "../types";

// Version marker to verify code updates
export const FILE_TREE_BUILDER_VERSION = "2025-11-04-v2";

/**
 * Input data for building file tree - minimal file information
 * Updated: 2025-11-04 00:00:00
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
	console.log(`🔨 buildFileTree called with ${files.length} files`);
	const nodes: FileNode[] = [];
	const pathMap = new Map<string, FileNode>();
	const directoriesNeeded = new Set<string>();

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

	// Always add virtual root node to anchor the graph
	// Only skip if there are no files at all
	if (files.length > 0 && !pathMap.has("/")) {
		const rootNode: FileNode = {
			id: "/",
			path: "/",
			name: "root",
			size: 0,
			type: "directory",
		};
		nodes.push(rootNode);
		pathMap.set("/", rootNode);
		console.log("✓ Created root node");
	} else if (files.length === 0) {
		console.log("✗ No root node: no files");
	} else if (pathMap.has("/")) {
		console.log("✗ No root node: already exists in pathMap");
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
	console.log(`🔗 buildEdges called with ${files.length} files`);
	const edges: FileEdge[] = [];
	const directoriesAdded = new Set<string>();

	// Build parent-child relationships based on file paths
	files.forEach((file) => {
		const pathParts = file.path.split("/");
		if (pathParts.length > 1) {
			// Connect to parent directory
			const parentPath = pathParts.slice(0, -1).join("/");
			console.log(`  File edge: ${parentPath} → ${file.path}`);
			edges.push({
				source: parentPath,
				target: file.path,
				type: "parent",
			});

			// Also create edges for ALL directories in the path (including top-level)
			// Start from i=0 to include the first directory level
			for (let i = 0; i < pathParts.length - 1; i++) {
				const dirPath = pathParts.slice(0, i + 1).join("/");
				const parentDirPath = i > 0 ? pathParts.slice(0, i).join("/") : "";

				// Avoid duplicate edges
				const edgeKey = `${parentDirPath || "/"}->${dirPath}`;
				if (!directoriesAdded.has(edgeKey)) {
					directoriesAdded.add(edgeKey);

					if (parentDirPath === "") {
						// Connect top-level directory to virtual root
						edges.push({
							source: "/",
							target: dirPath,
							type: "parent",
						});
					} else {
						// Connect directory to its parent
						edges.push({
							source: parentDirPath,
							target: dirPath,
							type: "parent",
						});
					}
				}
			}
		} else {
			// Root-level file - connect to virtual root
			edges.push({
				source: "/",
				target: file.path,
				type: "parent",
			});
		}
	});

	const rootEdges = edges.filter((e) => e.source === "/");
	console.log(
		`  ✓ Created ${edges.length} total edges, ${rootEdges.length} from root`,
	);
	if (rootEdges.length > 0) {
		console.log(
			`  Root edge targets:`,
			rootEdges.map((e) => e.target),
		);
	}

	return edges;
}
