# Changelog

All notable changes to NextDJ will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic
Versioning once public releases begin.

## [0.1.1] - 2026-07-10

NextDJ remains early, unsigned software. This release is published as a
regular GitHub Release so it is visible as the latest downloadable version;
macOS and Windows may still show operating-system security warnings.

### Added

- Deterministic Electron end-to-end coverage for track loading and playback.
- Production performance budgets for deck loading, playback, and recording.
- Keyboard operation for knobs, jog wheels, waveforms, CUE, and modal panels.
- Versioned library persistence with invalid-record quarantine and recovery.

### Changed

- Made transport, loops, track loading, output routing, and library writes race-safe.
- Split deck responsibilities and restored renderer dependency boundaries.
- Bounded metadata analysis, provider execution, recording sessions, and library capacity.
- Reused one quality gate for CI and releases, with pinned actions and reproducible tooling.

### Security

- Enforced recording ownership, per-session limits, collision-safe paths, and exact cleanup.
- Added strict playlist-provider validation, timeouts, output budgets, and failure isolation.
- Scoped GitHub release permissions and added automated dependency updates.

## [0.1.0-alpha.1] - 2026-07-09

This first public build is intended as an unsigned pre-release. macOS and
Windows may show operating-system security warnings. Build from source if you
prefer to inspect the app before running it.

### Added

- Electron, React, and WebAudio desktop DJ console.
- Local track loading, deck transport, waveform views, BPM analysis, mixer, and recording.
- Neutral playlist import provider API for locally configured plugins.
- Quality gate with linting, type checking, tests, coverage, and production build.
- Performance snapshot tooling for deck loading, playback, and recording smoke checks.
- Release packaging for macOS, Windows, and Linux with generated app icons.
