import { KeyRound, LogOut, Loader2 } from "lucide-react";
import { useState } from "react";
import { GitHubAuthService } from "../services/githubAuthService";

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
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [authStatus, setAuthStatus] = useState<string | null>(null);

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

	const handleOAuthLogin = async () => {
		setIsAuthenticating(true);
		setError(null);
		setAuthStatus("Starting authentication...");

		try {
			const token = await GitHubAuthService.authenticate((status) => {
				setAuthStatus(status);
			});

			// Save token and notify parent
			localStorage.setItem("github_token", token);
			onTokenChange(token);
			setAuthStatus(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Authentication failed");
			setAuthStatus(null);
		} finally {
			setIsAuthenticating(false);
		}
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
				<div className="text-xs text-gray-400">
					Enter your GitHub Personal Access Token
				</div>
				<input
					type="password"
					value={tokenInput}
					onChange={(e) => setTokenInput(e.target.value)}
					placeholder="ghp_..."
					className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
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
						Save
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
				<div className="text-xs text-gray-500 mt-1">
					<a
						href="https://github.com/settings/tokens/new?scopes=public_repo&description=Repo%20Timeline%20Visualizer"
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-400 hover:text-blue-300 underline"
					>
						Create a token
					</a>{" "}
					with 'public_repo' scope
				</div>
			</div>
		);
	}

	// Show authenticating state
	if (isAuthenticating) {
		return (
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2 text-sm text-blue-400">
					<Loader2 size={14} className="animate-spin" />
					<span>Authenticating...</span>
				</div>
				{authStatus && (
					<div className="text-xs text-gray-400">{authStatus}</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<button
				onClick={handleOAuthLogin}
				className="flex items-center gap-1 text-sm px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
				title="Login with GitHub for higher rate limits (5000/hour)"
			>
				<KeyRound size={14} />
				<span>Login with GitHub</span>
			</button>
			<button
				onClick={() => setShowTokenInput(true)}
				className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
			>
				Or enter token manually
			</button>
			{error && <div className="text-xs text-red-400">{error}</div>}
		</div>
	);
}
