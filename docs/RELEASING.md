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
  - `downloadYouTubeAudio`
  - `listYouTubeTracks`
  - `startRecording`
  - `appendRecordingChunk`
  - `stopRecording`
  - `cancelRecording`
  - `revealRecording`
  - `onRecordingWriteError`
- Confirm IPC validators reject malformed recording options, chunks, paths, and cancel flags.
- Confirm `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Confirm runtime permissions are limited to media/display capture and audio device selection.

## Recording Smoke

- Start an audio-only recording.
- Stop it and verify the saved file is playable.
- Reveal the saved file from the UI.
- Confirm temporary recording files are written under the configured recordings temp directory.
- Simulate or inspect write-error handling before changing the write pipeline.

## Distribution

```bash
npm run dist
```

Before publishing, decide and document the signing/notarization path for the target platform. Do not treat an unsigned local `.app` as production-ready.
