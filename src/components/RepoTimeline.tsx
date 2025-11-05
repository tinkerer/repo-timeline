import {
	ArrowLeft,
	ChevronDown,
	ChevronUp,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEST_MODE } from "../config";
import { usePlaybackTimer } from "../hooks/usePlaybackTimer";
import { useRepoData } from "../hooks/useRepoData";
import type { RepoTimelineProps } from "../lib/types";
import { StorageService } from "../services/storageService";
import { FileNode } from "../types";
import { getCurrentIndex } from "../utils/timelineHelpers";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { RateLimitDisplay } from "./RateLimitDisplay";
import { RepoGraph3D, type RepoGraph3DHandle } from "./RepoGraph3D";
import { RepoStatusBanner } from "./RepoStatusBanner";
import {
	PlaybackDirection,
	PlaybackSpeed,
	TimelineScrubber,
} from "./TimelineScrubber";

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
		repoStatus,
		loadCommits,
		loadMore,
		hasMoreCommits,
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
	const [isBannerVisible, setIsBannerVisible] = useState(true);
	const graphRef = useRef<RepoGraph3DHandle>(null);

	const handleResetView = useCallback(() => {
		graphRef.current?.resetCamera();
	}, []);

	const handleNodeDoubleClick = useCallback((node: FileNode) => {
		graphRef.current?.focusOnNode(node);
	}, []);

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

	// Autoload more commits when approaching the end
	useEffect(() => {
		console.log("[AUTOLOAD] Check:", {
			hasMoreCommits,
			backgroundLoading,
			commitsCount: commits.length,
			currentTime,
			timeRange,
		});

		if (!hasMoreCommits || backgroundLoading || commits.length === 0) {
			console.log("[AUTOLOAD] Skip - conditions not met:", {
				hasMoreCommits,
				backgroundLoading,
				hasCommits: commits.length > 0,
			});
			return;
		}

		// Calculate progress through timeline (0 to 1)
		const totalTime = timeRange.end - timeRange.start;
		const elapsed = currentTime - timeRange.start;
		const progress = elapsed / totalTime;

		console.log("[AUTOLOAD] Progress:", {
			progress: `${Math.round(progress * 100)}%`,
			currentTime,
			timeRange,
			elapsed,
			totalTime,
		});

		// Trigger loading when we're at 80% through the loaded commits
		if (progress > 0.8) {
			console.log(
				"[AUTOLOAD] 🚀 Triggering loadMore() - at",
				`${Math.round(progress * 100)}%`,
			);
			loadMore();
		}
	}, [
		currentTime,
		timeRange,
		hasMoreCommits,
		backgroundLoading,
		commits.length,
		loadMore,
	]);

	const handlePlayPause = useCallback(() => {
		setIsPlaying(!isPlaying);
	}, [isPlaying]);

	const handleNodeClick = useCallback((node: FileNode) => {
		setSelectedNode(node);
		console.log("Selected node:", node);
	}, []);

	const handleClearCache = useCallback(() => {
		StorageService.clearCache(repoPath);
		loadCommits(true); // Force reload from API
	}, [repoPath, loadCommits]);

	const handleToggleBannerVisibility = useCallback(() => {
		setIsBannerVisible((prev) => !prev);
	}, []);

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

	// Show loading state when background loading with no commits yet
	if (commits.length === 0 && backgroundLoading) {
		return <LoadingState loadProgress={loadProgress} fromCache={false} />;
	}

	// Show empty state only if we have no data, no error, and not loading
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
		<div className="w-full h-full relative flex flex-col">
			{/* 3D Visualization - fills all available space */}
			<div className="flex-1 relative z-0">
				<RepoGraph3D
					ref={graphRef}
					nodes={currentCommit.files}
					edges={currentCommit.edges}
					onNodeClick={handleNodeClick}
					onNodeDoubleClick={handleNodeDoubleClick}
				/>
			</div>

			{/* Timeline Controls - sits at bottom with higher z-index */}
			{showControls && (
				<div className="relative flex flex-col">
					{/* Repository Status Banner - positioned just above scrubber, slides up/down */}
					{repoStatus && (
						<div className="absolute bottom-full left-0 right-0">
							<RepoStatusBanner
								github={repoStatus.github}
								cache={repoStatus.cache}
								recommendation={repoStatus.recommendation}
								backgroundLoading={backgroundLoading}
								loadProgress={loadProgress}
								onClearCache={handleClearCache}
								isVisible={isBannerVisible}
								onVisibilityChange={setIsBannerVisible}
								toggleButton={
									<button
										onClick={handleToggleBannerVisibility}
										className="absolute -top-7 left-2 p-1 bg-gray-900 bg-opacity-90 text-gray-400 hover:text-white rounded transition-colors"
										title={
											isBannerVisible
												? "Hide cache status"
												: "Show cache status"
										}
										style={{ transform: "translateY(-18px)" }}
									>
										{isBannerVisible ? (
											<ChevronDown size={16} />
										) : (
											<ChevronUp size={16} />
										)}
									</button>
								}
							/>
						</div>
					)}
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
						onResetView={handleResetView}
					/>
				</div>
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
						<h1 className="text-xl font-bold mb-1">{repoPath}</h1>
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
