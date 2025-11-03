import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { usePlaybackTimer } from "../hooks/usePlaybackTimer";
import { useRepoData } from "../hooks/useRepoData";
import type { RepoTimelineProps } from "../lib/types";
import { FileNode } from "../types";
import { getCurrentIndex } from "../utils/timelineHelpers";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { RateLimitDisplay } from "./RateLimitDisplay";
import { RepoGraph3D } from "./RepoGraph3D";
import {
	PlaybackDirection,
	PlaybackSpeed,
	TimelineScrubber,
} from "./TimelineScrubber";

// TEST MODE: Set to true to bypass loading and show test scene
const TEST_MODE = false;

export function RepoTimeline({
	repoPath,
	workerUrl,
	onBack,
	showControls = true,
	autoPlay = false,
	playbackSpeed: initialPlaybackSpeed = 60,
	playbackDirection: initialPlaybackDirection = "forward",
	onError,
}: RepoTimelineProps) {
	// Data loading state managed by custom hook
	const {
		commits,
		currentTime,
		setCurrentTime,
		timeRange,
		loading,
		backgroundLoading,
		loadProgress,
		error,
		rateLimit,
		fromCache,
		rateLimitedCache,
		loadCommits,
	} = useRepoData({
		repoPath,
		workerUrl,
		testMode: TEST_MODE,
		onError,
	});

	// UI state
	const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
	const [isPlaying, setIsPlaying] = useState(autoPlay);
	const [playbackSpeed, setPlaybackSpeed] =
		useState<PlaybackSpeed>(initialPlaybackSpeed);
	const [playbackDirection, setPlaybackDirection] = useState<PlaybackDirection>(
		initialPlaybackDirection,
	);

	const currentIndex = getCurrentIndex(commits, currentTime);

	// Use playback timer hook for automatic time advancement
	usePlaybackTimer({
		isPlaying,
		playbackSpeed,
		playbackDirection,
		timeRange,
		hasCommits: commits.length > 0,
		onTimeChange: setCurrentTime,
		onPlayingChange: setIsPlaying,
	});

	const handlePlayPause = () => {
		setIsPlaying(!isPlaying);
	};

	const handleNodeClick = (node: FileNode) => {
		setSelectedNode(node);
		console.log("Selected node:", node);
	};

	if (loading) {
		return <LoadingState loadProgress={loadProgress} fromCache={fromCache} />;
	}

	// Show error state
	if (error) {
		return (
			<ErrorState
				error={error}
				repoPath={repoPath}
				rateLimit={rateLimit}
				onBack={onBack}
				onRetry={() => loadCommits(true)}
			/>
		);
	}

	// Show initial loading only if we have no data yet and no error
	if (commits.length === 0 && !backgroundLoading && !error) {
		return <EmptyState repoPath={repoPath} />;
	}

	// Get current commit or show loading state
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

	return (
		<div className="w-full h-full relative">
			{/* 3D Visualization */}
			<div className="w-full h-full">
				<RepoGraph3D
					nodes={currentCommit.files}
					edges={currentCommit.edges}
					onNodeClick={handleNodeClick}
				/>
			</div>

			{/* Timeline Controls */}
			{showControls && (
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
			)}

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
