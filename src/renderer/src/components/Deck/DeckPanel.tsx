import { useCallback } from 'react'
import { Overview } from '../Waveform/Overview'
import { ZoomWave } from '../Waveform/ZoomWave'
import type { WaveformData } from '../Waveform/waveformData'
import { Fader } from '../controls/Fader'
import { JogWheel } from '../controls/JogWheel'

interface DeckPanelProps {
  deckId: 'A' | 'B'
  accent: string
  trackName: string
  position: number
  duration: number
  isPlaying: boolean
  pitch: number
  waveform: WaveformData | null
  getPosition: () => number
  onLoad: (file: File) => Promise<void>
  onTrackDrop: (trackId: string) => Promise<void>
  onTogglePlayback: () => Promise<void>
  onCueToStart: () => void
  onPitchChange: (percent: number) => void
  onSeek: (seconds: number) => void
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

export function DeckPanel({
  deckId,
  accent,
  trackName,
  position,
  duration,
  isPlaying,
  pitch,
  waveform,
  getPosition,
  onLoad,
  onTrackDrop,
  onTogglePlayback,
  onCueToStart,
  onPitchChange,
  onSeek
}: DeckPanelProps): JSX.Element {
  const remaining = Math.max(0, duration - position)

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

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/plain')) {
      event.preventDefault()
      event.currentTarget.classList.add('deck-panel-drop-target')
    }
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>): void => {
    event.currentTarget.classList.remove('deck-panel-drop-target')
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>): void => {
      event.preventDefault()
      event.currentTarget.classList.remove('deck-panel-drop-target')

      const file = Array.from(event.dataTransfer.files).find((item) =>
        item.type.startsWith('audio/')
      )
      const trackId = event.dataTransfer.getData('text/plain')

      if (file) {
        void onLoad(file)
      } else if (trackId) {
        void onTrackDrop(trackId)
      }
    },
    [onLoad, onTrackDrop]
  )

  return (
    <section
      className="console-panel deck-panel min-w-0"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Deck</p>
          <h2 className="text-4xl font-black leading-none" style={{ color: accent }}>
            {deckId}
          </h2>
        </div>
        <label className="load-button">
          Load
          <input accept="audio/*" className="sr-only" type="file" onChange={handleFileChange} />
        </label>
      </div>

      <div className="mt-5">
        <ZoomWave
          accent={accent}
          duration={duration}
          getPosition={getPosition}
          waveform={waveform}
        />
      </div>

      <div className="led-display mt-5">
        <p className="truncate text-lg font-bold" title={trackName}>
          {trackName}
        </p>
        <div className="mt-2 flex justify-between font-mono text-xs text-cyan-200/70">
          <span>{formatTime(position)}</span>
          <span>-{formatTime(remaining)}</span>
        </div>
      </div>

      <div className="mt-4">
        <Overview
          accent={accent}
          duration={duration}
          position={position}
          waveform={waveform}
          onSeek={onSeek}
        />
      </div>

      <div className="mt-5 grid grid-cols-[1fr_72px] items-center gap-6">
        <JogWheel
          accent={accent}
          duration={duration}
          isPlaying={isPlaying}
          label={`Deck ${deckId} jog wheel`}
          position={position}
          onSeek={onSeek}
        />
        <Fader
          centerDetent
          accent={accent}
          label="Pitch"
          max={8}
          min={-8}
          step={0.1}
          value={pitch}
          valueFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
          onChange={onPitchChange}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          className="transport-button transport-primary"
          disabled={duration <= 0}
          style={{ '--transport-accent': accent } as React.CSSProperties}
          type="button"
          onClick={handlePlaybackClick}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          className="transport-button"
          disabled={duration <= 0}
          type="button"
          onClick={onCueToStart}
        >
          Cue Start
        </button>
      </div>
    </section>
  )
}
