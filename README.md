# Repo Timeline Visualizer

[![Test & Coverage](https://github.com/tinkerer/repo-timeline/actions/workflows/test.yml/badge.svg)](https://github.com/tinkerer/repo-timeline/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/tinkerer/repo-timeline/branch/main/graph/badge.svg)](https://codecov.io/gh/tinkerer/repo-timeline)

A 3D visualization tool for exploring Git repository evolution over time. Watch your codebase grow, change, and evolve with an interactive force-directed graph showing files and directories as connected nodes in 3D space.

🌐 **[Live Demo](https://tinkerer.github.io/repo-timeline/)**

## Quick Start

### Using as an npm Package

Install the package in your React application:

```bash
npm install @tinkerer/repo-timeline
# or
pnpm add @tinkerer/repo-timeline
```

Then import and use the component:

```tsx
import { RepoTimeline } from '@tinkerer/repo-timeline';
import '@tinkerer/repo-timeline/dist/style.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RepoTimeline repoPath="facebook/react" />
    </div>
  );
}
```

📖 **[Full embedding guide](EMBEDDING.md)** - Installation, props, TypeScript, and advanced usage

### Development Setup

For local development or to contribute to this project:

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Start dev server: `pnpm dev`
4. Open browser to `http://localhost:5173`

See the **[Contributing](#contributing)** section below for more details.

## Deployment

This project automatically deploys to GitHub Pages via GitHub Actions. To enable:

1. Go to repository **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to main branch to trigger deployment

The site will be available at `https://[username].github.io/repo-timeline/`

## Features

- **3D Force-Directed Graph**: Files and directories are visualized as nodes connected by springs, creating an organic, physics-based layout
- **Time Travel**: Scrub through your repository's commit history to see how the structure evolved
- **Real GitHub Integration**: Analyze any public GitHub repository by entering `owner/repo`
- **Cloudflare Worker Caching**: Fast loading with globally cached PR data, avoiding GitHub rate limits
- **Interactive Playback**: Multiple speeds (1x to 1800x), forward/backward playback, and smooth transitions
- **Incremental Loading**: Watch the visualization build progressively as data loads
- **Interactive Controls**: Pan, zoom, and rotate the 3D view with your mouse
- **File Size Visualization**: Node sizes reflect file sizes (logarithmic scale)
- **Real-time Physics**: Watch the graph settle into its natural layout with spring physics
- **Smart Caching**: localStorage caching for instant subsequent loads

## Technology Stack

### Frontend
- **Vite**: Fast build tool and dev server
- **React**: UI framework
- **TypeScript**: Type-safe development
- **Three.js**: 3D rendering engine
- **React Three Fiber**: React renderer for Three.js
- **React Three Drei**: Useful helpers for R3F
- **Tailwind CSS**: Utility-first styling
- **Vitest**: Fast unit testing with coverage
- **Biome**: Fast linter and formatter
- **pnpm**: Efficient package manager

### Backend (Optional)
- **Cloudflare Workers**: Edge computing for API caching
- **Cloudflare D1**: SQLite database for PR data storage
- **GitHub API**: Source of repository data

## Development Commands

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev          # Start demo app dev server
```

Open your browser to `http://localhost:5173`

### Build

```bash
pnpm build        # Build library for npm
pnpm build:demo   # Build demo app for GitHub Pages
```

### Test

```bash
pnpm test              # Run tests in watch mode
pnpm test:coverage     # Run tests with coverage report
pnpm test:ui           # Run tests with interactive UI
```

Coverage thresholds are set at 50% for statements, branches, functions, and lines.

### Lint

```bash
pnpm lint         # Check code quality
pnpm lint:fix     # Auto-fix issues
pnpm format       # Format code with Biome
```

### Bundle Size

```bash
pnpm size         # Check bundle sizes against limits
pnpm size:why     # Analyze what's included in bundles
```

Current bundle sizes:
- ESM: ~14 KB gzipped (limit: 18 KB)
- UMD: ~14 KB gzipped (limit: 15 KB)

### Preview

```bash
pnpm preview      # Preview demo build
```

## Project Structure

```
repo-timeline/
├── src/
│   ├── lib/                      # NPM package exports
│   │   ├── index.ts              # Main library entry point
│   │   └── types.ts              # Public API types
│   ├── demo/                     # Demo app (GitHub Pages)
│   │   ├── App.tsx               # Demo app root
│   │   ├── main.tsx              # Demo app entry point
│   │   ├── RepoInput.tsx         # Repository input form
│   │   └── RepoWrapper.tsx       # Demo app wrapper
│   ├── components/
│   │   ├── FileNode3D.tsx        # Individual file/directory node
│   │   ├── FileEdge3D.tsx        # Connection between nodes
│   │   ├── RepoGraph3D.tsx       # Main 3D graph component
│   │   ├── TimelineScrubber.tsx  # Commit timeline controls
│   │   ├── RepoTimeline.tsx      # Main container component
│   │   ├── GitHubAuthButton.tsx  # GitHub authentication
│   │   ├── RateLimitDisplay.tsx  # Rate limit indicator
│   │   └── TestScene.tsx         # Test visualization scene
│   ├── services/
│   │   ├── gitService.ts         # Main Git service orchestration
│   │   ├── githubApiService.ts   # GitHub API integration
│   │   └── storageService.ts     # LocalStorage caching
│   ├── utils/
│   │   ├── forceSimulation.ts    # Physics simulation for graph layout
│   │   ├── fileTreeBuilder.ts    # Build file trees from PR data
│   │   └── fileStateTracker.ts   # Track file state across PRs
│   ├── data/
│   │   └── demoCommits.ts        # Demo data for fallback
│   ├── config.ts                 # Application configuration
│   ├── types.ts                  # TypeScript type definitions
│   └── index.css                 # Global styles
├── dist/                         # NPM package build output
│   ├── index.js                  # ESM bundle
│   ├── index.umd.js              # UMD bundle
│   ├── index.d.ts                # TypeScript declarations
│   └── style.css                 # Bundled styles
├── demo-dist/                    # Demo app build output (GitHub Pages)
├── worker/                       # Cloudflare Worker (optional)
│   ├── src/
│   │   └── index.ts              # Worker API endpoints
│   ├── migrations/               # D1 database migrations
│   ├── wrangler.toml             # Worker configuration
│   └── package.json
├── index.html
├── package.json
├── vite.config.ts                # Library build config
├── vite.demo.config.ts           # Demo build config
└── tailwind.config.js
```

## How It Works

### Force-Directed Graph Layout

The visualization uses a custom force-directed graph algorithm with three types of forces:

1. **Spring Forces**: Connected nodes (parent/child relationships) attract each other
2. **Repulsion Forces**: All nodes repel each other to prevent overlap
3. **Centering Force**: Gentle pull toward the origin to keep the graph centered

### Data Flow

1. **User enters repository** (`owner/repo`)
2. **Metadata fetch**: Quick metadata endpoint loads PR list and time range
3. **Data source selection**:
   - **Cloudflare Worker** (preferred): Fetches cached PR data from global D1 database
   - **localStorage cache**: Loads previously fetched data instantly
   - **GitHub API** (fallback): Direct API calls with rate limiting
4. **Incremental loading**: PRs processed one-by-one, visualization updates in real-time
5. **File state tracking**: Each PR's file changes are applied cumulatively
6. **Tree building**: File paths converted to hierarchical node/edge structure
7. **Force simulation**: Physics calculates optimal 3D positions for nodes
8. **Three.js rendering**: 3D scene rendered with React Three Fiber
9. **Time travel**: Scrubber controls let you navigate through commits

### Node Visualization

- **Blue octahedrons (diamonds)**: Directories (fixed size)
- **Green spheres**: Files (size scales logarithmically with file size)
- **White tubes**: Parent-child relationships in file tree
- **Virtual root**: "/" node connects all root-level files
- **Transitions**: Smooth animations show size changes, additions, deletions

## Customization

### Adjust Physics

Edit `src/utils/forceSimulation.ts`:

```typescript
new ForceSimulation(nodesCopy, edges, {
  strength: 0.05,    // Spring strength
  distance: 30,      // Target distance between connected nodes
  iterations: 300,   // Simulation steps
});
```

### Change Colors

Edit colors in `src/components/FileNode3D.tsx` and `src/components/FileEdge3D.tsx`

### Camera Settings

Edit initial camera position in `src/components/RepoGraph3D.tsx`:

```typescript
camera={{ position: [0, 0, 200], fov: 75 }}
```

## Optional: Cloudflare Worker Setup

For better performance and to avoid GitHub rate limits, you can deploy the included Cloudflare Worker:

1. See **[WORKER_DEPLOYMENT.md](WORKER_DEPLOYMENT.md)** for detailed setup instructions
2. Worker provides:
   - Global caching of PR data across all users
   - Background updates to keep cache fresh
   - 5,000+ requests/hour (vs 60 unauthenticated GitHub API)
   - <100ms response times for cached repos
   - Free tier covers most usage

**Quick Setup:**
```bash
cd worker
npm install
npx wrangler d1 create repo_timeline
npm run db:migrate
npx wrangler secret put GITHUB_TOKENS
npm run deploy
```

Update `src/config.ts` with your worker URL, and you're done!

## Future Enhancements

- ✅ ~~Real Git integration~~ (Completed - GitHub API + Worker)
- ✅ ~~Animation transitions between commits~~ (Completed)
- File content diffing
- Dependency graph visualization (import/export relationships)
- Author-based coloring
- Commit message search
- Export visualizations as video/GIF
- Multiple repository comparison
- Custom layout algorithms (hierarchical, circular, etc.)
- Performance optimizations for very large repos (>10k PRs)
- Branch visualization
- Interactive file diff viewer

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
