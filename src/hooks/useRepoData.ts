import { useCallback, useEffect, useReducer, useRef } from "react";
import {
	GitService,
	type LoadProgress,
	type RateLimitInfo,
} from "../services/gitService";
import type { CommitData } from "../types";

interface CacheStatus {
	exists: boolean;
	cachedPRs: number;
	ageSeconds: number | null;
	lastPRNumber: number | null;
	firstPR: { number: number; merged_at: string } | null;
	lastPR: { number: number; merged_at: string } | null;
}

interface RepoSummary {
	estimatedTotalPRs: number;
	hasMoreThan100PRs: boolean;
	firstMergedPR: { number: number; merged_at: string } | null;
}

interface RepoStatus {
	cache: CacheStatus;
	github: RepoSummary;
	recommendation: "ready" | "partial" | "fetching";
}

interface RepoDataState {
	commits: CommitData[];
	currentTime: number;
	timeRange: { start: number; end: number };
	totalPRs: number;
	loading: boolean;
	backgroundLoading: boolean;
	loadProgress: LoadProgress | null;
	error: string | null;
	rateLimit: RateLimitInfo | null;
	fromCache: boolean;
	rateLimitedCache: boolean;
	repoStatus: RepoStatus | null;
	cacheStatus: CacheStatus | null;
	repoSummary: RepoSummary | null;
	loadingStage:
		| "initial"
		| "cache-check"
		| "metadata"
		| "incremental"
		| "complete";
}

type RepoDataAction =
	| { type: "SET_COMMITS"; commits: CommitData[] }
	| { type: "ADD_COMMIT"; commit: CommitData }
	| { type: "SET_CURRENT_TIME"; time: number }
	| { type: "SET_TIME_RANGE"; range: { start: number; end: number } }
	| { type: "SET_TOTAL_PRS"; count: number }
	| { type: "SET_LOADING"; loading: boolean }
	| { type: "SET_BACKGROUND_LOADING"; loading: boolean }
	| { type: "SET_LOAD_PROGRESS"; progress: LoadProgress | null }
	| { type: "SET_ERROR"; error: string | null }
	| { type: "SET_RATE_LIMIT"; rateLimit: RateLimitInfo | null }
	| { type: "SET_FROM_CACHE"; fromCache: boolean }
	| { type: "SET_RATE_LIMITED_CACHE"; rateLimitedCache: boolean }
	| { type: "SET_REPO_STATUS"; status: RepoStatus | null }
	| { type: "SET_CACHE_STATUS"; status: CacheStatus | null }
	| { type: "SET_REPO_SUMMARY"; summary: RepoSummary | null }
	| { type: "SET_LOADING_STAGE"; stage: RepoDataState["loadingStage"] }
	| { type: "RESET_COMMITS" };

function repoDataReducer(
	state: RepoDataState,
	action: RepoDataAction,
): RepoDataState {
	switch (action.type) {
		case "SET_COMMITS": {
			// When setting commits in bulk (e.g., from cache), update time range
			if (action.commits.length > 0) {
				const times = action.commits.map((c) => c.date.getTime());
				const newTimeRange = {
					start: Math.min(...times),
					end: Math.max(...times),
				};
				const newCurrentTime =
					state.currentTime === 0 ? newTimeRange.start : state.currentTime;
				return {
					...state,
					commits: action.commits,
					timeRange: newTimeRange,
					currentTime: newCurrentTime,
				};
			}
			return { ...state, commits: action.commits };
		}
		case "ADD_COMMIT": {
			const newCommits = [...state.commits, action.commit];
			// Auto-update time range as commits are added
			const commitTime = action.commit.date.getTime();
			const newTimeRange = {
				start:
					state.commits.length === 0
						? commitTime
						: Math.min(commitTime, state.timeRange.start),
				end:
					state.commits.length === 0
						? commitTime
						: Math.max(commitTime, state.timeRange.end),
			};
			// Set current time to first commit if not initialized
			const newCurrentTime =
				state.currentTime === 0 ? commitTime : state.currentTime;
			return {
				...state,
				commits: newCommits,
				timeRange: newTimeRange,
				currentTime: newCurrentTime,
			};
		}
		case "SET_CURRENT_TIME":
			return { ...state, currentTime: action.time };
		case "SET_TIME_RANGE":
			return { ...state, timeRange: action.range };
		case "SET_TOTAL_PRS":
			return { ...state, totalPRs: action.count };
		case "SET_LOADING":
			return { ...state, loading: action.loading };
		case "SET_BACKGROUND_LOADING":
			return { ...state, backgroundLoading: action.loading };
		case "SET_LOAD_PROGRESS":
			return { ...state, loadProgress: action.progress };
		case "SET_ERROR":
			return { ...state, error: action.error };
		case "SET_RATE_LIMIT":
			return { ...state, rateLimit: action.rateLimit };
		case "SET_FROM_CACHE":
			return { ...state, fromCache: action.fromCache };
		case "SET_RATE_LIMITED_CACHE":
			return { ...state, rateLimitedCache: action.rateLimitedCache };
		case "SET_REPO_STATUS":
			return { ...state, repoStatus: action.status };
		case "SET_CACHE_STATUS":
			return { ...state, cacheStatus: action.status };
		case "SET_REPO_SUMMARY":
			return { ...state, repoSummary: action.summary };
		case "SET_LOADING_STAGE":
			return { ...state, loadingStage: action.stage };
		case "RESET_COMMITS":
			return { ...state, commits: [] };
		default:
			return state;
	}
}

