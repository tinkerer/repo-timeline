/**
 * Repo Timeline - 3D visualization of GitHub repository evolution
 *
 * @packageDocumentation
 */

// Export main component
export { RepoTimeline } from "../components/RepoTimeline";
// Re-export commonly needed types from internal modules
export type { CommitData, FileEdge, FileNode } from "../types";
// Export public types
export type {
	PlaybackDirection,
	PlaybackSpeed,
	RepoTimelineProps,
} from "./types";
