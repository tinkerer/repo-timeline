/**
 * GitHub OAuth Device Flow Service
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

// This is a public client ID for the repo-timeline app
// It's safe to include in client-side code as it requires user authorization
const CLIENT_ID = "Ov23liNYN6fntuzLyQbT";

export interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
}

export interface AccessTokenResponse {
	access_token: string;
	token_type: string;
	scope: string;
}

export class GitHubAuthService {
	private static readonly DEVICE_CODE_URL =
		"https://github.com/login/device/code";
	private static readonly TOKEN_URL =
		"https://github.com/login/oauth/access_token";

	/**
	 * Step 1: Request a device code from GitHub
	 */
	static async requestDeviceCode(): Promise<DeviceCodeResponse> {
		const response = await fetch(this.DEVICE_CODE_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				client_id: CLIENT_ID,
				scope: "public_repo", // Only need access to public repos
			}),
		});

		if (!response.ok) {
			throw new Error(`Failed to request device code: ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Step 2: Poll for the access token
	 */
	static async pollForToken(
		deviceCode: string,
		interval: number,
		onProgress?: (status: string) => void,
	): Promise<string> {
		const startTime = Date.now();
		const timeout = 15 * 60 * 1000; // 15 minutes

		while (Date.now() - startTime < timeout) {
			// Wait for the specified interval before polling
			await new Promise((resolve) => setTimeout(resolve, interval * 1000));

			try {
				const response = await fetch(this.TOKEN_URL, {
					method: "POST",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						client_id: CLIENT_ID,
						device_code: deviceCode,
						grant_type: "urn:ietf:params:oauth:grant-type:device_code",
					}),
				});

				const data = await response.json();

				// Check for errors
				if (data.error) {
					if (data.error === "authorization_pending") {
						// User hasn't authorized yet, continue polling
						onProgress?.("Waiting for authorization...");
						continue;
					}

					if (data.error === "slow_down") {
						// We're polling too fast, increase interval
						interval += 5;
						onProgress?.("Slowing down polling...");
						continue;
					}

					if (data.error === "expired_token") {
						throw new Error("Device code expired. Please try again.");
					}

					if (data.error === "access_denied") {
						throw new Error("Authorization was denied.");
					}

					throw new Error(`OAuth error: ${data.error_description || data.error}`);
				}

				// Success! We got the token
				if (data.access_token) {
					return data.access_token;
				}
			} catch (err) {
				if (err instanceof Error) {
					throw err;
				}
				throw new Error("Failed to poll for token");
			}
		}

		throw new Error("Authorization timeout. Please try again.");
	}

	/**
	 * Complete OAuth flow
	 */
	static async authenticate(
		onProgress?: (status: string) => void,
	): Promise<string> {
		// Step 1: Request device code
		onProgress?.("Requesting device code...");
		const deviceCodeData = await this.requestDeviceCode();

		// Step 2: Open verification URL in new tab
		onProgress?.("Opening GitHub authorization page...");
		window.open(deviceCodeData.verification_uri, "_blank");

		// Step 3: Poll for token
		onProgress?.(
			`Waiting for authorization... (Code: ${deviceCodeData.user_code})`,
		);
		const token = await this.pollForToken(
			deviceCodeData.device_code,
			deviceCodeData.interval,
			onProgress,
		);

		return token;
	}
}
