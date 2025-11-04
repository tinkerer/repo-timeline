/**
 * Type definitions for the Repo Timeline Worker
 */

export interface Env {
	DB: D1Database;
	GITHUB_TOKENS: string; // Comma-separated list of tokens
}

export interface PRFile {
	filename: string;
	status: string;
	additions: number;
	deletions: number;
	previous_filename?: string;
}

export interface PullRequest {
	number: number;
	title: string;
	user: { login: string };
	merged_at: string;
	merge_commit_sha?: string;
}

export interface CachedRepo {
	prs: PullRequest[];
	lastUpdated: number;
	lastPrNumber: number;
}
