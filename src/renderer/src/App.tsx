import { useCallback, useEffect, useRef, useState } from 'react'
import type { Deck } from './audio/deck'
import { getEngine, type DJEngine } from './audio/engine'

declare module 'react' {
  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: unknown[]): T
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void
  export function useRef<T>(initialValue: T): { current: T }
  export function useState<T>(initialValue: T): [T, (value: T | ((current: T) => T)) => void]

  export interface ChangeEvent<T> {
    currentTarget: T
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elementName: string]: Record<string, unknown>
    }
  }
}

interface DeckPanelProps {
  label: 'A' | 'B'
  deck: Deck | null
  onLoad: (file: File) => Promise<void>
  onTogglePlayback: () => Promise<void>
  onPitchChange: (percent: number) => void
  isPlaying: boolean
  trackName: string
  position: number
  duration: number
  pitch: number
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '0:00'
  }

  const wholeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function DeckPanel({
  label,
  deck,
  onLoad,
  onTogglePlayback,
  onPitchChange,
  isPlaying,
  trackName,
  position,
  duration,
  pitch
}: DeckPanelProps): JSX.Element {
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.currentTarget.files?.[0]

      if (file) {
        await onLoad(file)
      }
    },
    [onLoad]
  )

  const handlePlaybackClick = useCallback((): void => {
    void onTogglePlayback()
  }, [onTogglePlayback])

  const handlePitchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onPitchChange(Number(event.currentTarget.value))
    },
    [onPitchChange]
  )

  return (
    <section className="flex min-h-[360px] flex-col justify-between rounded border border-slate-700 bg-slate-900/70 p-5">
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-normal">Deck {label}</h2>
          <span className="rounded bg-slate-800 px-2 py-1 text-xs font-medium uppercase tracking-normal text-slate-300">
            {deck ? 'Ready' : 'Idle'}
          </span>
        </div>

        <label className="block text-sm font-medium text-slate-300">
          Track
          <input
            accept="audio/*"
            className="mt-2 block w-full cursor-pointer rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
            type="file"
            onChange={handleFileChange}
          />
        </label>

        <p className="mt-4 truncate text-lg font-medium text-white" title={trackName}>
          {trackName}
        </p>
        <p className="mt-1 font-mono text-sm text-slate-400">
          {formatTime(position)} / {formatTime(duration)}
        </p>
      </div>

      <div className="space-y-5">
        <button
          className="w-full rounded bg-cyan-400 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          disabled={!deck || duration <= 0}
          type="button"
          onClick={handlePlaybackClick}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <label className="block text-sm font-medium text-slate-300">
          Pitch {pitch.toFixed(1)}%
          <input
            className="mt-3 w-full accent-cyan-400"
            max="8"
            min="-8"
            step="0.1"
            type="range"
            value={pitch}
            onChange={handlePitchChange}
          />
        </label>
      </div>
    </section>
  )
}

