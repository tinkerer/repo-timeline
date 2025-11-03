import { ExternalLink, KeyRound, LogOut } from "lucide-react";
import { useState } from "react";

interface GitHubAuthButtonProps {
	onTokenChange: (token: string | null) => void;
	currentToken: string | null;
}

export function GitHubAuthButton({
	onTokenChange,
	currentToken,
}: GitHubAuthButtonProps) {
	const [showTokenInput, setShowTokenInput] = useState(false);
	const [tokenInput, setTokenInput] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSaveToken = () => {
		const token = tokenInput.trim();
		if (!token) {
			setError("Please enter a valid token");
			return;
		}

		// Save to localStorage and notify parent
		localStorage.setItem("github_token", token);
		onTokenChange(token);
		setShowTokenInput(false);
		setTokenInput("");
		setError(null);
	};

	const handleRemoveToken = () => {
		localStorage.removeItem("github_token");
		onTokenChange(null);
	};

	if (currentToken) {
		return (
			<div className="flex items-center gap-2 text-sm">
				<div className="flex items-center gap-1 text-green-400">
					<KeyRound size={14} />
					<span>Authenticated</span>
				</div>
				<button
					onClick={handleRemoveToken}
					className="text-gray-400 hover:text-white transition-colors"
					title="Remove token"
				>
					<LogOut size={14} />
				</button>
			</div>
		);
	}

	if (showTokenInput) {
		return (
			<div className="flex flex-col gap-2">
				<div className="text-xs text-gray-400 font-medium">
					GitHub Personal Access Token
				</div>
				<input
					type="password"
					value={tokenInput}
					onChange={(e) => setTokenInput(e.target.value)}
					placeholder="ghp_..."
					autoFocus
					className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm focus:border-blue-500 focus:outline-none"
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSaveToken();
						if (e.key === "Escape") {
							setShowTokenInput(false);
							setTokenInput("");
							setError(null);
						}
					}}
				/>
				{error && <div className="text-xs text-red-400">{error}</div>}
				<div className="flex gap-2">
					<button
						onClick={handleSaveToken}
						className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
					>
						Save Token
					</button>
					<button
						onClick={() => {
							setShowTokenInput(false);
							setTokenInput("");
							setError(null);
						}}
						className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
					>
						Cancel
					</button>
				</div>
				<div className="text-xs text-gray-400 bg-gray-800 bg-opacity-50 p-2 rounded border border-gray-700">
					<div className="font-medium mb-1">How to create a token:</div>
					<ol className="list-decimal list-inside space-y-1">
						<li>
							<a
								href="https://github.com/settings/tokens/new?scopes=public_repo&description=Repo%20Timeline%20Visualizer"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
							>
								Click here to create token
								<ExternalLink size={10} />
							</a>
						</li>
						<li>Select 'public_repo' scope</li>
						<li>Click "Generate token"</li>
						<li>Copy and paste it above</li>
					</ol>
				</div>
			</div>
		);
	}

	return (
		<button
			onClick={() => setShowTokenInput(true)}
			className="flex items-center gap-1 text-sm px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
			title="Add GitHub token for higher rate limits (5000/hour)"
		>
			<KeyRound size={14} />
			<span>Add GitHub Token</span>
		</button>
	);
}
