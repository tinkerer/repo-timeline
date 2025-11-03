import { AlertCircle, CheckCircle } from "lucide-react";

interface RateLimitDisplayProps {
	remaining: number | null;
	limit: number | null;
	resetTime: Date | null;
}

export function RateLimitDisplay({
	remaining,
	limit,
	resetTime,
}: RateLimitDisplayProps) {
	if (remaining === null || limit === null) {
		return null;
	}

	const percentage = (remaining / limit) * 100;
	const isLow = percentage < 20;
	const isVeryLow = percentage < 5;

	return (
		<div className="flex items-center gap-2 text-xs">
			{isVeryLow ? (
				<AlertCircle size={14} className="text-red-400" />
			) : isLow ? (
				<AlertCircle size={14} className="text-yellow-400" />
			) : (
				<CheckCircle size={14} className="text-green-400" />
			)}
			<div
				className={
					isVeryLow
						? "text-red-400"
						: isLow
							? "text-yellow-400"
							: "text-gray-400"
				}
			>
				API: {remaining}/{limit}
				{resetTime && remaining < limit / 2 && (
					<span className="ml-1">
						(resets {resetTime.toLocaleTimeString()})
					</span>
				)}
			</div>
		</div>
	);
}
