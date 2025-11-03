# Testing, Quality & Performance Action Plan

This document outlines the prioritized plan for improving testing, code quality, and performance before the v1.0.0 release.

## Current State Summary

### Testing
- **Framework**: Vitest with happy-dom environment ✅
- **CI/CD**: Automated testing with Codecov integration ✅
- **Coverage**: ~3% (only 1 utility function tested) ⚠️
- **Total LOC**: ~3,700 lines
- **Test files**: 1 of ~30 source files

### Bundle Size
- **Library (ESM)**: 16.5 KB gzipped ✅
- **Library (UMD)**: 13.3 KB gzipped ✅
- **Demo**: 334 KB gzipped (expected for 3D app)
- **Assessment**: Excellent for a 3D visualization library

### Performance
- **Memoization**: Comprehensive React.memo() usage ✅
- **WebGL**: High-performance settings configured ✅
- **Force Simulation**: Optimized with tuned parameters ✅
- **Tree-shaking**: Working correctly for icons ✅

## Phase 1: Critical Testing (Week 1-2)

These are the highest-risk areas with no test coverage:

### Priority 1A: Core Data Processing
- [ ] **fileStateTracker.ts** (60 lines) - CRITICAL
  - Test file additions, deletions, modifications
  - Test rename/move detection
  - Test cumulative state across multiple PRs
  - Test edge cases (files added then deleted, multiple renames)
  - **Coverage target**: 100%
  - **Estimated effort**: 4 hours

- [ ] **fileTreeBuilder.ts** (110 lines) - CRITICAL
  - Test tree construction from flat file lists
  - Test directory node creation
  - Test parent-child relationships
  - Test root file handling
  - Test nested directories
  - Test edge cases (empty paths, dots in names)
  - **Coverage target**: 100%
  - **Estimated effort**: 4 hours

### Priority 1B: Data Persistence
- [ ] **storageService.ts** (204 lines) - HIGH
  - Test localStorage save/load operations
  - Test serialization/deserialization
  - Test cache expiry logic
  - Test quota exceeded handling
  - Test data migration/versioning
  - Mock localStorage for testing
  - **Coverage target**: 90%
  - **Estimated effort**: 3 hours

### Priority 1C: Core Business Logic
- [ ] **gitService.ts** (356 lines) - HIGH
  - Test PR data fetching with mocked API
  - Test incremental loading logic
  - Test caching behavior
  - Test file size change calculations
  - Test move/rename detection
  - Test error handling and retry logic
  - **Coverage target**: 80%
  - **Estimated effort**: 6 hours

- [ ] **githubApiService.ts** (470 lines) - HIGH
  - Mock GitHub API calls with MSW
  - Test pagination logic
  - Test rate limiting handling
  - Test worker integration fallback
  - Test error handling (network, 404, rate limits)
  - Test PR file data fetching
  - **Coverage target**: 80%
  - **Estimated effort**: 6 hours

**Phase 1 Total**: ~23 hours, ~50-60% overall coverage

## Phase 2: Supporting Logic (Week 3)

### Priority 2A: Utilities & Hooks
- [ ] **forceSimulation.ts** (200 lines)
  - Test force calculations (spring, repulsion, centering)
  - Test position initialization
  - Test simulation convergence
  - Test edge cases (single node, no edges)
  - **Coverage target**: 70%
  - **Estimated effort**: 4 hours

- [ ] **useRepoData.ts** (275 lines)
  - Test state transitions with reducer
  - Test async data loading flow
  - Test progress tracking
  - Test cache fallback logic
  - Test error states
  - Use @testing-library/react-hooks
  - **Coverage target**: 80%
  - **Estimated effort**: 5 hours

- [ ] **usePlaybackTimer.ts** (80 lines)
  - Test timer start/stop/pause
  - Test playback speed changes
  - Test direction (forward/reverse)
  - Test boundary conditions (start/end)
  - Test cleanup on unmount
  - **Coverage target**: 90%
  - **Estimated effort**: 2 hours

