import {
	ChevronsLeft,
	ChevronsRight,
	FastForward,
	Pause,
	Play,
	Rewind,
	RotateCcw,
	SkipBack,
	SkipForward,
} from "lucide-react";
import { memo } from "react";
import type { PlaybackDirection, PlaybackSpeed } from "../../lib/types";

interface PlaybackControlsProps {
	isPlaying: boolean;
	onPlayPause: () => void;
	playbackSpeed: PlaybackSpeed;
	onSpeedChange: (speed: PlaybackSpeed) => void;
	playbackDirection: PlaybackDirection;
	onDirectionChange: (direction: PlaybackDirection) => void;
	currentIndex: number;
	totalCommits: number;
	onSkipToStart: () => void;
	onPrevious: () => void;
	onNext: () => void;
	onSkipToEnd: () => void;
	onResetView?: () => void;
}

export const PlaybackControls = memo(function PlaybackControls({
	isPlaying,
	onPlayPause,
	playbackSpeed,
	onSpeedChange,
	playbackDirection,
	onDirectionChange,
	currentIndex,
	totalCommits,
	onSkipToStart,
	onPrevious,
	onNext,
	onSkipToEnd,
	onResetView,
}: PlaybackControlsProps) {
	const cycleSpeed = () => {
		const speeds: PlaybackSpeed[] = [1, 60, 300, 1800];
		const currentSpeedIndex = speeds.indexOf(playbackSpeed);
		const nextSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
		onSpeedChange(speeds[nextSpeedIndex]);
	};

	const toggleDirection = () => {
		onDirectionChange(playbackDirection === "forward" ? "reverse" : "forward");
	};

	const speedButtonClass =
		"px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm font-mono";
	const iconButtonClass =
		"p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors";

	return (
		<div className="flex items-center gap-3 mb-3">
			{/* Skip to start */}
			<button
				onClick={onSkipToStart}
				disabled={currentIndex === 0}
				className={iconButtonClass}
				title="Skip to first commit"
			>
				<ChevronsLeft size={18} />
			</button>

			{/* Previous */}
			<button
				onClick={onPrevious}
				disabled={currentIndex === 0}
				className={iconButtonClass}
				title="Previous commit"
			>
				<SkipBack size={18} />
			</button>

			{/* Reverse */}
			<button
				onClick={toggleDirection}
				className={`${speedButtonClass} ${
					playbackDirection === "reverse" ? "bg-blue-600" : ""
				}`}
				title="Toggle reverse playback"
			>
				<Rewind size={18} className="inline" />
			</button>

			{/* Play/Pause */}
			<button
				onClick={onPlayPause}
				className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
				title={isPlaying ? "Pause" : "Play"}
			>
				{isPlaying ? <Pause size={24} /> : <Play size={24} />}
			</button>

			{/* Fast Forward */}
			<button
				onClick={cycleSpeed}
				className={speedButtonClass}
				title={`Playback speed: ${playbackSpeed}x`}
			>
				<FastForward size={18} className="inline mr-1" />
				{playbackSpeed}x
			</button>

			{/* Next */}
			<button
				onClick={onNext}
				disabled={currentIndex === totalCommits - 1}
				className={iconButtonClass}
				title="Next commit"
			>
				<SkipForward size={18} />
			</button>

			{/* Skip to end */}
			<button
				onClick={onSkipToEnd}
				disabled={currentIndex === totalCommits - 1}
				className={iconButtonClass}
				title="Skip to last commit"
			>
				<ChevronsRight size={18} />
			</button>

			{/* Reset view */}
			{onResetView && (
				<button
					onClick={onResetView}
					className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors ml-2"
					title="Reset camera view"
				>
					<RotateCcw size={18} />
				</button>
			)}
		</div>
	);
});
