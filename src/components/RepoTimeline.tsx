import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RateLimitInfo } from "../services/githubApiService";
import { GitService, LoadProgress } from "../services/gitService";
import { CommitData, FileEdge, FileNode } from "../types";
import { RateLimitDisplay } from "./RateLimitDisplay";
import { RepoGraph3D } from "./RepoGraph3D";
import {
	PlaybackDirection,
	PlaybackSpeed,
	TimelineScrubber,
} from "./TimelineScrubber";

// Cloudflare Worker URL for cached data
const WORKER_URL = "https://repo-timeline-api.personal-account-251.workers.dev";

interface RepoTimelineProps {
	repoPath: string;
	onBack?: () => void;
}

// TEST MODE: Set to true to bypass loading and show test scene
const TEST_MODE = false;

export function RepoTimeline({ repoPath, onBack }: RepoTimelineProps) {
	const [commits, setCommits] = useState<CommitData[]>([]);
	const [currentTime, setCurrentTime] = useState<number>(0); // Timestamp in ms
	const [timeRange, setTimeRange] = useState<{ start: number; end: number }>({
		start: 0,
		end: Date.now(),
	});
	const [_totalPRs, setTotalPRs] = useState<number>(0);
	const [loading, setLoading] = useState(TEST_MODE ? false : true);
	const [backgroundLoading, setBackgroundLoading] = useState(false);
	const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
	const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(60);
	const [playbackDirection, setPlaybackDirection] =
		useState<PlaybackDirection>("forward");
	const [fromCache, setFromCache] = useState(false);
	const [rateLimitedCache, setRateLimitedCache] = useState(false);
	const playbackTimerRef = useRef<number | null>(null);
	const gitServiceRef = useRef<GitService | null>(null);

	// Find current commit index based on current time
	const getCurrentIndex = (time: number): number => {
		if (commits.length === 0) return 0;
		// Find the latest commit that is <= current time
		for (let i = commits.length - 1; i >= 0; i--) {
			if (commits[i].date.getTime() <= time) {
				return i;
			}
		}
		return 0;
	};

	const currentIndex = getCurrentIndex(currentTime);

	// Load metadata first to get time range
	useEffect(() => {
		const loadMetadata = async () => {
			try {
				const gitService = new GitService(repoPath, undefined, WORKER_URL);
				const metadata = await gitService.getMetadata();

				setTotalPRs(metadata.prs.length);
				setTimeRange(metadata.timeRange);
				setCurrentTime(metadata.timeRange.start);

				console.log(
					`Loaded metadata: ${metadata.prs.length} PRs, time range: ${new Date(metadata.timeRange.start).toLocaleDateString()} - ${new Date(metadata.timeRange.end).toLocaleDateString()}`,
				);
			} catch (err) {
				console.error("Error loading metadata:", err);
				// Don't block - continue to load commits
			}
		};

		loadMetadata();
	}, [repoPath]);

	const loadCommits = useCallback(
		async (forceRefresh = false) => {
			const gitService = new GitService(
				repoPath,
				undefined, // No token needed - using worker
				WORKER_URL,
			);
			gitServiceRef.current = gitService;

			// Check if data was from cache
			const cacheInfo = gitService.getCacheInfo();
			const hasCache = cacheInfo.exists && !forceRefresh;

			if (hasCache) {
				// Load from cache immediately - no loading state
				setLoading(true);
				setLoadProgress(null);
				try {
					const commitsData = await gitService.getCommitHistory((progress) => {
						setLoadProgress(progress);
					}, forceRefresh);
					setCommits(commitsData);
					// currentTime is already set from metadata
					setFromCache(true);
					setRateLimitedCache(false); // Clear rate limit flag when loading normally
					setLoading(false);
					setError(null);
					setRateLimit(gitService.getRateLimitInfo());
				} catch (err) {
					console.error("Error loading commits:", err);
					setError(
						err instanceof Error ? err.message : "Failed to load repository",
					);
					setLoading(false);
					setRateLimitedCache(false);
					setRateLimit(gitService.getRateLimitInfo());
				}
			} else {
				// Incremental loading - show visualization as data arrives
				setLoading(false);
				setBackgroundLoading(true);
				setLoadProgress(null);
				setCommits([]);
				// currentTime is already set from metadata
				setFromCache(false);

				try {
					await gitService.getCommitHistory(
						(progress) => {
							setLoadProgress(progress);
						},
						forceRefresh,
						(commit) => {
							// Add commit incrementally
							setCommits((prev) => [...prev, commit]);
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
							setCommits(cachedCommits);
							setFromCache(true);
							setRateLimitedCache(true); // Mark that we're using stale cache due to rate limit
							setError(null); // Clear error since we have cached data
							// Show a warning instead of error
							console.warn(
								"Using cached data due to API error:",
								err instanceof Error ? err.message : "Unknown error",
							);
						} catch (_cacheErr) {
							// If cache also fails, show the original error
							setError(
								err instanceof Error
									? err.message
									: "Failed to load repository",
							);
							setRateLimitedCache(false);
						}
					} else {
						// No cache available, show error
						setError(
							err instanceof Error ? err.message : "Failed to load repository",
						);
						setRateLimitedCache(false);
					}
					setRateLimit(gitService.getRateLimitInfo());
				} finally {
					setBackgroundLoading(false);
					setLoadProgress(null);
				}
			}
		},
		[repoPath],
	);

	useEffect(() => {
		loadCommits();
	}, [loadCommits]);

	// Playback auto-advance effect
	useEffect(() => {
		if (isPlaying && commits.length > 0) {
			// Update every 100ms for smooth playback
			const updateInterval = 100;
			// Time increment per update (in ms of repo time)
			// At 1x: real time - 1 second of repo time per 1 second of real time
			// Update every 100ms means we advance 100ms of repo time at 1x
			// At higher speeds, multiply accordingly
			const timeIncrement = updateInterval * playbackSpeed;

			playbackTimerRef.current = setInterval(() => {
				setCurrentTime((prevTime) => {
					let nextTime: number;

					if (playbackDirection === "forward") {
						nextTime = prevTime + timeIncrement;
						if (nextTime >= timeRange.end) {
							// Stop at end
							setIsPlaying(false);
							return timeRange.end;
						}
					} else {
						nextTime = prevTime - timeIncrement;
						if (nextTime <= timeRange.start) {
							// Stop at beginning
							setIsPlaying(false);
							return timeRange.start;
						}
					}

					return nextTime;
				});
			}, updateInterval);

			return () => {
				if (playbackTimerRef.current) {
					clearInterval(playbackTimerRef.current);
				}
			};
		}
	}, [
		isPlaying,
		playbackSpeed,
		playbackDirection,
		commits.length,
		timeRange.start,
		timeRange.end,
	]);

	const handlePlayPause = () => {
		setIsPlaying(!isPlaying);
	};

	const handleNodeClick = (node: FileNode) => {
		setSelectedNode(node);
		console.log("Selected node:", node);
	};

	if (loading) {
		return (
			<div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
				<div className="text-center max-w-md">
					<div className="text-xl mb-4">Loading repository...</div>
					{loadProgress ? (
						<>
							<div className="mb-2 text-gray-400">
								Loading commits: {loadProgress.loaded} / {loadProgress.total}
							</div>
							<div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
								<div
									className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
									style={{ width: `${loadProgress.percentage}%` }}
								/>
							</div>
							<div className="text-sm text-gray-500">
								{loadProgress.percentage}%
							</div>
						</>
					) : (
						<div className="text-gray-400">
							{fromCache ? "Loading from cache..." : "Analyzing commit history"}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Show error state
	if (error) {
		const isRateLimitError = error.includes("rate limit");
		return (
			<div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
				<div className="text-center max-w-2xl px-8">
					<div className="text-xl mb-4 text-red-400">
						{isRateLimitError
							? "⚠️ GitHub API Rate Limit Exceeded"
							: "Error Loading Repository"}
					</div>
					<div className="text-gray-300 mb-4">{error}</div>
					<div className="text-sm text-gray-500 mb-6">
						Repository: {repoPath}
					</div>

					{rateLimit && (
						<div className="mb-6 text-sm text-gray-400">
							<RateLimitDisplay
								remaining={rateLimit.remaining}
								limit={rateLimit.limit}
								resetTime={rateLimit.resetTime}
							/>
						</div>
					)}

					<div className="flex gap-3 justify-center">
						{onBack && (
							<button
								onClick={onBack}
								className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
							>
								Back
							</button>
						)}
						<button
							onClick={() => loadCommits(true)}
							className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
						>
							Retry
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Show initial loading only if we have no data yet and no error
	if (commits.length === 0 && !backgroundLoading && !error) {
		return (
			<div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
				<div className="text-center">
					<div className="text-xl mb-2">No commits found</div>
					<div className="text-gray-400">
						Unable to load repository data for: {repoPath}
					</div>
				</div>
			</div>
		);
	}

	// TEST DATA: Hardcoded test data to debug edge rendering
	const testNodes: FileNode[] = [
		{ id: "src", path: "src", name: "src", size: 0, type: "directory", x: 0, y: 0, z: 0 },
		{ id: "src/main.ts", path: "src/main.ts", name: "main.ts", size: 1000, type: "file", x: 30, y: 0, z: 0 },
		{ id: "src/utils", path: "src/utils", name: "utils", size: 0, type: "directory", x: 0, y: 30, z: 0 },
		{ id: "src/utils/helper.ts", path: "src/utils/helper.ts", name: "helper.ts", size: 500, type: "file", x: 30, y: 30, z: 0 },
	];

	const testEdges: FileEdge[] = [
		{ source: "src", target: "src/main.ts", type: "parent" },
		{ source: "src", target: "src/utils", type: "parent" },
		{ source: "src/utils", target: "src/utils/helper.ts", type: "parent" },
	];

	// Show empty state while waiting for first commit
	const currentCommit =
		commits.length > 0
			? commits[currentIndex]
			: {
					hash: "",
					message: "Loading...",
					author: "",
					date: new Date(),
					files: [],
					edges: [],
				};

	const displayNodes = TEST_MODE ? testNodes : currentCommit.files;
	const displayEdges = TEST_MODE ? testEdges : currentCommit.edges;

	return (
		<div className="w-full h-full relative">
			{/* 3D Visualization */}
			<div className="w-full h-full">
				<RepoGraph3D
					nodes={displayNodes}
					edges={displayEdges}
					onNodeClick={handleNodeClick}
				/>
			</div>

			{/* Timeline Controls */}
			<TimelineScrubber
				commits={commits}
				currentTime={currentTime}
				onTimeChange={setCurrentTime}
				timeRange={timeRange}
				isPlaying={isPlaying}
				onPlayPause={handlePlayPause}
				playbackSpeed={playbackSpeed}
				onSpeedChange={setPlaybackSpeed}
				playbackDirection={playbackDirection}
				onDirectionChange={setPlaybackDirection}
			/>

			{/* Node Info Panel */}
			{selectedNode && (
				<div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 text-white p-4 rounded-lg border border-gray-700 max-w-sm">
					<div className="text-sm font-semibold mb-2">Selected File</div>
					<div className="space-y-1 text-sm">
						<div>
							<span className="text-gray-400">Path:</span> {selectedNode.path}
						</div>
						<div>
							<span className="text-gray-400">Type:</span> {selectedNode.type}
						</div>
						<div>
							<span className="text-gray-400">Size:</span> {selectedNode.size}{" "}
							bytes
						</div>
					</div>
					<button
						onClick={() => setSelectedNode(null)}
						className="mt-3 text-xs text-gray-400 hover:text-white"
					>
						Close
					</button>
				</div>
			)}

			{/* Header */}
			<div className="absolute top-4 left-4 bg-gray-900 bg-opacity-90 text-white p-4 rounded-lg border border-gray-700">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h1 className="text-xl font-bold mb-1">Repo Timeline Visualizer</h1>
						<div className="text-sm text-gray-400">{repoPath}</div>
						<div className="flex items-center gap-3 mt-2">
							{rateLimitedCache && (
								<div className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 px-2 py-1 rounded border border-yellow-600">
									⚠ Using cached data (API rate limited)
								</div>
							)}
							{fromCache && !backgroundLoading && !rateLimitedCache && (
								<div className="text-xs text-blue-400">
									📦 Loaded from cache
								</div>
							)}
							{backgroundLoading && loadProgress && (
								<div className="text-xs text-yellow-400 flex items-center gap-2">
									<Loader2 size={12} className="animate-spin" />
									{loadProgress.message || "Loading PRs..."} ({commits.length}{" "}
									loaded)
								</div>
							)}
							{rateLimit && (
								<RateLimitDisplay
									remaining={rateLimit.remaining}
									limit={rateLimit.limit}
									resetTime={rateLimit.resetTime}
								/>
							)}
						</div>
					</div>
					<div className="flex gap-2">
						{onBack && (
							<button
								onClick={onBack}
								className="p-2 hover:bg-gray-800 rounded transition-colors"
								title="Back to repo selection"
							>
								<ArrowLeft size={20} />
							</button>
						)}
						<button
							onClick={() => loadCommits(true)}
							className="p-2 hover:bg-gray-800 rounded transition-colors"
							title="Refresh data"
						>
							<RefreshCw size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
