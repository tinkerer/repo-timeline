interface RepoStatusBannerProps {
	github: {
		totalPRs: number;
		firstPR: number | null;
		lastPR: number | null;
		oldestMerge: string | null;
		newestMerge: string | null;
	};
	cache: {
		cachedPRs: number;
		coveragePercent: number;
		ageSeconds: number | null;
		lastPRNumber: number | null;
	};
	recommendation: "ready" | "partial" | "fetching";
}

export function RepoStatusBanner({
	github,
	cache,
	recommendation,
}: RepoStatusBannerProps) {
	const statusColors = {
		ready: "bg-green-900 border-green-600 text-green-200",
		partial: "bg-yellow-900 border-yellow-600 text-yellow-200",
		fetching: "bg-blue-900 border-blue-600 text-blue-200",
	};

	const statusMessages = {
		ready: "Ready to visualize",
		partial: "Partially cached - visualizing available data",
		fetching: "Collecting data in background...",
	};

	const statusIcons = {
		ready: "✓",
		partial: "⚡",
		fetching: "⏳",
	};

	return (
		<div
			className={`mb-4 p-4 rounded-lg border ${statusColors[recommendation]}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<span className="text-2xl">{statusIcons[recommendation]}</span>
						<span className="font-semibold">
							{statusMessages[recommendation]}
						</span>
					</div>
					<div className="text-sm space-y-1">
						<div>
							<strong>GitHub:</strong> {github.totalPRs} total merged PRs
							{github.firstPR && github.lastPR && (
								<span className="ml-2 text-xs opacity-75">
									(#{github.firstPR} - #{github.lastPR})
								</span>
							)}
						</div>
						<div>
							<strong>Cached:</strong> {cache.cachedPRs} PRs (
							{cache.coveragePercent}%)
							{cache.ageSeconds && (
								<span className="ml-2 text-xs opacity-75">
									• Updated {Math.round(cache.ageSeconds / 60)} min ago
								</span>
							)}
						</div>
						{github.oldestMerge && github.newestMerge && (
							<div className="text-xs opacity-75">
								Timeline: {new Date(github.oldestMerge).toLocaleDateString()} -{" "}
								{new Date(github.newestMerge).toLocaleDateString()}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
