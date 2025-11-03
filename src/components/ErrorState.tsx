import type { RateLimitInfo } from "../types";
import { RateLimitDisplay } from "./RateLimitDisplay";

interface ErrorStateProps {
	error: string;
	repoPath: string;
	rateLimit: RateLimitInfo | null;
	onBack?: () => void;
	onRetry: () => void;
}

export function ErrorState({
	error,
	repoPath,
	rateLimit,
	onBack,
	onRetry,
}: ErrorStateProps) {
	const isRateLimitError = error.includes("rate limit");

	return (
		<div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
			<div className="text-center max-w-2xl px-8">
				<div className="text-xl mb-4 text-red-400">
					{isRateLimitError
						? "⚠️ GitHub API Rate Limit Exceeded"
						: "Error Loading Repository"}
				</div>
				<div className="text-gray-300 mb-4">{error}</div>
				<div className="text-sm text-gray-500 mb-6">Repository: {repoPath}</div>

				{rateLimit && (
					<div className="mb-6 text-sm text-gray-400">
						<RateLimitDisplay
							remaining={rateLimit.remaining}
							limit={rateLimit.limit}
							resetTime={rateLimit.resetTime}
						/>
					</div>
				)}

				<div className="flex gap-3 justify-center">
					{onBack && (
						<button
							onClick={onBack}
							className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
						>
							Back
						</button>
					)}
					<button
						onClick={onRetry}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		</div>
	);
}
