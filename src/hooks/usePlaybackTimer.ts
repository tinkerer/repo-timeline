import { useEffect, useRef } from "react";
import type { PlaybackDirection, PlaybackSpeed } from "../lib/types";

interface UsePlaybackTimerOptions {
	isPlaying: boolean;
	playbackSpeed: PlaybackSpeed;
	playbackDirection: PlaybackDirection;
	timeRange: { start: number; end: number };
	hasCommits: boolean;
	onTimeChange: (updater: (prevTime: number) => number) => void;
	onPlayingChange: (isPlaying: boolean) => void;
}

/**
 * Custom hook to manage playback timer for timeline scrubbing
 * Handles automatic time advancement based on playback speed and direction
 */
export function usePlaybackTimer({
	isPlaying,
	playbackSpeed,
	playbackDirection,
	timeRange,
	hasCommits,
	onTimeChange,
	onPlayingChange,
}: UsePlaybackTimerOptions) {
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (isPlaying && hasCommits) {
			// Update every 100ms for smooth playback
			const updateInterval = 100;
			// Time increment per update (in ms of repo time)
			// At 1x: real time - 1 second of repo time per 1 second of real time
			// Update every 100ms means we advance 100ms of repo time at 1x
			// At higher speeds, multiply accordingly
			const timeIncrement = updateInterval * playbackSpeed;

			timerRef.current = setInterval(() => {
				onTimeChange((prevTime) => {
					let nextTime: number;

					if (playbackDirection === "forward") {
						nextTime = prevTime + timeIncrement;
						if (nextTime >= timeRange.end) {
							// Stop at end
							onPlayingChange(false);
							return timeRange.end;
						}
					} else {
						nextTime = prevTime - timeIncrement;
						if (nextTime <= timeRange.start) {
							// Stop at beginning
							onPlayingChange(false);
							return timeRange.start;
						}
					}

					return nextTime;
				});
			}, updateInterval);

			return () => {
				if (timerRef.current) {
					clearInterval(timerRef.current);
				}
			};
		}
	}, [
		isPlaying,
		playbackSpeed,
		playbackDirection,
		hasCommits,
		timeRange.start,
		timeRange.end,
		onTimeChange,
		onPlayingChange,
	]);
}
