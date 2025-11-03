# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- npm package support for embedding in React applications
- Comprehensive EMBEDDING.md documentation with usage examples
- Dual build system (library + demo app)
- Public API with RepoTimelineProps interface
- TypeScript declaration files for full type support
- ESM and UMD bundle formats
- Optional props: workerUrl, onError, showControls, autoPlay, playbackSpeed, playbackDirection

### Changed
- Reorganized project structure with src/lib/ and src/demo/ directories
- Updated RepoTimeline component to accept configuration via props
- Made controls toggleable via showControls prop
- Externalized React, React-DOM, and Three.js as peer dependencies

### Fixed
- PlaybackDirection type consistency across components

## [1.0.0] - TBD

Initial release (not yet published)

### Added
- 3D force-directed graph visualization of Git repositories
- GitHub API integration with PR history tracking
- Cloudflare Worker support for caching and performance
- Interactive timeline controls with playback speeds
- Real-time physics simulation
- File size visualization with logarithmic scaling
- Smart localStorage caching
- Incremental data loading
- Forward and reverse playback
- Smooth transitions for file changes
- Demo application with repository input
