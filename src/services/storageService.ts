import { CommitData } from "../types";

interface CachedRepoData {
	repoKey: string;
	commits: CommitData[];
	lastUpdated: number;
	version: number; // For cache invalidation when data structure changes
}

const CACHE_VERSION = 1;
const CACHE_PREFIX = "repo-timeline:";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export class StorageService {
	private static getStorageKey(repoKey: string): string {
		return `${CACHE_PREFIX}${repoKey}`;
	}

	/**
	 * Save commit data to localStorage
	 */
	static saveCommits(repoKey: string, commits: CommitData[]): boolean {
		try {
			const data: CachedRepoData = {
				repoKey,
				commits,
				lastUpdated: Date.now(),
				version: CACHE_VERSION,
			};

			const serialized = JSON.stringify(data, (_key, value) => {
				// Convert Date objects to ISO strings for serialization
				if (value instanceof Date) {
					return value.toISOString();
				}
				return value;
			});

			localStorage.setItem(this.getStorageKey(repoKey), serialized);
			return true;
		} catch (error) {
			console.error("Failed to save to localStorage:", error);
			// Handle quota exceeded errors
			if (error instanceof Error && error.name === "QuotaExceededError") {
				this.clearOldestCache();
			}
			return false;
		}
	}

	/**
	 * Load commit data from localStorage
	 */
	static loadCommits(repoKey: string): CommitData[] | null {
		try {
			const stored = localStorage.getItem(this.getStorageKey(repoKey));
			if (!stored) {
				return null;
			}

			const data: CachedRepoData = JSON.parse(stored, (_key, value) => {
				// Convert ISO strings back to Date objects
				if (
					typeof value === "string" &&
					/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
				) {
					return new Date(value);
				}
				return value;
			});

			// Validate cache version
			if (data.version !== CACHE_VERSION) {
				this.clearCache(repoKey);
				return null;
			}

			// Check if cache is expired
			if (Date.now() - data.lastUpdated > CACHE_EXPIRY_MS) {
				this.clearCache(repoKey);
				return null;
			}

			return data.commits;
		} catch (error) {
			console.error("Failed to load from localStorage:", error);
			return null;
		}
	}

	/**
	 * Clear cache for a specific repo
	 */
	static clearCache(repoKey: string): void {
		try {
			localStorage.removeItem(this.getStorageKey(repoKey));
		} catch (error) {
			console.error("Failed to clear cache:", error);
		}
	}

	/**
	 * Clear all repo timeline caches
	 */
	static clearAllCaches(): void {
		try {
			const keys = Object.keys(localStorage);
			for (const key of keys) {
				if (key.startsWith(CACHE_PREFIX)) {
					localStorage.removeItem(key);
				}
			}
		} catch (error) {
			console.error("Failed to clear all caches:", error);
		}
	}

	/**
	 * Get cache metadata
	 */
	static getCacheInfo(repoKey: string): {
		exists: boolean;
		age?: number;
		commitCount?: number;
	} {
		try {
			const stored = localStorage.getItem(this.getStorageKey(repoKey));
			if (!stored) {
				return { exists: false };
			}

			const data: CachedRepoData = JSON.parse(stored);
			return {
				exists: true,
				age: Date.now() - data.lastUpdated,
				commitCount: data.commits.length,
			};
		} catch (_error) {
			return { exists: false };
		}
	}

	/**
	 * Clear oldest cache when quota is exceeded
	 */
	private static clearOldestCache(): void {
		try {
			const keys = Object.keys(localStorage);
			const repoCaches: Array<{ key: string; timestamp: number }> = [];

			for (const key of keys) {
				if (key.startsWith(CACHE_PREFIX)) {
					const data = JSON.parse(localStorage.getItem(key) || "{}");
					if (data.lastUpdated) {
						repoCaches.push({ key, timestamp: data.lastUpdated });
					}
				}
			}

			// Sort by timestamp and remove oldest
			repoCaches.sort((a, b) => a.timestamp - b.timestamp);
			if (repoCaches.length > 0) {
				localStorage.removeItem(repoCaches[0].key);
			}
		} catch (error) {
			console.error("Failed to clear oldest cache:", error);
		}
	}

	/**
	 * Get storage usage statistics
	 */
	static getStorageStats(): {
		totalCaches: number;
		estimatedSize: number;
	} {
		try {
			const keys = Object.keys(localStorage);
			let totalSize = 0;
			let totalCaches = 0;

			for (const key of keys) {
				if (key.startsWith(CACHE_PREFIX)) {
					totalCaches++;
					const value = localStorage.getItem(key);
					if (value) {
						totalSize += key.length + value.length;
					}
				}
			}

			return {
				totalCaches,
				estimatedSize: totalSize * 2, // Rough estimate in bytes (UTF-16)
			};
		} catch (_error) {
			return { totalCaches: 0, estimatedSize: 0 };
		}
	}
}
