# NextDJ

NextDJ is an Electron + Vite + React desktop DJ console. The app keeps real-time audio work in renderer-side WebAudio modules, desktop-only integrations in Electron main/preload, and UI workflows in React hooks/components.

## Development

```bash
npm install
npm run dev
```

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

- Global floor: 30% statements, branches, functions, and lines.
- Raise the floor only after adding meaningful regression tests, not by excluding risky code.

## Architecture

- `src/main`: Electron lifecycle and desktop IPC. YouTube/yt-dlp and recording write paths live here because they need Node/Electron APIs.
- `src/main/appSecurity.ts`: Electron session permission policy.
- `src/main/recordingValidation.ts`: IPC input validation for recording calls.
- `src/preload`: the stable `window.nextdj` bridge exposed to the renderer.
- `src/shared`: types shared by main, preload, and renderer without importing React or Electron UI code.
- `src/renderer/src/audio`: WebAudio engine, decks, mixer, output routing, BPM analysis, deck persistence, hot-cue state, and loop state.
- `src/renderer/src/hooks`: React orchestration around the audio engine, library, recording, shortcuts, output devices, deck actions, and mixer actions.
- `src/renderer/src/components`: presentation components for decks, mixer, library, settings, waveforms, and controls.
- `src/renderer/src/library`: local library persistence, file helpers, and audio metadata readers.
- `src/renderer/src/styles`: renderer CSS split by UI domain.

## Performance Profiling

Use real DJ workflows before optimizing. The highest-risk paths are track loading, waveform/BPM analysis, RAF-driven transport updates, VU meters, recording, and library rendering.

To profile track loading in DevTools, enable the opt-in renderer trace and then load a track:

```js
localStorage.setItem('nextdj.perf', '1')
```

Reload the app or open it with `?nextdjPerf=1`, record a Chrome Performance session, and inspect `nextdj.deck.loadFile.*` measures. The app currently records read, decode, waveform, and BPM phases. The flag also logs those measures to the console with the `[nextdj:perf]` prefix.

With the same flag enabled, DevTools also exposes `window.__NEXTDJ_PERF__.snapshot()` and `window.__NEXTDJ_PERF__.reset()` for a compact in-session summary of measured phases, slow waveform frames, and renderer long tasks.

For a quick non-interactive renderer smoke snapshot, run:

```bash
npm run perf:snapshot -- --wait-ms 5000
```

That command starts the dev Electron app with `NEXTDJ_PERF=1`, opens a temporary remote debugging port, reads `window.__NEXTDJ_PERF__.snapshot()`, prints JSON, and shuts the app down. It proves the profiling path works, but it does not replace a real session with loaded tracks and recording.

During playback, the same flag reports slow waveform draw frames as `waveform.overview slow frame` and `waveform.zoom slow frame`, plus analyser-heavy meter frames as `vu.meter slow frame`. Treat repeated slow-frame logs as evidence before changing waveform fidelity, animation cadence, or meter behavior.

The flag also starts a renderer long-task observer when the runtime supports it. Repeated `renderer long task` logs indicate main-thread blocking that should be traced before changing UI behavior.

Recording paths emit `nextdj.recording.*` measures for session start, chunk conversion, chunk append, pending-write drain, and stop. The same trace also reports slow compositor frames as `recording.compositor slow frame`. Use those together with long-task logs when checking whether recording competes with live playback.

Performance changes should preserve the existing UI. Any optimization that visibly changes waveform fidelity, animation cadence, layout, or interaction timing needs visual validation before shipping.

## Production Checklist

- Run `npm run check` before handoff.
- Keep `window.nextdj` backward compatible unless a migration is documented.
- Keep existing `nextdj.*` storage keys stable unless a migration is added.
- Validate all IPC inputs in main before touching disk, shell, or external processes.
- Keep Electron permissions narrow; media and display capture are currently the only allowed runtime permissions.
- Keep `BrowserWindow` hardened with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Avoid large multi-purpose files. Split new behavior into testable modules before it grows past roughly 500 LOC.

## Next Refactor Targets

- Add smoke tests around `App` and high-value component flows with WebAudio and `window.nextdj` mocks.
- Continue carving `Deck` into transport/source scheduling and jog behavior modules.
- Split `LibraryPanel` and `MixerPanel` when adding new UI behavior; do not grow them in place.
- Add focused tests for recording state and renderer-side recorder orchestration before changing capture behavior.