**Phase 2 Total**: ~11 hours, ~65-70% overall coverage

## Phase 3: Component Testing (Week 4)

### Priority 3A: Critical Components
- [ ] **RepoTimeline.tsx** - Main API entry point
  - Test prop handling
  - Test error callbacks
  - Test initial state rendering
  - Use React Testing Library
  - **Coverage target**: 60%
  - **Estimated effort**: 3 hours

- [ ] **TimelineScrubber.tsx** - User interaction
  - Test scrubber position updates
  - Test playback controls
  - Test speed changes
  - Test user interactions (click, drag)
  - **Coverage target**: 70%
  - **Estimated effort**: 3 hours

### Priority 3B: UI Components
- [ ] **PlaybackControls.tsx**
  - Test button clicks (play, pause, forward, reverse)
  - Test speed selector
  - Test disabled states
  - **Coverage target**: 80%
  - **Estimated effort**: 2 hours

- [ ] **CommitInfo.tsx**
  - Test commit data rendering
  - Test missing data handling
  - **Coverage target**: 80%
  - **Estimated effort**: 1 hour

- [ ] **RepoInput.tsx**
  - Test form submission
  - Test validation
  - Test loading states
  - **Coverage target**: 80%
  - **Estimated effort**: 2 hours

### Priority 3C: State Components
- [ ] **LoadingState.tsx**
- [ ] **ErrorState.tsx**
- [ ] **EmptyState.tsx**
  - Simple rendering tests
  - **Coverage target**: 90%
  - **Estimated effort**: 1 hour each (3 total)

**Phase 3 Total**: ~14 hours, ~75-80% overall coverage

## Phase 4: 3D Components (Week 5)

Testing Three.js/R3F components requires special setup:

### Setup
- [ ] Configure @testing-library/react for R3F
- [ ] Create test utilities for 3D scene testing
- [ ] Mock Three.js objects where needed

### Components
- [ ] **FileNode3D.tsx**
  - Test node color based on type
  - Test size scaling
  - Test transitions
  - **Coverage target**: 50%
  - **Estimated effort**: 3 hours

- [ ] **FileEdge3D.tsx**
  - Test edge position calculation
  - Test visibility
  - **Coverage target**: 50%
  - **Estimated effort**: 2 hours

- [ ] **RepoGraph3D.tsx**
  - Test camera setup
  - Test controls initialization
  - Test node/edge rendering
  - **Coverage target**: 40%
  - **Estimated effort**: 4 hours

**Phase 4 Total**: ~9 hours, ~80%+ overall coverage

## Phase 5: Quality Improvements (Week 6)

### Code Quality
- [ ] Add JSDoc comments to all public APIs
- [ ] Add JSDoc to complex internal functions
- [ ] Add input validation to all props
- [ ] Improve error messages with actionable info
- [ ] Add prop validation with custom warnings

### Test Infrastructure
- [ ] Create test fixtures for complex data types (CommitData, FileNode)
- [ ] Set up MSW (Mock Service Worker) for API mocking
- [ ] Create shared test utilities and helpers
- [ ] Add test data factories
- [ ] Configure coverage thresholds in vitest.config.ts:
  ```typescript
  coverage: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80
  }
  ```

### Documentation
- [ ] Document testing approach in CONTRIBUTING.md
- [ ] Add examples of how to run tests
- [ ] Document mocking strategies
- [ ] Create testing best practices guide

**Phase 5 Total**: ~8 hours

## Phase 6: Performance Optimizations (Week 7)

### Bundle Size
- [ ] Remove `simple-git` from dependencies (unused)
- [ ] Set up `size-limit` with GitHub Actions
- [ ] Add bundle size budgets:
  - ESM: 18 KB gzipped
  - UMD: 15 KB gzipped
- [ ] Add bundle size badge to README
- [ ] Analyze demo bundle with `rollup-plugin-visualizer`
- [ ] Consider code-splitting demo routes

