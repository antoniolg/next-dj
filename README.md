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

## Architecture

- `src/main`: Electron lifecycle and desktop IPC. YouTube/yt-dlp and recording write paths live here because they need Node/Electron APIs.
- `src/preload`: the stable `window.nextdj` bridge exposed to the renderer.
- `src/shared`: types shared by main, preload, and renderer without importing React or Electron UI code.
- `src/renderer/src/audio`: WebAudio engine, decks, mixer, output routing, BPM analysis, and deck persistence helpers.
- `src/renderer/src/hooks`: React orchestration around the audio engine, library, recording, shortcuts, and output devices.
- `src/renderer/src/components`: presentation components for decks, mixer, library, settings, waveforms, and controls.
- `src/renderer/src/library`: local library persistence, file helpers, and audio metadata readers.

## Production Checklist

- Run `npm run check` before handoff.
- Keep `window.nextdj` backward compatible unless a migration is documented.
- Keep existing `nextdj.*` storage keys stable unless a migration is added.
- Validate all IPC inputs in main before touching disk, shell, or external processes.
- Keep Electron permissions narrow; media and display capture are currently the only allowed runtime permissions.
- Avoid large multi-purpose files. Split new behavior into testable modules before it grows past roughly 500 LOC.
