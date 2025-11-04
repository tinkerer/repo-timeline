/**
 * Token rotation utility for managing multiple GitHub API tokens
 * Rotates through tokens in a round-robin fashion to distribute API rate limits
 */
export class TokenRotator {
	private tokens: string[];
	private currentIndex = 0;

	constructor(tokensString: string) {
		this.tokens = tokensString
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);
		if (this.tokens.length === 0) {
			throw new Error("No GitHub tokens configured");
		}
		console.log(`Initialized with ${this.tokens.length} GitHub token(s)`);
	}

	getNextToken(): string {
		const token = this.tokens[this.currentIndex];
		this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
		return token;
	}

	getTokenCount(): number {
		return this.tokens.length;
	}
}