export function App(): JSX.Element {
  const engineRef = useRef<DJEngine | null>(null)
  const [, setPositionTick] = useState(0)
  const [deckAPlaying, setDeckAPlaying] = useState(false)
  const [deckBPlaying, setDeckBPlaying] = useState(false)
  const [deckATrackName, setDeckATrackName] = useState('No track loaded')
  const [deckBTrackName, setDeckBTrackName] = useState('No track loaded')
  const [deckADuration, setDeckADuration] = useState(0)
  const [deckBDuration, setDeckBDuration] = useState(0)
  const [deckAPitch, setDeckAPitch] = useState(0)
  const [deckBPitch, setDeckBPitch] = useState(0)
  const [crossfade, setCrossfade] = useState(0)

  const ensureEngine = useCallback((): DJEngine => {
    if (!engineRef.current) {
      const engine = getEngine()
      engine.deckA.onEnded = () => setDeckAPlaying(false)
      engine.deckB.onEnded = () => setDeckBPlaying(false)
      engineRef.current = engine
    }

    return engineRef.current
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPositionTick((current: number) => current + 1)
    }, 200)

    return () => window.clearInterval(intervalId)
  }, [])

  const loadDeckA = useCallback(
    async (file: File): Promise<void> => {
      const engine = ensureEngine()
      await engine.deckA.loadFile(file)
      setDeckATrackName(engine.deckA.metadata.name)
      setDeckADuration(engine.deckA.duration)
      setDeckAPlaying(false)
    },
    [ensureEngine]
  )

  const loadDeckB = useCallback(
    async (file: File): Promise<void> => {
      const engine = ensureEngine()
      await engine.deckB.loadFile(file)
      setDeckBTrackName(engine.deckB.metadata.name)
      setDeckBDuration(engine.deckB.duration)
      setDeckBPlaying(false)
    },
    [ensureEngine]
  )

  const toggleDeckA = useCallback(async (): Promise<void> => {
    const engine = ensureEngine()

    if (engine.deckA.isPlaying) {
      engine.deckA.pause()
    } else {
      await engine.deckA.play()
    }

    setDeckAPlaying(engine.deckA.isPlaying)
  }, [ensureEngine])

  const toggleDeckB = useCallback(async (): Promise<void> => {
    const engine = ensureEngine()

    if (engine.deckB.isPlaying) {
      engine.deckB.pause()
    } else {
      await engine.deckB.play()
    }

    setDeckBPlaying(engine.deckB.isPlaying)
  }, [ensureEngine])

  const setPitchA = useCallback(
    (percent: number): void => {
      ensureEngine().deckA.setPitch(percent)
      setDeckAPitch(percent)
    },
    [ensureEngine]
  )

  const setPitchB = useCallback(
    (percent: number): void => {
      ensureEngine().deckB.setPitch(percent)
      setDeckBPitch(percent)
    },
    [ensureEngine]
  )

  const handleCrossfadeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const value = Number(event.currentTarget.value)
      ensureEngine().mixer.setCrossfade(value)
      setCrossfade(value)
    },
    [ensureEngine]
  )

  const engine = engineRef.current
  const deckAPosition = engine?.deckA.getPosition() ?? 0
  const deckBPosition = engine?.deckB.getPosition() ?? 0

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-8 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header>
          <h1 className="text-4xl font-semibold tracking-normal">NextDJ</h1>
          <p className="mt-2 text-sm text-slate-400">Base audio engine prototype</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_220px_1fr]">
          <DeckPanel
            deck={engine?.deckA ?? null}
            duration={deckADuration}
            isPlaying={deckAPlaying}
            label="A"
            pitch={deckAPitch}
            position={deckAPosition}
            trackName={deckATrackName}
            onLoad={loadDeckA}
            onPitchChange={setPitchA}
            onTogglePlayback={toggleDeckA}
          />

          <section className="flex min-h-[220px] flex-col items-center justify-center rounded border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold tracking-normal">Crossfader</h2>
            <input
              aria-label="Crossfader"
              className="mt-8 w-full accent-cyan-400 lg:rotate-90"
              max="1"
              min="-1"
              step="0.01"
              type="range"
              value={crossfade}
              onChange={handleCrossfadeChange}
            />
            <div className="mt-8 flex w-full justify-between font-mono text-xs text-slate-400">
              <span>A</span>
              <span>{crossfade.toFixed(2)}</span>
              <span>B</span>
            </div>
          </section>

          <DeckPanel
            deck={engine?.deckB ?? null}
            duration={deckBDuration}
            isPlaying={deckBPlaying}
            label="B"
            pitch={deckBPitch}
            position={deckBPosition}
            trackName={deckBTrackName}
            onLoad={loadDeckB}
            onPitchChange={setPitchB}
            onTogglePlayback={toggleDeckB}
          />
        </div>
      </div>
    </main>
  )
}
