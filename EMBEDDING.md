# Embedding Repo Timeline

This guide shows how to use the `@rjwalters/repo-timeline` package in your React application.

## Installation

```bash
npm install @rjwalters/repo-timeline
# or
pnpm add @rjwalters/repo-timeline
# or
yarn add @rjwalters/repo-timeline
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install react@^18.0.0 react-dom@^18.0.0 three@^0.160.0 @react-three/fiber@^8.0.0 @react-three/drei@^9.0.0
```

## Basic Usage

```tsx
import { RepoTimeline } from '@rjwalters/repo-timeline';
import '@rjwalters/repo-timeline/dist/style.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RepoTimeline repoPath="facebook/react" />
    </div>
  );
}
```

**Important**: The component requires a container with defined dimensions (width and height). It will fill 100% of its container.

## Props API

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `repoPath` | `string` | GitHub repository path in "owner/repo" format |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `workerUrl` | `string` | `undefined` | Cloudflare Worker URL for cached data |
| `onError` | `(error: Error) => void` | `undefined` | Error callback handler |
| `showControls` | `boolean` | `true` | Show timeline playback controls |
| `autoPlay` | `boolean` | `false` | Start playing automatically |
| `playbackSpeed` | `PlaybackSpeed` | `60` | Initial playback speed (1, 60, 300, or 1800) |
| `playbackDirection` | `PlaybackDirection` | `"forward"` | Initial direction ("forward" or "reverse") |
| `onBack` | `() => void` | `undefined` | Callback when back button is clicked |

## TypeScript Support

The package includes full TypeScript definitions. Import types as needed:

```tsx
import {
  RepoTimeline,
  RepoTimelineProps,
  PlaybackSpeed,
  PlaybackDirection,
  CommitData,
  FileNode,
  FileEdge
} from '@rjwalters/repo-timeline';
import '@rjwalters/repo-timeline/dist/style.css';

const App: React.FC = () => {
  const handleError = (error: Error) => {
    console.error('Timeline error:', error);
  };

  const handleBack = () => {
    console.log('Back button clicked');
  };

  return (
    <RepoTimeline
      repoPath="facebook/react"
      onError={handleError}
      onBack={handleBack}
      showControls={true}
      autoPlay={false}
      playbackSpeed={60}
      playbackDirection="forward"
    />
  );
};
```

## Advanced Examples

### With Error Handling

```tsx
import { useState } from 'react';
import { RepoTimeline } from '@rjwalters/repo-timeline';
import '@rjwalters/repo-timeline/dist/style.css';

function App() {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div>
        <h1>Error loading timeline</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RepoTimeline
        repoPath="facebook/react"
        onError={setError}
      />
    </div>
  );
}
```

### With Custom Cloudflare Worker

```tsx
import { RepoTimeline } from '@rjwalters/repo-timeline';
import '@rjwalters/repo-timeline/dist/style.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RepoTimeline
        repoPath="facebook/react"
        workerUrl="https://your-worker.workers.dev"
      />
    </div>
  );
}
```

### Repository Selector

```tsx
import { useState } from 'react';
import { RepoTimeline } from '@rjwalters/repo-timeline';
import '@rjwalters/repo-timeline/dist/style.css';

function App() {
  const [repoPath, setRepoPath] = useState<string | null>(null);

  if (!repoPath) {
    return (
      <div>
        <h1>Select a Repository</h1>
        <button onClick={() => setRepoPath('facebook/react')}>
          View React
        </button>
        <button onClick={() => setRepoPath('microsoft/vscode')}>
          View VS Code
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RepoTimeline
        repoPath={repoPath}
        onBack={() => setRepoPath(null)}
        showControls={true}
      />
    </div>
  );
}
```

### Auto-playing Timeline

```tsx
import { RepoTimeline } from '@rjwalters/repo-timeline';
import '@rjwalters/repo-timeline/dist/style.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RepoTimeline
        repoPath="facebook/react"
        autoPlay={true}
        playbackSpeed={300}
        playbackDirection="forward"
      />
    </div>
  );
}
```

### Hidden Controls

```tsx
import { RepoTimeline } from '@rjwalters/repo-timeline';
import '@rjwalters/repo-timeline/dist/style.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <RepoTimeline
        repoPath="facebook/react"
        showControls={false}
      />
    </div>
  );
}
```

## Styling

The package includes default styles that must be imported:

```tsx
import '@rjwalters/repo-timeline/dist/style.css';
```

The component uses Tailwind CSS classes internally. If you want to customize the appearance:

1. **Override CSS variables** (recommended):
```css
:root {
  --timeline-bg: #1a1a1a;
  --timeline-text: #ffffff;
  --timeline-accent: #3b82f6;
}
```

2. **Override specific classes** with higher specificity:
```css
.timeline-controls {
  background: your-custom-background;
}
```

## Playback Speeds

The `playbackSpeed` prop accepts one of four values:

- `1` - Real-time (1 commit per second)
- `60` - 1 minute per second
- `300` - 5 minutes per second
- `1800` - 30 minutes per second

## Data Loading

The component loads data progressively:

1. **With Worker URL**: Fetches cached data from Cloudflare Worker
2. **Without Worker URL**: Uses GitHub API directly (rate limited)
3. **Local Cache**: Uses localStorage to cache fetched data

The component shows a loading indicator while fetching data.

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires WebGL support for 3D visualization.

## Performance Considerations

- Large repositories (1000+ PRs) may take time to load
- 3D visualization is GPU-intensive
- Consider using a Cloudflare Worker for better performance
- The component uses localStorage caching to improve load times

## Troubleshooting

### "Cannot read property 'aspect' of undefined"

Ensure the parent container has defined width and height:

```tsx
<div style={{ width: '100vw', height: '100vh' }}>
  <RepoTimeline repoPath="facebook/react" />
</div>
```

### GitHub API Rate Limiting

If you're hitting GitHub API rate limits, deploy a Cloudflare Worker:

1. See [WORKER_DEPLOYMENT.md](./WORKER_DEPLOYMENT.md) for setup instructions
2. Pass the Worker URL via the `workerUrl` prop

### No data showing

Check the browser console for errors. Common issues:
- Invalid repository path format (must be "owner/repo")
- Repository has no merged PRs
- Network errors (check CORS if using custom worker)

## License

MIT
