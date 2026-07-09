# Releasing NextDJ

Use this checklist before cutting a public build.

## Current Release Policy

Early NextDJ binaries are published as unsigned pre-releases. Do not present
them as fully production-ready installers until signing and notarization are
configured.

Release notes for unsigned builds must say:

```text
These early builds are unsigned. macOS and Windows may show security warnings.
You can build from source if you prefer to inspect the app before running it.
```

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

GitHub Releases are built from version tags. For the first unsigned public
build, prefer an alpha tag:

```bash
git tag v0.1.0-alpha.1
git push origin v0.1.0-alpha.1
```

The release workflow builds macOS, Windows, and Linux artifacts on native GitHub runners and attaches them to the GitHub Release.

For local packaging:

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
npm run release:checksums
```

`npm run dist` builds the default macOS release. `npm run dist:all` asks Electron Builder to create macOS, Windows, and Linux artifacts in `release/`.

Expected release assets:

- macOS x64/arm64: `.dmg` and `.zip`
- Windows x64: NSIS installer and portable executable
- Linux x64: `.AppImage` and `.deb`
- `SHA256SUMS.txt`: checksums for downloadable artifacts

App icons are generated from `build/icon-source.png`:

```bash
npm run icons:generate
```

Do not remove `mac.identity: null` until Developer ID signing and notarization
are configured. Unsigned builds are acceptable for early pre-releases, but the
release must be marked as a pre-release and describe the expected operating
system warnings.

## Public Release Checklist

- Confirm `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `CHANGELOG.md` are present.
- Confirm the changelog entry matches the tag being released.
- Confirm `package.json` version and the Git tag are compatible, for example `0.1.0` and `v0.1.0-alpha.1`.
- Confirm release artifacts include app icons on macOS, Windows, and Linux.
- Confirm `SHA256SUMS.txt` is attached to the GitHub Release.
- Confirm the release is marked as a GitHub pre-release while binaries are unsigned.
- Confirm the release notes mention that binaries are unsigned and may trigger operating-system warnings.
- Confirm this repository contains no service-specific playlist import providers.
- Confirm any private plugin repositories are not referenced by public docs, tests, or release notes.
