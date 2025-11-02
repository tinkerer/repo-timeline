export interface FileNode {
	id: string;
	path: string;
	name: string;
	size: number;
	type: "file" | "directory";
	x?: number;
	y?: number;
	z?: number;
	vx?: number;
	vy?: number;
	vz?: number;
	previousSize?: number; // Size in previous commit
	sizeChange?: "increase" | "decrease" | "unchanged"; // Change from previous commit
}

export interface FileEdge {
	source: string;
	target: string;
	type: "parent" | "dependency";
}

export interface CommitData {
	hash: string;
	message: string;
	author: string;
	date: Date;
	files: FileNode[];
	edges: FileEdge[];
}

export interface RepoTimeline {
	commits: CommitData[];
	currentIndex: number;
}

export interface FileChange {
	path: string;
	oldPath?: string;
	insertions: number;
	deletions: number;
	status: "added" | "modified" | "deleted" | "renamed";
}
