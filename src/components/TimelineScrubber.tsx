import {
	FastForward,
	Pause,
	Play,
	Rewind,
	SkipBack,
	SkipForward,
} from "lucide-react";
import { CommitData } from "../types";

export type PlaybackSpeed = 1 | 2 | 10 | 100;
export type PlaybackDirection = "forward" | "reverse";

interface TimelineScrubberProps {
	commits: CommitData[];
	currentIndex: number;
	onIndexChange: (index: number) => void;
	isPlaying: boolean;
	onPlayPause: () => void;
	playbackSpeed: PlaybackSpeed;
	onSpeedChange: (speed: PlaybackSpeed) => void;
	playbackDirection: PlaybackDirection;
	onDirectionChange: (direction: PlaybackDirection) => void;
}

export function TimelineScrubber({
	commits,
	currentIndex,
	onIndexChange,
	isPlaying,
	onPlayPause,
	playbackSpeed,
	onSpeedChange,
	playbackDirection,
	onDirectionChange,
}: TimelineScrubberProps) {
	const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onIndexChange(parseInt(e.target.value));
	};

	const handlePrevious = () => {
		if (currentIndex > 0) {
			onIndexChange(currentIndex - 1);
		}
	};

	const handleNext = () => {
		if (currentIndex < commits.length - 1) {
			onIndexChange(currentIndex + 1);
		}
	};

	const handleSkipToStart = () => {
		onIndexChange(0);
	};

	const handleSkipToEnd = () => {
		onIndexChange(commits.length - 1);
	};

	const cycleSpeed = () => {
		const speeds: PlaybackSpeed[] = [1, 2, 10, 100];
		const currentSpeedIndex = speeds.indexOf(playbackSpeed);
		const nextSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
		onSpeedChange(speeds[nextSpeedIndex]);
	};

	const toggleDirection = () => {
		onDirectionChange(playbackDirection === "forward" ? "reverse" : "forward");
	};

	const currentCommit = commits[currentIndex];

	if (!currentCommit) return null;

	const speedButtonClass =
		"px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm font-mono";
	const iconButtonClass =
		"p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors";

	return (
		<div className="absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-95 text-white p-4 border-t border-gray-700 backdrop-blur-sm">
			<div className="max-w-7xl mx-auto">
				{/* Commit info */}
				<div className="mb-3">
					<div className="flex items-center justify-between mb-2">
						<div className="flex-1">
							<div className="font-semibold text-lg">
								{currentCommit.message}
							</div>
							<div className="text-sm text-gray-400">
								{currentCommit.author} •{" "}
								{currentCommit.date.toLocaleDateString()}
							</div>
						</div>
						<div className="flex flex-col items-end gap-1">
							{/* Date/Time Clock */}
							{isPlaying && (
								<div className="text-lg font-mono text-blue-400 tabular-nums">
									{currentCommit.date.toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
										year: "numeric",
									})}{" "}
									{currentCommit.date.toLocaleTimeString("en-US", {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
							)}
							<div className="text-sm text-gray-400">
								Commit {currentIndex + 1} of {commits.length}
							</div>
						</div>
					</div>
				</div>

				{/* Video-style controls */}
				<div className="flex items-center gap-3 mb-3">
					{/* Skip to start */}
					<button
						onClick={handleSkipToStart}
						disabled={currentIndex === 0}
						className={iconButtonClass}
						title="Skip to first commit"
					>
						<SkipBack size={18} />
					</button>

					{/* Previous */}
					<button
						onClick={handlePrevious}
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
						onClick={handleNext}
						disabled={currentIndex === commits.length - 1}
						className={iconButtonClass}
						title="Next commit"
					>
						<SkipForward size={18} />
					</button>

					{/* Skip to end */}
					<button
						onClick={handleSkipToEnd}
						disabled={currentIndex === commits.length - 1}
						className={iconButtonClass}
						title="Skip to last commit"
					>
						<SkipForward size={18} />
					</button>

					{/* Slider with PR markers */}
					<div className="flex-1 flex items-center gap-4 ml-4">
						<div className="flex-1 relative">
							{/* PR Markers */}
							<div className="absolute inset-0 pointer-events-none flex items-center">
								{commits.map((_, index) => {
									const position = (index / (commits.length - 1)) * 100;
									return (
										<div
											key={index}
											className="absolute w-0.5 h-4 bg-gray-500"
											style={{
												left: `${position}%`,
												transform: "translateX(-50%)",
											}}
										/>
									);
								})}
							</div>
							{/* Slider */}
							<input
								type="range"
								min={0}
								max={commits.length - 1}
								value={currentIndex}
								onChange={handleSliderChange}
								className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider relative z-10"
							/>
						</div>
					</div>
				</div>

				{/* File statistics */}
				<div className="flex gap-6 text-sm text-gray-300">
					<div>
						<span className="text-gray-400">Files:</span>{" "}
						{currentCommit.files.length}
					</div>
					<div>
						<span className="text-gray-400">Hash:</span>{" "}
						<span className="font-mono">
							{currentCommit.hash.substring(0, 7)}
						</span>
					</div>
					{isPlaying && (
						<div className="text-blue-400">
							▶ Playing {playbackDirection} at {playbackSpeed}x
						</div>
					)}
				</div>
			</div>

			<style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }
      `}</style>
		</div>
	);
}
