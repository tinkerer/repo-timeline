import { useEffect, useRef, useState } from "react";
import { GitService } from "../services/gitService";
import { CommitData, FileNode } from "../types";
import { RepoGraph3D } from "./RepoGraph3D";
import {
	PlaybackDirection,
	PlaybackSpeed,
	TimelineScrubber,
} from "./TimelineScrubber";

interface RepoTimelineProps {
	repoPath: string;
}

export function RepoTimeline({ repoPath }: RepoTimelineProps) {
	const [commits, setCommits] = useState<CommitData[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
	const [playbackDirection, setPlaybackDirection] =
		useState<PlaybackDirection>("forward");
	const playbackTimerRef = useRef<number | null>(null);

	useEffect(() => {
		const loadCommits = async () => {
			setLoading(true);
			try {
				const gitService = new GitService(repoPath);
				const commitsData = await gitService.getCommitHistory();
				setCommits(commitsData);
				setCurrentIndex(0); // Start at first commit
			} catch (error) {
				console.error("Error loading commits:", error);
			} finally {
				setLoading(false);
			}
		};

		loadCommits();
	}, [repoPath]);

	// Playback auto-advance effect
	useEffect(() => {
		if (isPlaying && commits.length > 0) {
			// Base interval is 1 second, adjusted by playback speed
			const interval = 1000 / playbackSpeed;

			playbackTimerRef.current = setInterval(() => {
				setCurrentIndex((prevIndex) => {
					let nextIndex: number;

					if (playbackDirection === "forward") {
						nextIndex = prevIndex + 1;
						if (nextIndex >= commits.length) {
							// Stop at end
							setIsPlaying(false);
							return commits.length - 1;
						}
					} else {
						nextIndex = prevIndex - 1;
						if (nextIndex < 0) {
							// Stop at beginning
							setIsPlaying(false);
							return 0;
						}
					}

					return nextIndex;
				});
			}, interval);

			return () => {
				if (playbackTimerRef.current) {
					clearInterval(playbackTimerRef.current);
				}
			};
		}
	}, [isPlaying, playbackSpeed, playbackDirection, commits.length]);

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
				<div className="text-center">
					<div className="text-xl mb-2">Loading repository...</div>
					<div className="text-gray-400">Analyzing commit history</div>
				</div>
			</div>
		);
	}

	if (commits.length === 0) {
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

	const currentCommit = commits[currentIndex];

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
			<TimelineScrubber
				commits={commits}
				currentIndex={currentIndex}
				onIndexChange={setCurrentIndex}
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
				<h1 className="text-xl font-bold mb-1">Repo Timeline Visualizer</h1>
				<div className="text-sm text-gray-400">{repoPath}</div>
			</div>
		</div>
	);
}
