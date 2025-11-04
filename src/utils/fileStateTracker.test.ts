import { beforeEach, describe, expect, it } from "vitest";
import type { GitHubPRFile } from "../services/githubApiService";
import { FileStateTracker } from "./fileStateTracker";

describe("FileStateTracker", () => {
	let tracker: FileStateTracker;

	beforeEach(() => {
		tracker = new FileStateTracker();
	});

	describe("initialization", () => {
		it("should start with empty state", () => {
			const state = tracker.getFileState();
			expect(state).toEqual([]);
		});

		it("should return empty array from getFileData", () => {
			const data = tracker.getFileData();
			expect(data).toEqual([]);
		});
	});

	describe("file additions", () => {
		it("should track newly added file", () => {
			const prFiles: GitHubPRFile[] = [
				{
					filename: "src/index.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			];

			tracker.updateFromPRFiles(prFiles);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["src/index.ts", 100]);
		});

		it("should track multiple added files", () => {
			const prFiles: GitHubPRFile[] = [
				{
					filename: "src/index.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
				{
					filename: "src/app.ts",
					status: "added",
					additions: 200,
					deletions: 0,
					changes: 200,
				},
			];

			tracker.updateFromPRFiles(prFiles);

			const state = tracker.getFileState();
			expect(state).toHaveLength(2);
			expect(state).toContainEqual(["src/index.ts", 100]);
			expect(state).toContainEqual(["src/app.ts", 200]);
		});

		it("should calculate size from additions minus deletions for new file", () => {
			const prFiles: GitHubPRFile[] = [
				{
					filename: "test.ts",
					status: "added",
					additions: 150,
					deletions: 50, // Could happen if copied from another file
					changes: 200,
				},
			];

			tracker.updateFromPRFiles(prFiles);

			const state = tracker.getFileState();
			expect(state[0][1]).toBe(100); // 150 - 50
		});
	});

	describe("file modifications", () => {
		it("should apply delta to existing file", () => {
			// First PR: add file
			const pr1: GitHubPRFile[] = [
				{
					filename: "src/index.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			];
			tracker.updateFromPRFiles(pr1);

			// Second PR: modify file
			const pr2: GitHubPRFile[] = [
				{
					filename: "src/index.ts",
					status: "modified",
					additions: 20,
					deletions: 10,
					changes: 30,
				},
			];
			tracker.updateFromPRFiles(pr2);

			const state = tracker.getFileState();
			expect(state[0][1]).toBe(110); // 100 + 20 - 10
		});

		it("should handle multiple modifications to same file", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "modified",
					additions: 50,
					deletions: 20,
					changes: 70,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "modified",
					additions: 10,
					deletions: 5,
					changes: 15,
				},
			]);

			const state = tracker.getFileState();
			expect(state[0][1]).toBe(135); // 100 + 50 - 20 + 10 - 5
		});

		it("should allow file size to decrease", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "modified",
					additions: 0,
					deletions: 60,
					changes: 60,
				},
			]);

			const state = tracker.getFileState();
			expect(state[0][1]).toBe(40); // 100 - 60
		});
	});

	describe("file deletions", () => {
		it("should remove deleted file from state", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "removed",
					additions: 0,
					deletions: 100,
					changes: 100,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(0);
		});

		it("should handle deleting non-existent file gracefully", () => {
			tracker.updateFromPRFiles([
				{
					filename: "nonexistent.ts",
					status: "removed",
					additions: 0,
					deletions: 50,
					changes: 50,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(0);
		});

		it("should preserve other files when one is deleted", () => {
			tracker.updateFromPRFiles([
				{
					filename: "file1.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
				{
					filename: "file2.ts",
					status: "added",
					additions: 200,
					deletions: 0,
					changes: 200,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "file1.ts",
					status: "removed",
					additions: 0,
					deletions: 100,
					changes: 100,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["file2.ts", 200]);
		});
	});

	describe("file renames", () => {
		it("should handle simple rename", () => {
			tracker.updateFromPRFiles([
				{
					filename: "old.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "new.ts",
					status: "renamed",
					previous_filename: "old.ts",
					additions: 0,
					deletions: 0,
					changes: 0,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["new.ts", 100]);

			// Old file should not exist
			const hasOldFile = state.some(([path]) => path === "old.ts");
			expect(hasOldFile).toBe(false);
		});

		it("should handle rename with modifications", () => {
			tracker.updateFromPRFiles([
				{
					filename: "old.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "new.ts",
					status: "renamed",
					previous_filename: "old.ts",
					additions: 30,
					deletions: 10,
					changes: 40,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["new.ts", 120]); // 100 + 30 - 10
		});

		it("should handle rename without previous_filename gracefully", () => {
			tracker.updateFromPRFiles([
				{
					filename: "new.ts",
					status: "renamed",
					additions: 50,
					deletions: 10,
					changes: 60,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["new.ts", 40]); // Treated as new file: 0 + 50 - 10
		});

		it("should handle rename from non-tracked file", () => {
			tracker.updateFromPRFiles([
				{
					filename: "new.ts",
					status: "renamed",
					previous_filename: "nonexistent.ts",
					additions: 20,
					deletions: 5,
					changes: 25,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["new.ts", 15]); // 0 + 20 - 5
		});

		it("should handle multiple sequential renames", () => {
			tracker.updateFromPRFiles([
				{
					filename: "file1.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "file2.ts",
					status: "renamed",
					previous_filename: "file1.ts",
					additions: 10,
					deletions: 0,
					changes: 10,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "file3.ts",
					status: "renamed",
					previous_filename: "file2.ts",
					additions: 5,
					deletions: 0,
					changes: 5,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["file3.ts", 115]); // 100 + 10 + 5
		});
	});

	describe("complex scenarios", () => {
		it("should handle mixed operations in single PR", () => {
			tracker.updateFromPRFiles([
				{
					filename: "file1.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
				{
					filename: "file2.ts",
					status: "added",
					additions: 200,
					deletions: 0,
					changes: 200,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "file1.ts",
					status: "modified",
					additions: 20,
					deletions: 10,
					changes: 30,
				},
				{
					filename: "file2.ts",
					status: "removed",
					additions: 0,
					deletions: 200,
					changes: 200,
				},
				{
					filename: "file3.ts",
					status: "added",
					additions: 150,
					deletions: 0,
					changes: 150,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(2);
			expect(state).toContainEqual(["file1.ts", 110]); // 100 + 20 - 10
			expect(state).toContainEqual(["file3.ts", 150]);
		});

		it("should handle file added, deleted, and re-added", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "removed",
					additions: 0,
					deletions: 100,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 150,
					deletions: 0,
					changes: 150,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["test.ts", 150]);
		});

		it("should handle file renamed then deleted", () => {
			tracker.updateFromPRFiles([
				{
					filename: "old.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "new.ts",
					status: "renamed",
					previous_filename: "old.ts",
					additions: 0,
					deletions: 0,
					changes: 0,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "new.ts",
					status: "removed",
					additions: 0,
					deletions: 100,
					changes: 100,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(0);
		});

		it("should process multiple PRs in sequence correctly", () => {
			// PR 1: Initial files
			tracker.updateFromPRFiles([
				{
					filename: "a.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
				{
					filename: "b.ts",
					status: "added",
					additions: 200,
					deletions: 0,
					changes: 200,
				},
			]);

			// PR 2: Modify a.ts, rename b.ts
			tracker.updateFromPRFiles([
				{
					filename: "a.ts",
					status: "modified",
					additions: 50,
					deletions: 20,
					changes: 70,
				},
				{
					filename: "c.ts",
					status: "renamed",
					previous_filename: "b.ts",
					additions: 10,
					deletions: 5,
					changes: 15,
				},
			]);

			// PR 3: Add new file, delete a.ts
			tracker.updateFromPRFiles([
				{
					filename: "d.ts",
					status: "added",
					additions: 300,
					deletions: 0,
					changes: 300,
				},
				{
					filename: "a.ts",
					status: "removed",
					additions: 0,
					deletions: 130,
					changes: 130,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(2);
			expect(state).toContainEqual(["c.ts", 205]); // 200 + 10 - 5
			expect(state).toContainEqual(["d.ts", 300]);
		});
	});

	describe("getFileData", () => {
		it("should return data in correct format", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			const data = tracker.getFileData();
			expect(data).toHaveLength(1);
			expect(data[0]).toEqual({ path: "test.ts", size: 100 });
		});

		it("should filter out files with non-positive sizes", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 50,
					deletions: 0,
					changes: 50,
				},
			]);

			// This could theoretically make size negative
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "modified",
					additions: 0,
					deletions: 100,
					changes: 100,
				},
			]);

			const data = tracker.getFileData();
			// Files with size <= 0 are filtered out (effectively deleted)
			expect(data).toHaveLength(0);
		});

		it("should return multiple files", () => {
			tracker.updateFromPRFiles([
				{
					filename: "a.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
				{
					filename: "b.ts",
					status: "added",
					additions: 200,
					deletions: 0,
					changes: 200,
				},
			]);

			const data = tracker.getFileData();
			expect(data).toHaveLength(2);
			expect(data).toContainEqual({ path: "a.ts", size: 100 });
			expect(data).toContainEqual({ path: "b.ts", size: 200 });
		});
	});

	describe("clear", () => {
		it("should clear all tracked files", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test1.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
				{
					filename: "test2.ts",
					status: "added",
					additions: 200,
					deletions: 0,
					changes: 200,
				},
			]);

			tracker.clear();

			const state = tracker.getFileState();
			expect(state).toHaveLength(0);
		});

		it("should allow reuse after clearing", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.clear();

			tracker.updateFromPRFiles([
				{
					filename: "new.ts",
					status: "added",
					additions: 200,
					deletions: 0,
					changes: 200,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(1);
			expect(state[0]).toEqual(["new.ts", 200]);
		});
	});

	describe("edge cases", () => {
		it("should handle empty PR file list", () => {
			tracker.updateFromPRFiles([]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(0);
		});

		it("should handle zero additions and deletions", () => {
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "modified",
					additions: 0,
					deletions: 0,
					changes: 0,
				},
			]);

			const state = tracker.getFileState();
			expect(state[0][1]).toBe(100); // No change
		});

		it("should handle files with special characters in names", () => {
			tracker.updateFromPRFiles([
				{
					filename: "src/@types/index.d.ts",
					status: "added",
					additions: 50,
					deletions: 0,
					changes: 50,
				},
				{
					filename: "docs/API (v2).md",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
			]);

			const state = tracker.getFileState();
			expect(state).toHaveLength(2);
			expect(state).toContainEqual(["src/@types/index.d.ts", 50]);
			expect(state).toContainEqual(["docs/API (v2).md", 100]);
		});

		it("should handle very large file sizes", () => {
			tracker.updateFromPRFiles([
				{
					filename: "large.bin",
					status: "added",
					additions: 1000000,
					deletions: 0,
					changes: 1000000,
				},
			]);

			const state = tracker.getFileState();
			expect(state[0][1]).toBe(1000000);
		});

		it("should handle multiple operations on same file in single PR", () => {
			// This shouldn't happen in reality, but test defensive behavior
			tracker.updateFromPRFiles([
				{
					filename: "test.ts",
					status: "added",
					additions: 100,
					deletions: 0,
					changes: 100,
				},
				{
					filename: "test.ts",
					status: "modified",
					additions: 50,
					deletions: 20,
					changes: 70,
				},
			]);

			const state = tracker.getFileState();
			// Should process both operations
			expect(state[0][1]).toBe(130); // 100 + 50 - 20
		});
	});
});
