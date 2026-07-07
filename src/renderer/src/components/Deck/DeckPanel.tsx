import { useCallback, useState } from 'react'
import { FolderOpen, MoreHorizontal, Pause, Play, SkipBack } from 'lucide-react'
import type { HotCue, LoopState } from '../../audio/deck'
import { Overview } from '../Waveform/Overview'
import { ZoomWaveform } from '../Waveform/ZoomWaveform'
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
  bpm: number
  firstBeatOffset: number
  effectiveBpm: number
  waveform: WaveformData | null
  hotCues: Array<HotCue | null>
  loop: LoopState
  getPosition: () => number
  onLoad: (file: File) => Promise<void>
  onTrackDrop: (trackId: string) => Promise<void>
  onTogglePlayback: () => Promise<void>
  onCueToStart: () => void
  onPitchChange: (percent: number) => void
  onSync: () => void
  onHotCue: (index: number) => void
  onClearHotCue: (index: number) => void
  onLoopIn: () => void
  onLoopOut: () => void
  onLoopExit: () => void
  onAutoLoop: (beats: number) => void
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

function formatBpm(bpm: number): string {
  return bpm > 0 ? bpm.toFixed(1) : '--.-'
}

export function DeckPanel({
  deckId,
  accent,
  trackName,
  position,
  duration,
  isPlaying,
  pitch,
  bpm,
  firstBeatOffset,
  effectiveBpm,
  waveform,
  hotCues,
  loop,
  getPosition,
  onLoad,
  onTrackDrop,
  onTogglePlayback,
  onCueToStart,
  onPitchChange,
  onSync,
  onHotCue,
  onClearHotCue,
  onLoopIn,
  onLoopOut,
  onLoopExit,
  onAutoLoop,
  onSeek
}: DeckPanelProps): JSX.Element {
  const remaining = Math.max(0, duration - position)
  const hasTrack = duration > 0
  const [syncFlashing, setSyncFlashing] = useState(false)

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

  const handleSyncClick = useCallback((): void => {
    onSync()
    setSyncFlashing(true)
    window.setTimeout(() => setSyncFlashing(false), 280)
  }, [onSync])

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
      className={`console-panel deck-panel ${hasTrack ? '' : 'deck-panel-empty'}`}
      style={{ '--deck-accent': accent } as React.CSSProperties}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="deck-header">
        <span className="deck-badge">DECK {deckId}</span>
        <label className="icon-button" title="Load track">
          <FolderOpen size={15} strokeWidth={2.2} />
          <input accept="audio/*" className="sr-only" type="file" onChange={handleFileChange} />
        </label>
      </div>

      <div className="deck-waveforms">
        <ZoomWaveform
          accent={accent}
          bpm={bpm}
          duration={duration}
          firstBeatOffset={firstBeatOffset}
          getPosition={getPosition}
          waveform={waveform}
          onSeek={onSeek}
        />
        <Overview
          accent={accent}
          duration={duration}
          getPosition={getPosition}
          waveform={waveform}
          onSeek={onSeek}
        />
      </div>

      <div className="led-display">
        {hasTrack ? <span className="deck-artwork" aria-hidden="true" /> : null}
        <div className="led-content">
          <p className="led-title" title={trackName}>
            {hasTrack ? trackName : 'No track loaded'}
          </p>
          <div className={`led-row ${hasTrack ? '' : 'led-row-empty'}`}>
            <span>{formatTime(position)}</span>
            <span className="led-bpm">{formatBpm(effectiveBpm)} BPM</span>
            <span className="led-remaining">-{formatTime(remaining)}</span>
          </div>
        </div>
        {hasTrack ? (
          <span aria-hidden="true" className="led-menu">
            <MoreHorizontal size={15} strokeWidth={2.2} />
          </span>
        ) : null}
      </div>

      <div className="deck-center">
        <div className="deck-jog-area">
          {hasTrack ? (
            <JogWheel
              accent={accent}
              duration={duration}
              isPlaying={isPlaying}
              label={`Deck ${deckId} jog wheel`}
              position={position}
              onSeek={onSeek}
            />
          ) : (
            <div className="deck-drop-hint">
              <p>Drop a track here</p>
              <p className="deck-drop-sub">or use the folder button</p>
            </div>
          )}
        </div>
        <div className="deck-pitch">
          <span className="fader-label">Pitch</span>
          <Fader
            centerDetent
            accent={accent}
            disabled={!hasTrack}
            hideLabel
            label="Pitch"
            max={8}
            min={-8}
            scale={{ count: 17, majorEvery: 2 }}
            step={0.1}
            value={pitch}
            valueFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
            onChange={onPitchChange}
          />
          <button
            className={`led-button ${syncFlashing ? 'led-button-flash' : ''} `}
            disabled={!hasTrack || bpm <= 0}
            title="Match BPM with the other deck"
            type="button"
            onClick={handleSyncClick}
          >
            SYNC
          </button>
          <span aria-hidden="true" className="deck-pitch-dots">
            <span className="deck-pitch-dot deck-pitch-dot-lit" />
            <span className="deck-pitch-dot" />
          </span>
        </div>
      </div>

      <div className="deck-button-group">
        <span className="deck-control-label">Hot cues</span>
        <div className="hot-cue-row">
          {hotCues.map((cue, index) => (
            <button
              key={index}
              aria-label={cue ? `Jump to hot cue ${index + 1}` : `Set hot cue ${index + 1}`}
              className={`hot-cue-button ${cue ? 'hot-cue-button-lit' : ''}`}
              disabled={!hasTrack}
              style={{ '--hot-cue-color': cue?.color ?? '#475569' } as React.CSSProperties}
              title={
                cue
                  ? `Hot cue ${index + 1}: jump to ${formatTime(cue.position)}. Right click or Shift-click to clear.`
                  : `Hot cue ${index + 1}: save this position.`
              }
              type="button"
              onClick={(event) => {
                if (event.shiftKey) {
                  onClearHotCue(index)
                } else {
                  onHotCue(index)
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                onClearHotCue(index)
              }}
            >
              <span className="control-button-label">Cue</span>
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="deck-control-row">
        <button
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`transport-button transport-primary ${isPlaying ? 'transport-button-lit transport-button-pulse' : ''}`}
          disabled={!hasTrack}
          title={isPlaying ? 'Pause' : 'Play'}
          type="button"
          onClick={handlePlaybackClick}
        >
          {isPlaying ? <Pause size={18} strokeWidth={2.4} /> : <Play size={18} strokeWidth={2.4} />}
        </button>
        <button
          aria-label="Set loop start point"
          className={`loop-button ${loop.start !== null ? 'loop-button-lit' : ''}`}
          disabled={!hasTrack}
          title="Loop IN: set the loop start point"
          type="button"
          onClick={onLoopIn}
        >
          <span className="control-button-label">Loop</span>
          <span>IN</span>
        </button>
        <button
          aria-label="Set loop end point"
          className={`loop-button ${loop.end !== null ? 'loop-button-lit' : ''}`}
          disabled={!hasTrack}
          title="Loop OUT: set the loop end point"
          type="button"
          onClick={onLoopOut}
        >
          <span className="control-button-label">Loop</span>
          <span>OUT</span>
        </button>
        {[1, 2, 4, 8].map((beats) => (
          <button
            key={beats}
            aria-label={loop.active ? 'Exit active loop' : `Start ${beats}-beat auto loop`}
            className={`loop-button ${loop.active ? 'loop-button-lit' : ''}`}
            disabled={!hasTrack || bpm <= 0}
            title={loop.active ? 'Exit active loop' : `Auto loop: repeat ${beats} beat${beats === 1 ? '' : 's'}`}
            type="button"
            onClick={() => (loop.active ? onLoopExit() : onAutoLoop(beats))}
          >
            <span className="control-button-label">Auto</span>
            <span>{beats}B</span>
          </button>
        ))}
        <button
          aria-label="Return to track start"
          className="transport-button"
          disabled={!hasTrack}
          title="Return to track start"
          type="button"
          onClick={onCueToStart}
        >
          <SkipBack size={18} strokeWidth={2.4} />
        </button>
      </div>
    </section>
  )
}
