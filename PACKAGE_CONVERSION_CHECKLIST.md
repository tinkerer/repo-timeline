# Package Conversion Checklist

Converting repo-timeline from standalone app to reusable npm package.

## Phase 1: Library Structure Setup ✅

- [x] Create `src/lib/` directory for library exports
- [x] Create `src/lib/index.ts` with main exports
- [x] Create `src/lib/types.ts` with public type definitions
- [x] Move demo-specific code to `src/demo/`
  - [x] Move `App.tsx` to `src/demo/App.tsx`
  - [x] Move `main.tsx` to `src/demo/main.tsx`
  - [x] Move `RepoInput.tsx` to `src/demo/RepoInput.tsx`
  - [x] Move `RepoWrapper.tsx` to `src/demo/RepoWrapper.tsx`

## Phase 2: Component API Cleanup ✅

- [x] Update `RepoTimeline` component to accept `workerUrl` prop
- [x] Remove `onBack` prop dependency (make optional)
- [x] Remove hardcoded `WORKER_URL` from component
- [x] Make component work without React Router
- [x] Add optional props: `onError`, `showControls`, `autoPlay`, `playbackSpeed`
- [x] Update `config.ts` to export defaults instead of constants

## Phase 3: Build Configuration ✅

- [x] Create `vite.config.ts` for library build
  - [x] Configure `build.lib` mode
  - [x] Set entry point to `src/lib/index.ts`
  - [x] Externalize React, React-DOM, Three.js
  - [x] Configure CSS extraction
  - [x] Generate TypeScript declarations
- [x] Create `vite.demo.config.ts` for demo app build
  - [x] Set entry point to `src/demo/main.tsx`
  - [x] Output to `demo-dist/`
  - [x] Keep current SPA configuration
- [x] Test library build: `pnpm build`
- [x] Test demo build: `pnpm build:demo`

## Phase 4: Package.json Updates ✅

- [x] Update `name` to `@rjwalters/repo-timeline` (or your preferred scope)
- [x] Set `private: false`
- [x] Set `version` to `1.0.0`
- [x] Add `description`
- [x] Add `keywords`
- [x] Add `repository` field
- [x] Add `main`, `module`, `types` fields
- [x] Add `exports` field for ESM/CJS
- [x] Add `files` field (include only `dist/`)
- [x] Move React/React-DOM/Three to `peerDependencies`
- [x] Add build scripts:
  - [x] `build` - library build
  - [x] `build:demo` - demo app build
  - [x] `prepublishOnly` - run build before publish

## Phase 5: Documentation ✅

- [x] Create `EMBEDDING.md` with usage instructions
  - [x] Installation section
  - [x] Basic usage example
  - [x] Props documentation
  - [x] TypeScript example
  - [x] Advanced examples (error handling, custom worker)
  - [x] Styling guide
- [x] Update `README.md` to mention npm package usage
- [x] Create `CHANGELOG.md`
- [x] Create `.npmignore` file

## Phase 6: GitHub Actions Update ✅

- [x] Update `.github/workflows/deploy.yml` to build demo app
- [x] Change build output directory to `demo-dist/`
- [x] Ensure demo still deploys to GitHub Pages

## Phase 7: Testing (In Progress)

- [x] Build library: `pnpm build`
- [x] Verify output in `dist/`:
  - [x] `index.js` (ESM)
  - [x] `index.umd.js` (UMD)
  - [x] `index.d.ts` (TypeScript types)
  - [ ] `style.css` (note: currently not extracted, may need CSS fix)
- [x] Test local packaging:
  - [x] Run `npm pack --dry-run`
- [ ] Test local installation:
  - [ ] Run `npm pack` to create tarball
  - [ ] Install in test project: `npm install ../repo-timeline-1.0.0.tgz`
  - [ ] Import and use component
  - [ ] Verify TypeScript types work
- [x] Build demo: `pnpm build:demo`
- [ ] Test demo locally: `pnpm preview`
- [ ] Verify demo works at `/repo-timeline/`

## Phase 8: Publishing (Not Started - Holding for Refinement)

- [ ] Review `package.json` one final time
- [ ] Ensure all files are committed
- [ ] Create CHANGELOG.md for v1.0.0
- [ ] Create git tag: `git tag v1.0.0`
- [ ] Test publish (dry run): `npm publish --dry-run`
- [ ] Publish to npm: `npm publish --access public`
- [ ] Verify package on npmjs.com
- [ ] Push tag to GitHub: `git push --tags`

## Phase 9: Post-Publishing (Not Started)

- [ ] Update README.md with npm badge
- [ ] Create GitHub release for v1.0.0
- [ ] Test installation from npm: `npm install @rjwalters/repo-timeline`
- [ ] Share announcement (optional)

## Rollback Plan (if needed)

If something goes wrong:
- [ ] Unpublish version (within 72 hours): `npm unpublish @rjwalters/repo-timeline@1.0.0`
- [ ] Or deprecate: `npm deprecate @rjwalters/repo-timeline@1.0.0 "Deprecated due to issue"`
- [ ] Fix issues
- [ ] Publish new patch version

## Notes

- The demo app remains fully functional at https://rjwalters.github.io/repo-timeline/
- Library users can embed the component in their own React apps
- Both builds share the same source code (components, services, utils)
- Worker deployment remains optional for both demo and library users
