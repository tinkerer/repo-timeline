import { useEffect, useState } from "react";
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
	const [isVisible, setIsVisible] = useState(true);
	const [isAnimatingOut, setIsAnimatingOut] = useState(false);
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
		if (effectiveRecommendation === "ready" && !backgroundLoading) {
			// Wait 3 seconds, then start slide-out animation
			const hideTimer = setTimeout(() => {
				setIsAnimatingOut(true);
				// After animation completes (500ms), hide completely
				setTimeout(() => {
					setIsVisible(false);
				}, 500);
			}, 3000);

			return () => clearTimeout(hideTimer);
		}
		// Reset visibility if status changes back to non-ready
		if (effectiveRecommendation !== "ready" || backgroundLoading) {
			setIsVisible(true);
			setIsAnimatingOut(false);
		}
	}, [effectiveRecommendation, backgroundLoading]);

	// Don't render if hidden
	if (!isVisible) {
		return null;
	}

	return (
		<div
			className={`overflow-hidden transition-all duration-500 ease-in-out ${
				isAnimatingOut ? "max-h-0 opacity-0" : "max-h-24 opacity-100"
			}`}
		>
			<div
				className={`py-2 px-4 border-b ${statusColors[effectiveRecommendation]}`}
			>
				<div className="flex items-center gap-4 text-sm">
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
									{Math.round(
										(cache.cachedPRs / github.estimatedTotalPRs) * 100,
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
						{cache.firstPR && cache.lastPR && (
							<div className="text-xs opacity-75">
								{new Date(cache.firstPR.merged_at).toLocaleDateString()} -{" "}
								{new Date(cache.lastPR.merged_at).toLocaleDateString()}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
