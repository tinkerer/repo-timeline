import { z } from "zod";

/**
 * Database schemas with Zod validation
 */

// Repo schema
export const RepoSchema = z.object({
	id: z.number().int().positive(),
	owner: z.string().min(1),
	name: z.string().min(1),
	full_name: z.string().min(1),
	last_updated: z.number().int().nonnegative(),
	last_pr_number: z.number().int().nonnegative().default(0),
	created_at: z.number().int().nonnegative(),
});

export type Repo = z.infer<typeof RepoSchema>;

// Pull Request schema
export const PullRequestSchema = z.object({
	id: z.number().int().positive(),
	repo_id: z.number().int().positive(),
	pr_number: z.number().int().positive(),
	title: z.string().min(1),
	author: z.string().min(1),
	merged_at: z.number().int().nonnegative(),
	created_at: z.number().int().nonnegative(),
});

export type PullRequest = z.infer<typeof PullRequestSchema>;

// PR File schema
export const PRFileSchema = z.object({
	id: z.number().int().positive().optional(),
	pr_id: z.number().int().positive(),
	filename: z.string().min(1),
	status: z.enum(["added", "modified", "removed", "renamed"]),
	additions: z.number().int().nonnegative().default(0),
	deletions: z.number().int().nonnegative().default(0),
	previous_filename: z.string().nullable().optional(),
});

export type PRFile = z.infer<typeof PRFileSchema>;

// GitHub API response schemas
export const GitHubUserSchema = z.object({
	login: z.string(),
	id: z.number().optional(),
	avatar_url: z.string().optional(),
});

export const GitHubPRFileSchema = z.object({
	filename: z.string(),
	status: z.string(),
	additions: z.number(),
	deletions: z.number(),
	changes: z.number().optional(),
	patch: z.string().optional(),
	previous_filename: z.string().optional(),
});

export const GitHubPRSchema = z.object({
	number: z.number(),
	title: z.string(),
	user: GitHubUserSchema,
	state: z.string(),
	merged_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	body: z.string().nullable().optional(),
	files: z.array(GitHubPRFileSchema).optional(),
});

export type GitHubPR = z.infer<typeof GitHubPRSchema>;

// API response schema (what we return to clients)
export const TimelineCommitSchema = z.object({
	hash: z.string(), // PR number as hash
	message: z.string(), // PR title
	author: z.string(), // PR author
	date: z.string(), // ISO 8601 date string
	files: z.array(
		z.object({
			id: z.string(),
			path: z.string(),
			name: z.string(),
			size: z.number(),
			type: z.literal("file"),
		}),
	),
	edges: z.array(z.any()).default([]),
});

export type TimelineCommit = z.infer<typeof TimelineCommitSchema>;

// Cache response schema
export const CacheResponseSchema = z.object({
	prs: z.array(GitHubPRSchema),
	lastUpdated: z.number(),
	lastPrNumber: z.number(),
});

export type CacheResponse = z.infer<typeof CacheResponseSchema>;

// Request validation
export const RepoParamsSchema = z.object({
	owner: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-zA-Z0-9-]+$/),
	repo: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-zA-Z0-9._-]+$/),
});

export type RepoParams = z.infer<typeof RepoParamsSchema>;

// GitHub Commit schemas (for new commit-based API)
export const GitHubCommitAuthorSchema = z.object({
	name: z.string(),
	email: z.string().optional(),
	date: z.string(),
});

export const GitHubCommitDetailsSchema = z.object({
	message: z.string(),
	author: GitHubCommitAuthorSchema,
	committer: GitHubCommitAuthorSchema.optional(),
});

export const GitHubCommitFileSchema = z.object({
	filename: z.string(),
	status: z.string(),
	additions: z.number(),
	deletions: z.number(),
	changes: z.number().optional(),
	patch: z.string().optional(),
	previous_filename: z.string().optional(),
});

export const GitHubCommitSchema = z.object({
	sha: z.string(),
	commit: GitHubCommitDetailsSchema,
	files: z.array(GitHubCommitFileSchema).optional(),
	url: z.string().optional(),
	html_url: z.string().optional(),
	comments_url: z.string().optional(),
	author: z.any().optional(),
	committer: z.any().optional(),
	parents: z.array(z.any()).optional(),
});

export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;
export type GitHubCommitFile = z.infer<typeof GitHubCommitFileSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
	error: z.string(),
	details: z.string().optional(),
	code: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
