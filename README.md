# NextDJ

NextDJ is an open-source desktop DJ console built with Electron, Vite, React,
and WebAudio. It focuses on local-first mixing: load tracks, inspect waveforms,
control two decks, mix, route output devices, and record sessions from a desktop
app.

The public repository is service-neutral. Playlist import support is exposed
through a local provider plugin API, but NextDJ does not ship with integrations
for specific external services.

## Status

NextDJ is early software. The app is usable for development and testing, but
the first public binaries should be treated as pre-release builds until signing,
notarization, and broader device testing are complete.

## Features

- Two-deck local audio playback with pitch, cue, loop, hot-cue, sync, and jog controls.
- Overview and zoom waveforms generated in the renderer.
- Mixer controls with crossfader, channel gain, EQ, filters, and VU meters.
- Output device selection where supported by the platform.
- Session recording with Electron-side file writes.
- Optional playlist import providers loaded from local user configuration.
- Performance snapshot tooling for load, playback, and recording smoke checks.

## Downloads

GitHub Releases are configured to publish:

- macOS x64/arm64: `.dmg` and `.zip`
- Windows x64: installer and portable `.exe`
- Linux x64: `.AppImage` and `.deb`
- `SHA256SUMS.txt` for artifact verification

Until signing and notarization are configured, downloaded binaries may show
operating-system warnings. Build locally if you prefer to inspect the source
before running the app.

## Development

```bash
npm install
npm run dev
```

Use npm for this repository because `package-lock.json` is committed.

Useful gates:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run check
```

`npm run check` is the handoff gate and runs lint, typecheck, unit tests, and production build.

Coverage is intentionally modest while the codebase is being carved out of the prototype:

- Global floor: 40% statements, branches, functions, and lines.
- Raise the floor only after adding meaningful regression tests, not by excluding risky code.

## Packaging

Generate app icons from `build/icon-source.png`:

```bash
npm run icons:generate
```

Build local installers:

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
npm run release:checksums
```

See [docs/RELEASING.md](docs/RELEASING.md) before publishing a release.

## Playlist Import Plugins

NextDJ can load local playlist import providers from the Electron main process.
Providers are configured outside the repository in the app user data directory,
and the renderer only talks to the stable `window.nextdj` bridge.

See [docs/PLAYLIST_PLUGINS.md](docs/PLAYLIST_PLUGINS.md) for the neutral plugin
API. Providers are responsible for only importing content that the user has the
right to access, copy, and use.

## Architecture

- `src/main`: Electron lifecycle, desktop IPC, recording write paths, and playlist import plugin loading.
- `src/main/appSecurity.ts`: Electron session permission policy.
- `src/main/recordingValidation.ts`: IPC input validation for recording calls.
- `src/preload`: the stable `window.nextdj` bridge exposed to the renderer.
- `src/shared`: types shared by main, preload, and renderer without importing React or Electron UI code.
- `src/renderer/src/audio`: WebAudio engine, decks, source scheduling, mixer, output routing, BPM analysis, deck persistence, hot-cue state, and loop state.
- `src/renderer/src/hooks`: React orchestration around the audio engine, library, recording, shortcuts, output devices, deck actions, and mixer actions.
- `src/renderer/src/components`: presentation components for decks, mixer, library, settings, waveforms, and controls.
- `src/renderer/src/library`: local library persistence, file helpers, and audio metadata readers.
- `src/renderer/src/styles`: renderer CSS split by UI domain.

## Performance Profiling

Use real DJ workflows before optimizing. The highest-risk paths are track loading, waveform/BPM analysis, RAF-driven transport updates, VU meters, recording, and library rendering.

To profile track loading in DevTools, enable the opt-in renderer trace and then load or import a track:

```js
localStorage.setItem('nextdj.perf', '1')
```

Reload the app or open it with `?nextdjPerf=1`, record a Chrome Performance session, and inspect `nextdj.deck.loadFile.*` plus `library.audioMetadata.*` measures. The app currently records file reads, audio decode, waveform, duration, and BPM phases. The flag also logs those measures to the console with the `[nextdj:perf]` prefix.

With the same flag enabled, DevTools also exposes `window.__NEXTDJ_PERF__.snapshot()` and `window.__NEXTDJ_PERF__.reset()` for a compact in-session summary of measured phases, slow waveform frames, and renderer long tasks.

For a quick non-interactive renderer smoke snapshot, run:

```bash
npm run perf:snapshot -- --wait-ms 5000
```

That command starts the dev Electron app with `NEXTDJ_PERF=1`, opens a temporary remote debugging port, reads `window.__NEXTDJ_PERF__.snapshot()`, prints JSON, and shuts the app down. It proves the profiling path works, but it does not replace a real session with loaded tracks and recording.

To exercise the real deck file input with a generated WAV fixture and capture library + deck load phases:

```bash
npm run perf:snapshot -- --scenario deck-load --wait-ms 1000
```

To also start playback through the real transport control and observe playback-time slow frames:

```bash
npm run perf:snapshot -- --scenario deck-play --wait-ms 3000
```

To start playback, record an audio-only slice through the real REC controls, and write the file into a temporary directory:

```bash
npm run perf:snapshot -- --scenario deck-record --wait-ms 1000
```

During playback, the same flag reports slow waveform draw frames as `waveform.overview slow frame` and `waveform.zoom slow frame`, plus analyser-heavy meter frames as `vu.meter slow frame`. Treat repeated slow-frame logs as evidence before changing waveform fidelity, animation cadence, or meter behavior.

The flag also starts a renderer long-task observer when the runtime supports it. Repeated `renderer long task` logs indicate main-thread blocking that should be traced before changing UI behavior.

Recording paths emit `nextdj.recording.*` measures for session start, chunk conversion, chunk append, pending-write drain, and stop. The same trace also reports slow compositor frames as `recording.compositor slow frame`. Use those together with long-task logs when checking whether recording competes with live playback.

Performance changes should preserve the existing UI. Any optimization that visibly changes waveform fidelity, animation cadence, layout, or interaction timing needs visual validation before shipping.

## Production Checklist

- Run `npm run check` before handoff.
- Run `npm run test:coverage` and keep the global floor green.
- Run `npm run perf:snapshot -- --scenario deck-load --wait-ms 1000` for the default performance smoke.
- Keep `window.nextdj` backward compatible unless a migration is documented.
- Keep playlist import providers service-neutral in this repository.
- Keep existing `nextdj.*` storage keys stable unless a migration is added.
- Validate all IPC inputs in main before touching disk, shell, or external processes.
- Keep Electron permissions narrow; media and display capture are currently the only allowed runtime permissions.
- Keep `BrowserWindow` hardened with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Avoid large multi-purpose files. Split new behavior into testable modules before it grows past roughly 500 LOC.

## Next Refactor Targets

- Add smoke tests around `App` and high-value component flows with WebAudio and `window.nextdj` mocks.
- Continue carving `Deck` only when a new behavior needs it; source scheduling is already separated.
- Keep `LibraryPanel` and `MixerPanel` split by hooks/subcomponents when adding new UI behavior.
- Add screen/camera-focused recorder tests before changing capture or compositor behavior.
- Decide whether the first public release is unsigned pre-release software or requires signing/notarization first.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security
reports should follow [SECURITY.md](SECURITY.md).

## License

NextDJ is released under the [MIT License](LICENSE).
