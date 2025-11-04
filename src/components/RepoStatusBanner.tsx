import { useEffect } from "react";
import type { LoadProgress } from "../types";

interface RepoStatusBannerProps {
	github: {
		estimatedTotalPRs: number;
		hasMoreThan100PRs: boolean;
		firstMergedPR: { number: number; merged_at: string } | null;
	};
	cache: {
		exists: boolean;
		cachedCommits: number;
		ageSeconds: number | null;
		lastCommitSha: string | null;
		defaultBranch: string | null;
		firstCommit: { sha: string; date: string } | null;
		lastCommit: { sha: string; date: string } | null;
	};
	recommendation: "ready" | "partial" | "fetching";
	backgroundLoading?: boolean;
	loadProgress?: LoadProgress | null;
	onClearCache?: () => void;
	isVisible: boolean;
	onVisibilityChange: (visible: boolean) => void;
	toggleButton?: React.ReactNode;
}

export function RepoStatusBanner({
	github,
	cache,
	recommendation,
	backgroundLoading = false,
	loadProgress = null,
	onClearCache,
	isVisible,
	onVisibilityChange,
	toggleButton,
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

	// Override recommendation if we're not actually loading in background
	const effectiveRecommendation =
		recommendation === "fetching" && !backgroundLoading
			? "ready"
			: recommendation;

	// Auto-hide banner when ready (after 3 seconds)
	useEffect(() => {
		if (
			effectiveRecommendation === "ready" &&
			!backgroundLoading &&
			isVisible
		) {
			// Wait 3 seconds, then hide
			const hideTimer = setTimeout(() => {
				onVisibilityChange(false);
			}, 3000);

			return () => clearTimeout(hideTimer);
		}
		// Show banner if status changes back to non-ready
		if (
			(effectiveRecommendation !== "ready" || backgroundLoading) &&
			!isVisible
		) {
			onVisibilityChange(true);
		}
	}, [
		effectiveRecommendation,
		backgroundLoading,
		isVisible,
		onVisibilityChange,
	]);

	return (
		<div
			className={`relative z-10 transition-transform duration-500 ease-in-out ${
				isVisible ? "translate-y-0" : "translate-y-full"
			}`}
			style={{ willChange: "transform" }}
		>
			{/* Toggle button - moves with banner */}
			{toggleButton}

			<div
				className={`py-2 px-4 border-b ${statusColors[effectiveRecommendation]}`}
			>
				<div className="flex items-center justify-between gap-4 text-sm">
					<div className="flex items-center gap-4 flex-wrap">
						<div className="flex items-center gap-2">
							<span className="text-lg">
								{statusIcons[effectiveRecommendation]}
							</span>
							<span className="font-semibold">
								{statusMessages[effectiveRecommendation]}
							</span>
							{backgroundLoading && loadProgress && (
								<span className="text-xs opacity-75">
									({loadProgress.loaded}/
									{loadProgress.total !== -1 ? loadProgress.total : "?"} PRs -{" "}
									{loadProgress.percentage}%)
								</span>
							)}
						</div>
						<div>
							<strong>GitHub:</strong> ~{github.estimatedTotalPRs} PRs
							{github.firstMergedPR && (
								<span className="ml-1 text-xs opacity-75">
									(from #{github.firstMergedPR.number})
								</span>
							)}
						</div>
						<div>
							<strong>Cached:</strong> {cache.cachedCommits} commits
							{cache.exists && github.estimatedTotalPRs > 0 && (
								<span className="ml-1 text-xs opacity-75">
									(
									{Math.round(
										(cache.cachedCommits / github.estimatedTotalPRs) * 100,
									)}
									%)
								</span>
							)}
							{cache.ageSeconds && (
								<span className="ml-1 text-xs opacity-75">
									• {Math.round(cache.ageSeconds / 60)}m ago
								</span>
							)}
						</div>
						{cache.firstCommit && cache.lastCommit && (
							<div className="text-xs opacity-75">
								{new Date(cache.firstCommit.date).toLocaleDateString()} -{" "}
								{new Date(cache.lastCommit.date).toLocaleDateString()}
							</div>
						)}
					</div>
					{onClearCache && cache.exists && (
						<button
							onClick={onClearCache}
							className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition-colors flex-shrink-0"
							title="Clear local cache and reload data"
						>
							Clear
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
