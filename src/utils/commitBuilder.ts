import type { CommitData } from "../types";
import type { FileStateTracker } from "./fileStateTracker";
import { buildEdges, buildFileTree } from "./fileTreeBuilder";

/**
 * Build a CommitData object from file state tracker data
 * This utility extracts the repeated pattern of building commits from file state
 *
 * @param sha - The commit SHA hash
 * @param message - The commit message
 * @param author - The commit author name
 * @param date - The commit date
 * @param fileStateTracker - The file state tracker containing current file state
 * @returns A CommitData object with nodes and edges built from the file state
 */
export function buildCommitFromFileState(
	sha: string,
	message: string,
	author: string,
	date: string,
	fileStateTracker: FileStateTracker,
): CommitData {
	// Build commit snapshot from current file state
	const fileData = fileStateTracker.getFileData();
	const files = buildFileTree(fileData);
	const edges = buildEdges(fileData);

	// Check for orphaned nodes
	const connectedNodes = new Set([
		...edges.map((e) => e.target),
		...edges.map((e) => e.source),
	]);
	const orphanedNodes = files.filter((n) => !connectedNodes.has(n.id));
	if (orphanedNodes.length > 0) {
		console.warn(
			`⚠️  Commit ${sha} has ${orphanedNodes.length} orphaned nodes:`,
			orphanedNodes.map((n) => `${n.path} (${n.type})`),
		);
		console.warn("  File data:", fileData);
		console.warn(
			"  Nodes:",
			files.map((n) => `${n.path} (${n.type})`),
		);
		console.warn(
			"  Edges:",
			edges.map((e) => `${e.source} → ${e.target}`),
		);
	}

	return {
		hash: sha,
		message,
		author,
		date: new Date(date),
		files,
		edges,
	};
}
