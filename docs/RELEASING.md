# Releasing NextDJ

Use this checklist before cutting a production build.

## Local Gate

```bash
npm ci
npm run check
npm run test:coverage
npm run perf:snapshot -- --scenario deck-load --wait-ms 1000
```

For audio transport or recording changes, also run:

```bash
npm run perf:snapshot -- --scenario deck-play --wait-ms 3000
npm run perf:snapshot -- --scenario deck-record --wait-ms 1000
```

The performance snapshots should report empty `longTasks` and `slowFrames`.

## Desktop Contract

- Confirm `window.nextdj` still exposes:
  - `listPlaylistImportProviders`
  - `listPlaylistImportTracks`
  - `resolvePlaylistImportTrack`
  - `startRecording`
  - `appendRecordingChunk`
  - `stopRecording`
  - `cancelRecording`
  - `revealRecording`
  - `onRecordingWriteError`
- Confirm IPC validators reject malformed recording options, chunks, paths, and cancel flags.
- Confirm playlist import IPC rejects malformed inputs and unknown provider ids.
- Confirm `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Confirm runtime permissions are limited to media/display capture and audio device selection.

## Recording Smoke

- Start an audio-only recording.
- Stop it and verify the saved file is playable.
- Reveal the saved file from the UI.
- Confirm temporary recording files are written under the configured recordings temp directory.
- Simulate or inspect write-error handling before changing the write pipeline.

## Distribution

GitHub Releases are built from version tags:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow builds macOS, Windows, and Linux artifacts on native GitHub runners and attaches them to the GitHub Release.

For local packaging:

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

`npm run dist` builds the default macOS release. `npm run dist:all` asks Electron Builder to create macOS, Windows, and Linux artifacts in `release/`.

Expected release assets:

- macOS x64/arm64: `.dmg` and `.zip`
- Windows x64: NSIS installer and portable executable
- Linux x64: `.AppImage` and `.deb`

App icons are generated from `build/icon-source.png`:

```bash
npm run icons:generate
```

Before publishing, decide and document the signing/notarization path for the target platform. Do not treat an unsigned local `.app` as production-ready.
