import type { LoadProgress } from "../types";

interface RepoStatusBannerProps {
	github: {
		estimatedTotalPRs: number;
		hasMoreThan100PRs: boolean;
		firstMergedPR: { number: number; merged_at: string } | null;
	};
	cache: {
		exists: boolean;
		cachedPRs: number;
		ageSeconds: number | null;
		lastPRNumber: number | null;
		firstPR: { number: number; merged_at: string } | null;
		lastPR: { number: number; merged_at: string } | null;
	};
	recommendation: "ready" | "partial" | "fetching";
	backgroundLoading?: boolean;
	loadProgress?: LoadProgress | null;
}

export function RepoStatusBanner({
	github,
	cache,
	recommendation,
	backgroundLoading = false,
	loadProgress = null,
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
					{backgroundLoading && loadProgress && (
						<span className="text-xs opacity-75">
							({loadProgress.loaded}/
							{loadProgress.total !== -1 ? loadProgress.total : "?"} PRs -{" "}
							{loadProgress.percentage}%)
						</span>
					)}
				</div>
				<div className="flex items-center gap-4 flex-wrap">
					<div>
						<strong>GitHub:</strong> ~{github.estimatedTotalPRs} PRs
						{github.firstMergedPR && (
							<span className="ml-1 text-xs opacity-75">
								(from #{github.firstMergedPR.number})
							</span>
						)}
					</div>
					<div>
						<strong>Cached:</strong> {cache.cachedPRs} PRs
						{cache.exists && github.estimatedTotalPRs > 0 && (
							<span className="ml-1 text-xs opacity-75">
								(
								{Math.round((cache.cachedPRs / github.estimatedTotalPRs) * 100)}
								%)
							</span>
						)}
						{cache.ageSeconds && (
							<span className="ml-1 text-xs opacity-75">
								• {Math.round(cache.ageSeconds / 60)}m ago
							</span>
						)}
					</div>
					{cache.firstPR && cache.lastPR && (
						<div className="text-xs opacity-75">
							{new Date(cache.firstPR.merged_at).toLocaleDateString()} -{" "}
							{new Date(cache.lastPR.merged_at).toLocaleDateString()}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
