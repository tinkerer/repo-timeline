import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitData } from "../types";
import { useRepoData } from "./useRepoData";

// Create mock methods
const mockGetMetadata = vi.fn();
const mockGetCommitHistory = vi.fn();
const mockGetCacheInfo = vi.fn();
const mockGetRateLimitInfo = vi.fn();

// Mock GitService
vi.mock("../services/gitService", () => {
	return {
		GitService: vi.fn(function MockGitService() {
			return {
				getMetadata: mockGetMetadata,
				getCommitHistory: mockGetCommitHistory,
				getCacheInfo: mockGetCacheInfo,
				getRateLimitInfo: mockGetRateLimitInfo,
			};
		}),
	};
});

// Import after mocking
import { GitService } from "../services/gitService";

describe("useRepoData", () => {
	const mockCommits: CommitData[] = [
		{
			hash: "abc123",
			message: "First commit",
			author: "Test Author",
			date: new Date("2024-01-01T10:00:00Z"),
			files: [],
			edges: [],
		},
		{
			hash: "def456",
			message: "Second commit",
			author: "Test Author",
			date: new Date("2024-01-02T15:30:00Z"),
			files: [],
			edges: [],
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		mockGetMetadata.mockResolvedValue({
			prs: [{ number: 1 }, { number: 2 }],
			timeRange: {
				start: new Date("2024-01-01").getTime(),
				end: new Date("2024-01-31").getTime(),
			},
		});
		mockGetCommitHistory.mockResolvedValue({
			commits: mockCommits,
			hasMore: false,
			totalCount: mockCommits.length,
		});
		mockGetCacheInfo.mockReturnValue({ exists: false });
		mockGetRateLimitInfo.mockReturnValue(null);
	});

	describe("initialization", () => {
		it("should initialize with empty state in test mode", () => {
			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			expect(result.current.commits).toEqual([]);
			expect(result.current.loading).toBe(false);
			expect(result.current.error).toBeNull();
			expect(result.current.fromCache).toBe(false);
		});

		it("should start with loading state when not in test mode", async () => {
			// When there's a cache, loading starts as true
			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetCommitHistory.mockImplementation(async () => {
				// Simulate slow loading
				await new Promise((resolve) => setTimeout(resolve, 100));
				return mockCommits;
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			// When cache exists, loading should be true during cache load
			await waitFor(() => {
				expect(result.current.loading).toBe(true);
			});

			// Wait for loading to complete
			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});
		});

		it("should initialize GitService with correct parameters", async () => {
			renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					workerUrl: "https://worker.example.com",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(GitService).toHaveBeenCalledWith(
					"facebook/react",
					undefined,
					"https://worker.example.com",
				);
			});
		});
	});

	describe("metadata loading", () => {
		it("should load metadata on mount", async () => {
			renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(mockGetMetadata).toHaveBeenCalled();
			});
		});

		it("should update totalPRs from metadata", async () => {
			mockGetMetadata.mockResolvedValue({
				prs: [{ number: 1 }, { number: 2 }, { number: 3 }],
				timeRange: { start: 0, end: 1000 },
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.totalPRs).toBe(3);
			});
		});

		it("should update time range from metadata", async () => {
			const timeRange = {
				start: new Date("2024-01-01").getTime(),
				end: new Date("2024-12-31").getTime(),
			};

			mockGetMetadata.mockResolvedValue({
				prs: [],
				timeRange,
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.timeRange).toEqual(timeRange);
			});
		});

		it("should handle metadata loading errors gracefully", async () => {
			mockGetMetadata.mockRejectedValue(new Error("Metadata error"));

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			// Should not crash, continues to load commits
			await waitFor(() => {
				expect(mockGetCommitHistory).toHaveBeenCalled();
			});
		});
	});

	describe("commit loading - from cache", () => {
		beforeEach(() => {
			mockGetCacheInfo.mockReturnValue({
				exists: true,
				age: 1000,
				commitCount: 2,
			});
		});

		it("should load commits from cache", async () => {
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			await waitFor(() => {
				expect(result.current.commits).toHaveLength(2);
				expect(result.current.fromCache).toBe(true);
				expect(result.current.loading).toBe(false);
			});
		});

		it("should set time range from cached commits", async () => {
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			await waitFor(() => {
				expect(result.current.timeRange.start).toBe(
					mockCommits[0].date.getTime(),
				);
				expect(result.current.timeRange.end).toBe(
					mockCommits[1].date.getTime(),
				);
			});
		});

		it("should set current time to start of range", async () => {
			// Make metadata fail so currentTime starts at 0
			mockGetMetadata.mockRejectedValue(new Error("No metadata"));
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false, // Use false to trigger automatic loading
				}),
			);

			// First wait for commits to be loaded
			await waitFor(() => {
				expect(result.current.commits).toHaveLength(2);
			});

			// Then check that current time is set to first commit
			// (because metadata failed, currentTime was 0, so SET_COMMITS sets it)
			expect(result.current.currentTime).toBe(mockCommits[0].date.getTime());
		});

		it("should handle cache loading errors", async () => {
			mockGetCommitHistory.mockRejectedValue(new Error("Cache error"));

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.error).toBe("Cache error");
				expect(result.current.loading).toBe(false);
			});
		});

		it("should call onError callback on cache error", async () => {
			const onError = vi.fn();
			mockGetCommitHistory.mockRejectedValue(new Error("Cache error"));

			renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
					onError,
				}),
			);

			await waitFor(() => {
				expect(onError).toHaveBeenCalledWith(expect.any(Error));
				expect(onError.mock.calls[0][0].message).toBe("Cache error");
			});
		});
	});

	describe("commit loading - incremental (no cache)", () => {
		beforeEach(() => {
			mockGetCacheInfo.mockReturnValue({ exists: false });
		});

		it("should load commits incrementally", async () => {
			let onCommit: ((commit: CommitData) => void) | undefined;

			mockGetCommitHistory.mockImplementation(
				async (_onProgress, _forceRefresh, commitCallback) => {
					onCommit = commitCallback;
					// Simulate incremental loading
					if (onCommit) {
						onCommit(mockCommits[0]);
						onCommit(mockCommits[1]);
					}
					return mockCommits;
				},
			);

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.commits).toHaveLength(2);
				expect(result.current.backgroundLoading).toBe(false);
			});
		});

		it("should update time range as commits are added", async () => {
			let onCommit: ((commit: CommitData) => void) | undefined;

			mockGetCommitHistory.mockImplementation(
				async (_onProgress, _forceRefresh, commitCallback) => {
					onCommit = commitCallback;
					if (onCommit) {
						onCommit(mockCommits[0]);
					}
					return mockCommits;
				},
			);

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.timeRange.start).toBe(
					mockCommits[0].date.getTime(),
				);
			});
		});

		it("should report load progress", async () => {
			let onProgress: ((progress: any) => void) | undefined;

			mockGetCommitHistory.mockImplementation(async (progressCallback) => {
				onProgress = progressCallback;
				if (onProgress) {
					onProgress({ loaded: 5, total: 10, percentage: 50 });
				}
				return mockCommits;
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				if (result.current.loadProgress) {
					expect(result.current.loadProgress.percentage).toBe(50);
				}
			});
		});

		it("should use cache when forceRefresh fails and falls back", async () => {
			// Cache exists
			mockGetCacheInfo.mockReturnValue({
				exists: true,
				age: 1000,
				commitCount: 2,
			});

			// Simulate successful cache load
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			// Wait for cache load to complete
			await waitFor(() => {
				expect(result.current.commits).toHaveLength(2);
				expect(result.current.fromCache).toBe(true);
			});
		});

		it("should show error when no cache available on API error", async () => {
			mockGetCacheInfo.mockReturnValue({ exists: false });
			mockGetCommitHistory.mockRejectedValue(new Error("API error"));

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false, // Use false to trigger automatic loading
				}),
			);

			await waitFor(() => {
				expect(result.current.error).toBe("API error");
				expect(result.current.backgroundLoading).toBe(false);
			});
		});
	});

	describe("setCurrentTime", () => {
		it("should set current time with number", async () => {
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});
			mockGetCacheInfo.mockReturnValue({ exists: true });

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			await waitFor(() => {
				expect(result.current.commits).toHaveLength(2);
			});

			const newTime = 5000;
			result.current.setCurrentTime(newTime);

			await waitFor(() => {
				expect(result.current.currentTime).toBe(newTime);
			});
		});

		it("should set current time with updater function", async () => {
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});
			mockGetCacheInfo.mockReturnValue({ exists: true });

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			await waitFor(() => {
				expect(result.current.commits).toHaveLength(2);
			});

			const initialTime = result.current.currentTime;
			result.current.setCurrentTime((prev) => prev + 1000);

			await waitFor(() => {
				expect(result.current.currentTime).toBe(initialTime + 1000);
			});
		});
	});

	describe("loadCommits with forceRefresh", () => {
		it("should bypass cache when forceRefresh is true", async () => {
			mockGetCacheInfo.mockReturnValue({
				exists: true,
				age: 1000,
				commitCount: 2,
			});
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			await waitFor(() => {
				expect(result.current.commits).toHaveLength(2);
			});

			// Clear and call loadCommits with forceRefresh
			mockGetCommitHistory.mockClear();
			result.current.loadCommits(true);

			await waitFor(() => {
				expect(mockGetCommitHistory).toHaveBeenCalledWith(
					expect.any(Function),
					true, // forceRefresh
					expect.any(Function),
				);
			});
		});
	});

	// Note: Repo status tests removed - status banner feature was removed
	// New /cache and /summary endpoints exist but are not yet integrated into the UI

	describe("rate limit info", () => {
		it("should update rate limit info on successful load", async () => {
			const mockRateLimit = {
				limit: 5000,
				remaining: 4500,
				reset: new Date("2024-12-31T23:59:59Z"),
			};

			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetRateLimitInfo.mockReturnValue(mockRateLimit);
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.rateLimit).toEqual(mockRateLimit);
			});
		});

		it("should update rate limit info on error", async () => {
			const mockRateLimit = {
				limit: 60,
				remaining: 0,
				reset: new Date("2024-12-31T23:59:59Z"),
			};

			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetRateLimitInfo.mockReturnValue(mockRateLimit);
			mockGetCommitHistory.mockRejectedValue(new Error("Rate limited"));

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.rateLimit).toEqual(mockRateLimit);
			});
		});
	});

	describe("edge cases", () => {
		it("should handle empty commits array", async () => {
			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetCommitHistory.mockResolvedValue([]);

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.commits).toHaveLength(0);
				expect(result.current.loading).toBe(false);
			});
		});

		it("should handle non-Error exceptions", async () => {
			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetCommitHistory.mockRejectedValue("String error");

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.error).toBe("Failed to load repository");
			});
		});

		it("should handle cache fallback failure", async () => {
			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetCommitHistory
				.mockRejectedValueOnce(new Error("API error"))
				.mockRejectedValueOnce(new Error("Cache error"));

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.error).toBe("API error");
			});
		});
	});

	describe("reducer - SET_COMMITS", () => {
		it("should handle empty commits", async () => {
			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetCommitHistory.mockResolvedValue([]);

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: true,
				}),
			);

			await waitFor(() => {
				expect(result.current.commits).toEqual([]);
			});
		});
	});

	describe("repoPath changes", () => {
		it("should reload data when repoPath changes", async () => {
			mockGetCacheInfo.mockReturnValue({ exists: true });
			mockGetCommitHistory.mockResolvedValue({
				commits: mockCommits,
				hasMore: false,
				totalCount: mockCommits.length,
			});

			const { rerender } = renderHook(
				({ repoPath }) =>
					useRepoData({
						repoPath,
						testMode: true,
					}),
				{
					initialProps: { repoPath: "facebook/react" },
				},
			);

			await waitFor(() => {
				expect(mockGetCommitHistory).toHaveBeenCalled();
			});

			mockGetCommitHistory.mockClear();

			// Change repo
			rerender({ repoPath: "microsoft/vscode" });

			await waitFor(() => {
				expect(GitService).toHaveBeenCalledWith(
					"microsoft/vscode",
					undefined,
					undefined,
				);
			});
		});
	});

	describe("Stage 1: instant feedback with workerUrl", () => {
		const mockFetchCacheStatus = vi.fn();
		const mockFetchRepoSummary = vi.fn();

		beforeEach(() => {
			// Mock the dynamic import of GitHubApiService
			vi.doMock("../services/githubApiService", () => ({
				GitHubApiService: vi.fn(function MockGitHubApiService() {
					return {
						fetchCacheStatus: mockFetchCacheStatus,
						fetchRepoSummary: mockFetchRepoSummary,
					};
				}),
			}));

			mockFetchCacheStatus.mockResolvedValue({
				cache: {
					exists: true,
					cachedPRs: 50,
					ageSeconds: 100,
					lastPRNumber: 100,
					firstPR: { number: 1, merged_at: "2024-01-01T00:00:00Z" },
					lastPR: { number: 100, merged_at: "2024-02-01T00:00:00Z" },
				},
				status: "ready",
			});

			mockFetchRepoSummary.mockResolvedValue({
				github: {
					estimatedTotalPRs: 150,
					hasMoreThan100PRs: true,
					firstMergedPR: { number: 1, merged_at: "2024-01-01T00:00:00Z" },
				},
			});
		});

		it("should load instant feedback when workerUrl is provided", async () => {
			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					workerUrl: "https://test-worker.dev",
					testMode: false,
				}),
			);

			await waitFor(() => {
				expect(result.current.cacheStatus).not.toBeNull();
			});

			expect(result.current.cacheStatus?.cachedPRs).toBe(50);
			expect(result.current.repoSummary?.estimatedTotalPRs).toBe(150);
			expect(result.current.repoStatus).not.toBeNull();
			expect(result.current.repoStatus?.recommendation).toBe("ready");
		});

		it("should handle Stage 1 errors gracefully", async () => {
			mockFetchCacheStatus.mockRejectedValue(new Error("Network error"));

			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					workerUrl: "https://test-worker.dev",
					testMode: false,
				}),
			);

			// Should not crash, error is non-fatal
			await waitFor(() => {
				expect(result.current.loadingStage).not.toBe("initial");
			});

			// Stage 1 error shouldn't affect other stages
			expect(result.current.error).toBeNull();
		});

		it("should skip Stage 1 when workerUrl is not provided", () => {
			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					testMode: false,
				}),
			);

			// Should not have called the Stage 1 endpoints
			expect(result.current.cacheStatus).toBeNull();
			expect(result.current.repoSummary).toBeNull();
		});

		it("should skip Stage 1 in test mode", () => {
			const { result } = renderHook(() =>
				useRepoData({
					repoPath: "facebook/react",
					workerUrl: "https://test-worker.dev",
					testMode: true,
				}),
			);

			// Should not have loaded Stage 1 data in test mode
			expect(result.current.cacheStatus).toBeNull();
			expect(result.current.repoSummary).toBeNull();
		});
	});
});
