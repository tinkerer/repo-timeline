import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function RepoInput() {
	const navigate = useNavigate();
	const [input, setInput] = useState("rjwalters/repo-timeline");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Parse the input - accept formats like:
		// - "owner/repo"
		// - "https://github.com/owner/repo"
		// - "https://github.com/owner/repo/pull/123" (extract owner/repo)
		let repoPath = input.trim();

		// Extract from GitHub URL
		const githubUrlMatch = repoPath.match(/github\.com\/([^/]+\/[^/]+)/i);
		if (githubUrlMatch) {
			repoPath = githubUrlMatch[1];
		}

		// Remove trailing slashes and .git
		repoPath = repoPath.replace(/\.git$/, "").replace(/\/$/, "");

		// Validate format: should be "owner/repo"
		if (!/^[^/]+\/[^/]+$/.test(repoPath)) {
			setError('Invalid format. Please enter "owner/repo" or a GitHub URL.');
			return;
		}

		// Navigate to the repo route
		navigate(`/${repoPath}`);
	};

	return (
		<div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
			<div className="max-w-2xl w-full px-8">
				<div className="text-center mb-8">
					<div className="flex items-center justify-center gap-3 mb-4">
						<h1 className="text-4xl font-bold">Repo Timeline Visualizer</h1>
						<a
							href="https://github.com/rjwalters/repo-timeline"
							target="_blank"
							rel="noopener noreferrer"
							className="text-gray-400 hover:text-white transition-colors"
							aria-label="View source on GitHub"
						>
							<svg
								className="w-8 h-8"
								fill="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
						</a>
					</div>
					<p className="text-gray-400 text-lg">
						Visualize how a GitHub repository evolved through pull requests
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="repo-input"
							className="block text-sm font-medium mb-2"
						>
							GitHub Repository
						</label>
						<input
							id="repo-input"
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="owner/repo (e.g., facebook/react)"
							className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500"
						/>
						{error && <p className="mt-2 text-sm text-red-400">{error}</p>}
					</div>

					<button
						type="submit"
						className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
						disabled={!input.trim()}
					>
						Visualize Repository
					</button>
				</form>

				<div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
					<h3 className="text-sm font-semibold mb-2">Examples:</h3>
					<ul className="text-sm text-gray-400 space-y-1">
						<li>• rjwalters/bucket-brigade</li>
						<li>• facebook/react</li>
						<li>• microsoft/vscode</li>
					</ul>
				</div>

				<div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
					<div className="text-sm">
						<h3 className="font-semibold mb-2">
							Powered by Cloudflare Workers
						</h3>
						<p className="text-gray-400 text-xs">
							Data is cached globally for fast loading. No GitHub token
							required!
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
