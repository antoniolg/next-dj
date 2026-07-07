import { useCallback, useState } from 'react'
import { FolderOpen, MoreHorizontal, Pause, Play } from 'lucide-react'
import { MAX_PITCH_PERCENT, type HotCue, type LoopState } from '../../audio/deck'
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
  isLoading: boolean
  loadingMessage?: string
  pitch: number
  bpm: number
  firstBeatOffset: number
  effectiveBpm: number
  waveform: WaveformData | null
  hotCues: Array<HotCue | null>
  loop: LoopState
  masterDeckId: 'A' | 'B' | null
  masterEffectiveBpm: number
  phaseOffset: number
  getPosition: () => number
  onLoad: (file: File) => Promise<void>
  onTrackDrop: (trackId: string) => Promise<void>
  onTogglePlayback: () => Promise<void>
  onCueDown: () => Promise<void>
  onCueUp: () => void
  onPitchChange: (percent: number) => void
  onSync: () => void
  onNudge: (direction: -1 | 1) => void
  onJogBend: (degrees: number) => void
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

function formatPhaseOffset(seconds: number): string {
  if (Math.abs(seconds) < 0.01) {
    return 'LOCK'
  }

  return seconds > 0 ? 'EARLY' : 'LATE'
}

export function DeckPanel({
  deckId,
  accent,
  trackName,
  position,
  duration,
  isPlaying,
  isLoading,
  loadingMessage,
  pitch,
  bpm,
  firstBeatOffset,
  effectiveBpm,
  waveform,
  hotCues,
  loop,
  masterDeckId,
  masterEffectiveBpm,
  phaseOffset,
  getPosition,
  onLoad,
  onTrackDrop,
  onTogglePlayback,
  onCueDown,
  onCueUp,
  onPitchChange,
  onSync,
  onNudge,
  onJogBend,
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
  const [padsOpen, setPadsOpen] = useState(false)
  const [loopBeats, setLoopBeats] = useState<4 | 8>(8)
  const isMaster = masterDeckId === deckId
  const hasMaster = masterDeckId !== null
  const deckRole = !hasTrack ? 'EMPTY' : isMaster ? 'MASTER' : hasMaster ? 'FOLLOW' : 'READY'
  const canSync = hasTrack && bpm > 0 && masterEffectiveBpm > 0 && masterDeckId !== null && !isMaster
  const requiredSyncPitch = bpm > 0 && masterEffectiveBpm > 0 ? (masterEffectiveBpm / bpm - 1) * 100 : 0
  const syncOutOfRange = canSync && Math.abs(requiredSyncPitch) > MAX_PITCH_PERCENT
  const phaseMeterOffset = Math.max(-1, Math.min(1, phaseOffset / 0.18))
  const showPhase = hasTrack && hasMaster && !isMaster && isPlaying

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.currentTarget.files?.[0]

      if (file) {
        await onLoad(file)
      }

      event.currentTarget.value = ''
    },
    [onLoad]
  )

  const handlePlaybackClick = useCallback((): void => {
    void onTogglePlayback()
  }, [onTogglePlayback])

  const handleCuePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      event.currentTarget.setPointerCapture(event.pointerId)
      void onCueDown()
    },
    [onCueDown]
  )

  const handleCuePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      onCueUp()
    },
    [onCueUp]
  )

  const handleSyncClick = useCallback((): void => {
    onSync()
    setSyncFlashing(true)
    window.setTimeout(() => setSyncFlashing(false), 280)
  }, [onSync])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>): void => {
    if (isLoading) {
      return
    }

    if (event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/plain')) {
      event.preventDefault()
      event.currentTarget.classList.add('deck-panel-drop-target')
    }
  }, [isLoading])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>): void => {
    event.currentTarget.classList.remove('deck-panel-drop-target')
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>): void => {
      event.preventDefault()
      event.currentTarget.classList.remove('deck-panel-drop-target')

      if (isLoading) {
        return
      }

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
    [isLoading, onLoad, onTrackDrop]
  )

  return (
    <section
      className={`console-panel deck-panel ${hasTrack ? '' : 'deck-panel-empty'} ${isLoading ? 'deck-panel-loading' : ''}`}
      style={{ '--deck-accent': accent } as React.CSSProperties}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="deck-header">
        <span className="deck-badge">DECK {deckId}</span>
        <label className="icon-button" title={isLoading ? 'Deck is loading' : 'Load track'}>
          <FolderOpen size={15} strokeWidth={2.2} />
          <input
            accept="audio/*"
            className="sr-only"
            disabled={isLoading}
            type="file"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {isLoading ? (
        <div className="deck-loading-overlay" role="status" aria-live="polite">
          <span className="deck-loading-spinner" aria-hidden="true" />
          <span>{loadingMessage ?? 'Loading track...'}</span>
        </div>
      ) : null}

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
              onBend={onJogBend}
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
            className={`led-button ${syncFlashing ? 'led-button-flash' : ''} ${syncOutOfRange ? 'led-button-warn' : ''}`}
            disabled={isLoading || !canSync}
            title={
              !canSync
                ? 'Load two analyzed tracks to sync'
                : syncOutOfRange
                  ? `Master tempo needs ${requiredSyncPitch.toFixed(1)}% pitch (range is ±${MAX_PITCH_PERCENT}%) — sync will only get close`
                  : 'Match BPM and beat with the master deck (starts playback if stopped)'
            }
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

      <div className="phase-strip">
        <span className={`master-pill ${isMaster ? 'master-pill-lit' : ''}`}>{deckRole}</span>
        <div className="phase-meter" aria-label={showPhase ? `Beat phase ${formatPhaseOffset(phaseOffset)}` : 'No active master deck'}>
          <span className="phase-meter-center" />
          <span
            className="phase-meter-dot"
            style={{ left: showPhase ? `${50 + phaseMeterOffset * 45}%` : '50%' }}
          />
        </div>
        <span className="phase-label">{showPhase ? formatPhaseOffset(phaseOffset) : '--'}</span>
      </div>

      <div className="deck-control-row">
        <button
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`transport-button transport-primary ${isPlaying ? 'transport-button-lit transport-button-pulse' : ''}`}
          disabled={isLoading || !hasTrack}
          title={isPlaying ? 'Pause' : 'Play'}
          type="button"
          onClick={handlePlaybackClick}
        >
          {isPlaying ? <Pause size={18} strokeWidth={2.4} /> : <Play size={18} strokeWidth={2.4} />}
        </button>
        <button
          aria-label="Cue"
          className="transport-button"
          disabled={isLoading || !hasTrack}
          title="CUE: set cue when stopped, hold to preview, or return to cue while playing"
          type="button"
          onPointerCancel={handleCuePointerUp}
          onPointerDown={handleCuePointerDown}
          onPointerUp={handleCuePointerUp}
        >
          CUE
        </button>
        <button
          aria-label="Nudge backward"
          className="transport-button"
          disabled={isLoading || !hasTrack}
          title="Nudge beat later"
          type="button"
          onClick={() => onNudge(-1)}
        >
          -
        </button>
        <button
          aria-label="Nudge forward"
          className="transport-button"
          disabled={isLoading || !hasTrack}
          title="Nudge beat earlier"
          type="button"
          onClick={() => onNudge(1)}
        >
          +
        </button>
        <button
          aria-label={loop.active ? 'Exit loop' : `Start ${loopBeats}-beat loop`}
          className={`loop-button ${loop.active ? 'loop-button-lit' : ''}`}
          disabled={isLoading || !hasTrack || bpm <= 0}
          title={loop.active ? 'Exit active loop' : `Start a ${loopBeats}-beat loop`}
          type="button"
          onClick={() => (loop.active ? onLoopExit() : onAutoLoop(loopBeats))}
        >
          <span className="control-button-label">Loop</span>
          <span>{loopBeats}B</span>
        </button>
        <button
          aria-label="Toggle loop length"
          className="transport-button"
          disabled={isLoading || !hasTrack || bpm <= 0}
          title="Toggle loop length between 4 and 8 beats"
          type="button"
          onClick={() => setLoopBeats((current) => (current === 4 ? 8 : 4))}
        >
          4/8
        </button>
        <button
          aria-label="Toggle performance pads"
          className={`transport-button ${padsOpen ? 'transport-button-lit' : ''}`}
          disabled={isLoading || !hasTrack}
          title="Show hot cues and advanced loops"
          type="button"
          onClick={() => setPadsOpen((current) => !current)}
        >
          Pads
        </button>
      </div>

      {padsOpen ? (
        <div className="deck-pads-panel">
          <div className="deck-button-group">
            <span className="deck-control-label">Hot cues</span>
            <div className="hot-cue-row">
              {hotCues.map((cue, index) => (
                <button
                  key={index}
                  aria-label={cue ? `Jump to hot cue ${index + 1}` : `Set hot cue ${index + 1}`}
                  className={`hot-cue-button ${cue ? 'hot-cue-button-lit' : ''}`}
                  disabled={isLoading || !hasTrack}
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
          <div className="pads-loop-row">
            <button
              aria-label="Set loop start point"
              className={`loop-button ${loop.start !== null ? 'loop-button-lit' : ''}`}
              disabled={isLoading || !hasTrack}
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
              disabled={isLoading || !hasTrack}
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
                disabled={isLoading || !hasTrack || bpm <= 0}
                title={loop.active ? 'Exit active loop' : `Auto loop: repeat ${beats} beat${beats === 1 ? '' : 's'}`}
                type="button"
                onClick={() => (loop.active ? onLoopExit() : onAutoLoop(beats))}
              >
                <span className="control-button-label">Auto</span>
                <span>{beats}B</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