### Performance Monitoring
- [ ] Add performance benchmarks for:
  - Force simulation convergence time
  - File tree building time
  - PR processing throughput
- [ ] Create performance regression tests
- [ ] Document performance characteristics in README

### Runtime Optimizations
- [ ] Profile component render times
- [ ] Audit `useMemo` and `useCallback` usage
- [ ] Check for unnecessary re-renders
- [ ] Optimize large PR dataset handling (>1000 PRs)
- [ ] Consider Web Worker for physics simulation (if needed)
- [ ] Add virtualization if needed for large datasets

**Phase 6 Total**: ~12 hours

## Phase 7: Integration & E2E Testing (Week 8)

### Setup Playwright
- [ ] Configure Playwright for E2E tests
- [ ] Set up test fixtures and helpers
- [ ] Create GitHub Actions workflow for E2E

### Test Scenarios
- [ ] Complete user flow: input repo → load data → scrub timeline
- [ ] Test with different repo sizes (small, medium, large)
- [ ] Test error scenarios (invalid repo, rate limits)
- [ ] Test browser compatibility (Chrome, Firefox, Safari)
- [ ] Test with worker URL and without
- [ ] Test localStorage caching behavior
- [ ] Visual regression tests for 3D rendering

**Phase 7 Total**: ~16 hours

## Success Metrics

### Coverage Targets
- **Overall**: 80%+ line coverage
- **Critical utilities**: 90%+ coverage
- **Services**: 80%+ coverage
- **Hooks**: 80%+ coverage
- **Components**: 60%+ coverage
- **3D Components**: 40%+ coverage (harder to test)

### Quality Gates
- [ ] All CI tests passing
- [ ] No console errors in production build
- [ ] Bundle size within limits
- [ ] No TypeScript errors or warnings
- [ ] No Biome linting errors
- [ ] Codecov trending upward

### Performance Targets
- [ ] Library bundle: <20 KB gzipped
- [ ] Demo initial load: <2s on fast 3G
- [ ] First meaningful paint: <1s
- [ ] Time to interactive: <3s
- [ ] Handles 1000+ PRs smoothly

## Timeline Summary

| Phase | Focus | Duration | Expected Coverage |
|-------|-------|----------|-------------------|
| 1 | Critical testing | 2 weeks | 50-60% |
| 2 | Supporting logic | 1 week | 65-70% |
| 3 | Component testing | 1 week | 75-80% |
| 4 | 3D components | 1 week | 80%+ |
| 5 | Quality improvements | 1 week | 80%+ |
| 6 | Performance | 1 week | 80%+ |
| 7 | E2E testing | 1 week | 80%+ |
| **Total** | | **8 weeks** | **80%+** |

## Quick Wins (Can start immediately)

1. **Remove simple-git** (5 min)
   ```bash
   pnpm remove simple-git
   ```

2. **Add bundle size monitoring** (30 min)
   ```bash
   pnpm add -D @size-limit/preset-small-lib
   ```

3. **Set coverage thresholds** (10 min)
   - Edit vitest.config.ts

4. **Test fileTreeBuilder** (4 hours)
   - Highest value, easiest to test

5. **Test storageService** (3 hours)
   - Critical for user experience

## Resources Needed

### Dependencies to Add
```bash
# Testing utilities
pnpm add -D @testing-library/react @testing-library/user-event
pnpm add -D @testing-library/react-hooks
pnpm add -D msw  # Mock Service Worker

# Bundle size monitoring
pnpm add -D @size-limit/preset-small-lib

# Performance benchmarking
pnpm add -D vitest-benchmark

# E2E testing (already has @playwright/test)
```

### Documentation
- Testing guide for contributors
- Performance benchmarking approach
- E2E test writing guide

## Next Steps

1. **Review this plan** with stakeholders
2. **Start with Phase 1** (critical testing)
3. **Set up test infrastructure** (MSW, fixtures)
4. **Execute quick wins** to build momentum
5. **Track progress** weekly against coverage metrics

---

**Last Updated**: 2025-11-03
**Status**: Ready for execution
