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
	console.log("RepoStatusBanner render:", {
		github,
		cache,
		recommendation,
	});

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
		<div className={`py-2 px-4 border-b ${statusColors[recommendation]}`}>
			<div className="flex items-center gap-4 text-sm">
				<div className="flex items-center gap-2">
					<span className="text-lg">{statusIcons[recommendation]}</span>
					<span className="font-semibold">
						{statusMessages[recommendation]}
					</span>
				</div>
				<div className="flex items-center gap-4 flex-wrap">
					<div>
						<strong>GitHub:</strong> {github.totalPRs} PRs
						{github.firstPR && github.lastPR && (
							<span className="ml-1 text-xs opacity-75">
								(#{github.firstPR} - #{github.lastPR})
							</span>
						)}
					</div>
					<div>
						<strong>Cached:</strong> {cache.cachedPRs} PRs (
						{cache.coveragePercent}%)
						{cache.ageSeconds && (
							<span className="ml-1 text-xs opacity-75">
								• {Math.round(cache.ageSeconds / 60)}m ago
							</span>
						)}
					</div>
					{github.oldestMerge && github.newestMerge && (
						<div className="text-xs opacity-75">
							{new Date(github.oldestMerge).toLocaleDateString()} -{" "}
							{new Date(github.newestMerge).toLocaleDateString()}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