interface UseRepoDataOptions {
	repoPath: string;
	workerUrl?: string;
	testMode?: boolean;
	onError?: (error: Error) => void;
}

export function useRepoData({
	repoPath,
	workerUrl,
	testMode = false,
	onError,
}: UseRepoDataOptions) {
	const [state, dispatch] = useReducer(repoDataReducer, {
		commits: [],
		currentTime: 0,
		timeRange: { start: 0, end: Date.now() },
		totalPRs: 0,
		loading: testMode ? false : true,
		backgroundLoading: false,
		loadProgress: null,
		error: null,
		rateLimit: null,
		fromCache: false,
		rateLimitedCache: false,
		repoStatus: null,
		cacheStatus: null,
		repoSummary: null,
		loadingStage: "initial",
	});

	const gitServiceRef = useRef<GitService | null>(null);

	// Stage 1: Instant feedback - parallel cache status + repo summary (only with workerUrl)
	useEffect(() => {
		if (!workerUrl || testMode) return;

		const loadInstantFeedback = async () => {
			console.log(
				"[useRepoData Stage 1] Fetching cache status and repo summary",
			);
			dispatch({ type: "SET_LOADING_STAGE", stage: "cache-check" });

			try {
				const { GitHubApiService } = await import(
					"../services/githubApiService"
				);
				const githubApiService = new GitHubApiService(
					repoPath,
					undefined,
					workerUrl,
				);

				// Parallel fetch for instant feedback (~1.5s total)
				const [cacheStatus, summary] = await Promise.all([
					githubApiService.fetchCacheStatus(),
					githubApiService.fetchRepoSummary(),
				]);

				dispatch({ type: "SET_CACHE_STATUS", status: cacheStatus.cache });
				dispatch({ type: "SET_REPO_SUMMARY", summary: summary.github });

				console.log(
					`[Stage 1] Cache: ${cacheStatus.cache.cachedPRs} PRs (${cacheStatus.status}) | Repo: ~${summary.github.estimatedTotalPRs} PRs`,
				);

				// Build combined status
				const status: RepoStatus = {
					cache: cacheStatus.cache,
					github: summary.github,
					recommendation: cacheStatus.status,
				};
				dispatch({ type: "SET_REPO_STATUS", status });
			} catch (err) {
				console.error("[Stage 1] Error loading instant feedback:", err);
				// Non-fatal - continue to metadata
			}
		};

		loadInstantFeedback();
	}, [repoPath, workerUrl, testMode]);

	// Stage 2: Load metadata to build timeline structure
	useEffect(() => {
		const loadMetadata = async () => {
			console.log("[useRepoData Stage 2] Loading metadata for:", repoPath);
			dispatch({ type: "SET_LOADING_STAGE", stage: "metadata" });

			try {
				const gitService = new GitService(repoPath, undefined, workerUrl);
				const metadata = await gitService.getMetadata();

				dispatch({ type: "SET_TOTAL_PRS", count: metadata.prs.length });
				dispatch({ type: "SET_TIME_RANGE", range: metadata.timeRange });
				dispatch({ type: "SET_CURRENT_TIME", time: metadata.timeRange.start });

				console.log(
					`[Stage 2] Metadata: ${metadata.prs.length} PRs from ${new Date(metadata.timeRange.start).toLocaleDateString()} to ${new Date(metadata.timeRange.end).toLocaleDateString()}`,
				);
			} catch (err) {
				console.error("[Stage 2] Error loading metadata:", err);
				// Don't block - continue to load commits
			}
		};

		loadMetadata();
	}, [repoPath, workerUrl]);

	const loadCommits = useCallback(
		async (forceRefresh = false) => {
			console.log(
				"[useRepoData] loadCommits called - forceRefresh:",
				forceRefresh,
				"repoPath:",
				repoPath,
			);
			const gitService = new GitService(
				repoPath,
				undefined, // No token needed - using worker
				workerUrl,
			);
			gitServiceRef.current = gitService;

			// Check if data was from cache
			const cacheInfo = gitService.getCacheInfo();
			const hasCache = cacheInfo.exists && !forceRefresh;
			console.log(
				"[useRepoData] Cache check - hasCache:",
				hasCache,
				"cacheInfo:",
				cacheInfo,
			);

			if (hasCache) {
				// Load from cache immediately
				console.log("[useRepoData] Loading from cache...");
				dispatch({ type: "SET_LOADING", loading: true });
				dispatch({ type: "SET_LOAD_PROGRESS", progress: null });
				try {
					const commitsData = await gitService.getCommitHistory((progress) => {
						dispatch({ type: "SET_LOAD_PROGRESS", progress });
					}, forceRefresh);
					dispatch({ type: "SET_COMMITS", commits: commitsData });
					dispatch({ type: "SET_FROM_CACHE", fromCache: true });
					dispatch({ type: "SET_RATE_LIMITED_CACHE", rateLimitedCache: false });
					dispatch({ type: "SET_LOADING", loading: false });
					dispatch({ type: "SET_ERROR", error: null });
					dispatch({ type: "SET_LOADING_STAGE", stage: "complete" });
					dispatch({
						type: "SET_RATE_LIMIT",
						rateLimit: gitService.getRateLimitInfo(),
					});
					console.log("[Cache] Loading complete");
				} catch (err) {
					console.error("Error loading commits:", err);
					const error =
						err instanceof Error ? err : new Error("Failed to load repository");
					dispatch({ type: "SET_ERROR", error: error.message });
					dispatch({ type: "SET_LOADING", loading: false });
					dispatch({ type: "SET_RATE_LIMITED_CACHE", rateLimitedCache: false });
					dispatch({
						type: "SET_RATE_LIMIT",
						rateLimit: gitService.getRateLimitInfo(),
					});
					if (onError) {
						onError(error);
					}
				}
			} else {
				// Stage 3: Incremental loading - show visualization as data arrives
				console.log(
					"[useRepoData Stage 3] No cache, loading incrementally from API...",
				);
				dispatch({ type: "SET_LOADING_STAGE", stage: "incremental" });
				dispatch({ type: "SET_LOADING", loading: false });
				dispatch({ type: "SET_BACKGROUND_LOADING", loading: true });
				dispatch({ type: "SET_LOAD_PROGRESS", progress: null });
				dispatch({ type: "RESET_COMMITS" });
				dispatch({ type: "SET_FROM_CACHE", fromCache: false });

				try {
					await gitService.getCommitHistory(
						(progress) => {
							dispatch({ type: "SET_LOAD_PROGRESS", progress });
						},
						forceRefresh,
						(commit) => {
							// Add commit incrementally
							// Reducer will auto-update time range and current time
							dispatch({ type: "ADD_COMMIT", commit });
						},
					);
				} catch (err) {
					console.error("Error loading commits:", err);

					// If we hit an error (like rate limiting), try to load from cache
					if (cacheInfo.exists) {
						console.log("Falling back to cached data due to error");
						try {
							const cachedCommits = await gitService.getCommitHistory(
								undefined, // no progress updates needed
								false, // don't force refresh
							);
							dispatch({ type: "SET_COMMITS", commits: cachedCommits });
							dispatch({ type: "SET_FROM_CACHE", fromCache: true });
							dispatch({
								type: "SET_RATE_LIMITED_CACHE",
								rateLimitedCache: true,
							});
							dispatch({ type: "SET_ERROR", error: null });
							// Show a warning instead of error
							console.warn(
								"Using cached data due to API error:",
								err instanceof Error ? err.message : "Unknown error",
							);
						} catch (_cacheErr) {
							// If cache also fails, show the original error
							dispatch({
								type: "SET_ERROR",
								error:
									err instanceof Error
										? err.message
										: "Failed to load repository",
							});
							dispatch({
								type: "SET_RATE_LIMITED_CACHE",
								rateLimitedCache: false,
							});
						}
					} else {
						// No cache available, show error
						dispatch({
							type: "SET_ERROR",
							error:
								err instanceof Error
									? err.message
									: "Failed to load repository",
						});
						dispatch({
							type: "SET_RATE_LIMITED_CACHE",
							rateLimitedCache: false,
						});
					}
					dispatch({
						type: "SET_RATE_LIMIT",
						rateLimit: gitService.getRateLimitInfo(),
					});
				} finally {
					dispatch({ type: "SET_BACKGROUND_LOADING", loading: false });
					dispatch({ type: "SET_LOAD_PROGRESS", progress: null });
					dispatch({ type: "SET_LOADING_STAGE", stage: "complete" });
					console.log("[Stage 3] Incremental loading complete");
				}
			}
		},
		[repoPath, workerUrl, onError],
	);

	useEffect(() => {
		loadCommits();
	}, [loadCommits]);

	return {
		...state,
		loadCommits,
		setCurrentTime: (
			timeOrUpdater: number | ((prevTime: number) => number),
		) => {
			if (typeof timeOrUpdater === "function") {
				dispatch({
					type: "SET_CURRENT_TIME",
					time: timeOrUpdater(state.currentTime),
				});
			} else {
				dispatch({ type: "SET_CURRENT_TIME", time: timeOrUpdater });
			}
		},
	};
}
