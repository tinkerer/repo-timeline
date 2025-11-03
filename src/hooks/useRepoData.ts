import { useCallback, useEffect, useReducer, useRef } from "react";
import { GitService, type LoadProgress, type RateLimitInfo } from "../services/gitService";
import type { CommitData } from "../types";

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
	| { type: "RESET_COMMITS" };

function repoDataReducer(
	state: RepoDataState,
	action: RepoDataAction,
): RepoDataState {
	switch (action.type) {
		case "SET_COMMITS":
			return { ...state, commits: action.commits };
		case "ADD_COMMIT":
			return { ...state, commits: [...state.commits, action.commit] };
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
	});

	const gitServiceRef = useRef<GitService | null>(null);

	// Load metadata first to get time range
	useEffect(() => {
		const loadMetadata = async () => {
			try {
				const gitService = new GitService(repoPath, undefined, workerUrl);
				const metadata = await gitService.getMetadata();

				dispatch({ type: "SET_TOTAL_PRS", count: metadata.prs.length });
				dispatch({ type: "SET_TIME_RANGE", range: metadata.timeRange });
				dispatch({ type: "SET_CURRENT_TIME", time: metadata.timeRange.start });

				console.log(
					`Loaded metadata: ${metadata.prs.length} PRs, time range: ${new Date(metadata.timeRange.start).toLocaleDateString()} - ${new Date(metadata.timeRange.end).toLocaleDateString()}`,
				);
			} catch (err) {
				console.error("Error loading metadata:", err);
				// Don't block - continue to load commits
			}
		};

		loadMetadata();
	}, [repoPath, workerUrl]);

	const loadCommits = useCallback(
		async (forceRefresh = false) => {
			const gitService = new GitService(
				repoPath,
				undefined, // No token needed - using worker
				workerUrl,
			);
			gitServiceRef.current = gitService;

			// Check if data was from cache
			const cacheInfo = gitService.getCacheInfo();
			const hasCache = cacheInfo.exists && !forceRefresh;

			if (hasCache) {
				// Load from cache immediately - no loading state
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
					dispatch({
						type: "SET_RATE_LIMIT",
						rateLimit: gitService.getRateLimitInfo(),
					});
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
				// Incremental loading - show visualization as data arrives
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
		setCurrentTime: (timeOrUpdater: number | ((prevTime: number) => number)) => {
			if (typeof timeOrUpdater === "function") {
				dispatch({ type: "SET_CURRENT_TIME", time: timeOrUpdater(state.currentTime) });
			} else {
				dispatch({ type: "SET_CURRENT_TIME", time: timeOrUpdater });
			}
		},
	};
}
