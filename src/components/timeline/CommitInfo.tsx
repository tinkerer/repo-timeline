import { memo } from "react";
import type { CommitData } from "../../types";

interface CommitInfoProps {
	commit: CommitData;
	currentTime: number;
	isPlaying: boolean;
}

export const CommitInfo = memo(function CommitInfo({
	commit,
	currentTime,
	isPlaying,
}: CommitInfoProps) {
	return (
		<div className="mb-3">
			<div className="flex items-center justify-between mb-2">
				<div className="flex-1">
					<div className="font-semibold text-lg">{commit.message}</div>
					<div className="text-sm text-gray-400">
						{commit.author} • {commit.date.toLocaleDateString()}
					</div>
				</div>
				{/* Date/Time Clock - shows current time in timeline */}
				{isPlaying && (
					<div className="text-lg font-mono text-blue-400 tabular-nums">
						{new Date(currentTime).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
							year: "numeric",
						})}{" "}
						{new Date(currentTime).toLocaleTimeString("en-US", {
							hour: "2-digit",
							minute: "2-digit",
							second: "2-digit",
						})}
					</div>
				)}
			</div>
		</div>
	);
});
