import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { DeckPanel } from './components/Deck/DeckPanel'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MixerPanel } from './components/Mixer/MixerPanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { useEngine } from './hooks/useEngine'
import { useLibrary, type LibraryTrack } from './hooks/useLibrary'
import { useRecorder } from './hooks/useRecorder'

const CROSSFADER_NUDGE = 0.08
const PITCH_NUDGE = 0.1
const DECK_TRACK_STORAGE_KEY = 'nextdj.deckTracks.v1'

type DeckTrackSelection = Partial<Record<'A' | 'B', string>>
type DeckId = 'A' | 'B'
type DeckLoadingState = Partial<Record<DeckId, string>>

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

export function App(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [loadingDecks, setLoadingDecks] = useState<DeckLoadingState>({})
  const restoredDecksRef = useRef(false)
  const {
    engine,
    decks,
    masterDeckId,
    phaseOffsets,
    channels,
    mixer,
    output,
    loadTrack,
    togglePlayback,
    seek,
    cuePress,
    cueRelease,
    setPitch,
    syncDeck,
    nudgeDeck,
    jogBend,
    exitLoop,
    setAutoLoop,
    setTrim,
    setEq,
    setChannelVolume,
    toggleCue,
    setCrossfade,
    setCueMix,
    setMasterVolume,
    setMasterDevice,
    setCueDevice,
    refreshOutputDevices
  } = useEngine()
  const { tracks, isReady: libraryReady, addFiles, addYouTubeTracks, resolveTrackFile, getTrack } = useLibrary()
  const recorder = useRecorder(engine)

  const setDeckLoading = useCallback((deckId: DeckId, message: string | null): void => {
    setLoadingDecks((current) => {
      const next = { ...current }

      if (message) {
        next[deckId] = message
      } else {
        delete next[deckId]
      }

      return next
    })
  }, [])

  const persistDeckTrack = useCallback((deckId: DeckId, trackId: string): void => {
    try {
      const parsed = JSON.parse(localStorage.getItem(DECK_TRACK_STORAGE_KEY) ?? '{}') as DeckTrackSelection
      localStorage.setItem(DECK_TRACK_STORAGE_KEY, JSON.stringify({ ...parsed, [deckId]: trackId }))
    } catch {
      localStorage.setItem(DECK_TRACK_STORAGE_KEY, JSON.stringify({ [deckId]: trackId }))
    }
  }, [])

  const loadFileToDeck = useCallback(
    async (deckId: DeckId, file: File): Promise<void> => {
      setDeckLoading(deckId, 'Analyzing audio...')

      try {
        const [track] = await addFiles([file])
        setDeckLoading(deckId, 'Loading deck...')
        await loadTrack(deckId, file)

        if (track) {
          persistDeckTrack(deckId, track.id)
        }
      } finally {
        setDeckLoading(deckId, null)
      }
    },
    [addFiles, loadTrack, persistDeckTrack, setDeckLoading]
  )

  const loadLibraryTrack = useCallback(
    async (deckId: DeckId, track: LibraryTrack): Promise<void> => {
      setDeckLoading(deckId, track.file ? 'Loading deck...' : 'Downloading audio...')

      try {
        const file = await resolveTrackFile(track)

        if (!file) {
          return
        }

        setDeckLoading(deckId, 'Decoding waveform...')
        await loadTrack(deckId, file)
        persistDeckTrack(deckId, track.id)
      } finally {
        setDeckLoading(deckId, null)
      }
    },
    [loadTrack, persistDeckTrack, resolveTrackFile, setDeckLoading]
  )

  const loadLibraryTrackById = useCallback(
    async (deckId: DeckId, trackId: string): Promise<void> => {
      const track = getTrack(trackId)

      if (track) {
        await loadLibraryTrack(deckId, track)
      }
    },
    [getTrack, loadLibraryTrack]
  )

  const getDeckAPosition = useCallback((): number => engine.deckA.getPosition(), [engine])
  const getDeckBPosition = useCallback((): number => engine.deckB.getPosition(), [engine])

  useEffect(() => {
    document.title = 'NextDJ'
  }, [])

  useEffect(() => {
    if (!libraryReady || restoredDecksRef.current) {
      return
    }

    restoredDecksRef.current = true

    try {
      const parsed = JSON.parse(localStorage.getItem(DECK_TRACK_STORAGE_KEY) ?? '{}') as DeckTrackSelection

      ;(['A', 'B'] as const).forEach((deckId) => {
        const trackId = parsed[deckId]
        const track = trackId ? getTrack(trackId) : undefined

        if (track) {
          void loadLibraryTrack(deckId, track)
        }
      })
    } catch {
      localStorage.removeItem(DECK_TRACK_STORAGE_KEY)
    }
  }, [getTrack, libraryReady, loadLibraryTrack])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return
      }

      const deckALoading = Boolean(loadingDecks.A)
      const deckBLoading = Boolean(loadingDecks.B)

      const isRepeatSensitive =
        event.code === 'KeyQ' ||
        event.code === 'KeyW' ||
        event.code === 'KeyA' ||
        event.code === 'KeyS' ||
        event.code === 'KeyD' ||
        event.code === 'KeyF' ||
        event.code === 'KeyT' ||
        event.code === 'KeyY' ||
        event.code === 'KeyC'

      if (event.repeat && isRepeatSensitive) {
        return
      }

      if (event.key === '?' || (event.code === 'Slash' && event.shiftKey)) {
        event.preventDefault()
        setShortcutsOpen((current) => !current)
        return
      }

      if (event.code === 'Escape' && shortcutsOpen) {
        event.preventDefault()
        setShortcutsOpen(false)
        return
      }

      if (event.code === 'KeyQ' && !deckALoading) {
        event.preventDefault()
        void togglePlayback('A')
        return
      }

      if (event.code === 'KeyW' && !deckBLoading) {
        event.preventDefault()
        void togglePlayback('B')
        return
      }

      if (event.code === 'KeyA' && !deckALoading) {
        event.preventDefault()
        void cuePress('A')
        return
      }

      if (event.code === 'KeyS' && !deckBLoading) {
        event.preventDefault()
        void cuePress('B')
        return
      }

      if (event.code === 'KeyD' && !deckALoading) {
        event.preventDefault()
        syncDeck('A')
        return
      }

      if (event.code === 'KeyF' && !deckBLoading) {
        event.preventDefault()
        syncDeck('B')
        return
      }

      if (event.code === 'KeyT') {
        event.preventDefault()
        toggleCue('A')
        return
      }

      if (event.code === 'KeyY') {
        event.preventDefault()
        toggleCue('B')
        return
      }

      if (event.code === 'KeyZ') {
        event.preventDefault()
        setCrossfade(Math.max(-1, mixer.crossfade - CROSSFADER_NUDGE))
        return
      }

      if (event.code === 'KeyX') {
        event.preventDefault()
        setCrossfade(Math.min(1, mixer.crossfade + CROSSFADER_NUDGE))
        return
      }

      if (event.code === 'KeyC') {
        event.preventDefault()
        setCrossfade(0)
        return
      }

      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        const direction = event.code === 'ArrowUp' ? 1 : -1

        if (event.shiftKey) {
          event.preventDefault()
          setPitch('A', decks.A.pitch + direction * PITCH_NUDGE)
          return
        }

        if (event.altKey) {
          event.preventDefault()
          setPitch('B', decks.B.pitch + direction * PITCH_NUDGE)
          return
        }
      }

      if (event.code === 'BracketLeft') {
        event.preventDefault()
        nudgeDeck(event.shiftKey ? 'B' : 'A', -1)
        return
      }

      if (event.code === 'BracketRight') {
        event.preventDefault()
        nudgeDeck(event.shiftKey ? 'B' : 'A', 1)
        return
      }

    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return
      }

      if (event.code === 'KeyA') {
        cueRelease('A')
        return
      }

      if (event.code === 'KeyS') {
        cueRelease('B')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    decks.A.pitch,
    decks.B.pitch,
    loadingDecks.A,
    loadingDecks.B,
    mixer.crossfade,
    nudgeDeck,
    cuePress,
    cueRelease,
    shortcutsOpen,
    setCrossfade,
    setPitch,
    togglePlayback,
    syncDeck,
    toggleCue
  ])

  const masterDeck = masterDeckId ? decks[masterDeckId] : null
  const masterAccent = masterDeckId === 'B' ? '#f59e0b' : '#22d3ee'
  let masterBeatIndex = -1

  if (masterDeck && masterDeck.bpm > 0 && masterDeck.isPlaying) {
    const beatSeconds = 60 / masterDeck.bpm
    masterBeatIndex =
      Math.floor((masterDeck.position - masterDeck.firstBeatOffset) / beatSeconds) % 4

    if (masterBeatIndex < 0) {
      masterBeatIndex += 4
    }
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden text-slate-100">
      <div className="console-shell flex min-h-0 flex-1 flex-col">
        <div className="console-stage">
          <div className="console-grid">
            <DeckPanel
              accent="#22d3ee"
              deckId="A"
              duration={decks.A.duration}
              bpm={decks.A.bpm}
              effectiveBpm={decks.A.effectiveBpm}
              firstBeatOffset={decks.A.firstBeatOffset}
              getPosition={getDeckAPosition}
              isPlaying={decks.A.isPlaying}
              isLoading={Boolean(loadingDecks.A)}
              loadingMessage={loadingDecks.A}
              loop={decks.A.loop}
              masterDeckId={masterDeckId}
              masterEffectiveBpm={masterDeckId ? decks[masterDeckId].effectiveBpm : 0}
              phaseOffset={phaseOffsets.A}
              pitch={decks.A.pitch}
              position={decks.A.position}
              trackName={decks.A.trackName}
              waveform={decks.A.waveform}
              onAutoLoop={(beats) => setAutoLoop('A', beats)}
              onCueDown={() => cuePress('A')}
              onCueUp={() => cueRelease('A')}
              onJogBend={(degrees) => jogBend('A', degrees)}
              onLoad={(file) => loadFileToDeck('A', file)}
              onLoopExit={() => exitLoop('A')}
              onNudge={(direction) => nudgeDeck('A', direction)}
              onPitchChange={(value) => setPitch('A', value)}
              onSeek={(seconds) => seek('A', seconds)}
              onSync={() => syncDeck('A')}
              onTogglePlayback={() => togglePlayback('A')}
              onTrackDrop={(trackId) => loadLibraryTrackById('A', trackId)}
            />

            <MixerPanel
              analyserA={engine.mixer.channelAAnalyser}
              analyserB={engine.mixer.channelBAnalyser}
              channelA={channels.A}
              channelB={channels.B}
              crossfade={mixer.crossfade}
              cueMix={mixer.cueMix}
              masterAccent={masterAccent}
              masterBeatIndex={masterBeatIndex}
              masterBpm={masterDeck?.effectiveBpm ?? 0}
              masterVolume={mixer.masterVolume}
              recorder={recorder}
              onChannelVolumeChange={setChannelVolume}
              onCrossfadeChange={setCrossfade}
              onCueMixChange={setCueMix}
              onCueToggle={toggleCue}
              onEqChange={setEq}
              onMasterVolumeChange={setMasterVolume}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenShortcuts={() => setShortcutsOpen(true)}
              onTrimChange={setTrim}
            />

            <DeckPanel
              accent="#f59e0b"
              deckId="B"
              duration={decks.B.duration}
              bpm={decks.B.bpm}
              effectiveBpm={decks.B.effectiveBpm}
              firstBeatOffset={decks.B.firstBeatOffset}
              getPosition={getDeckBPosition}
              isPlaying={decks.B.isPlaying}
              isLoading={Boolean(loadingDecks.B)}
              loadingMessage={loadingDecks.B}
              loop={decks.B.loop}
              masterDeckId={masterDeckId}
              masterEffectiveBpm={masterDeckId ? decks[masterDeckId].effectiveBpm : 0}
              phaseOffset={phaseOffsets.B}
              pitch={decks.B.pitch}
              position={decks.B.position}
              trackName={decks.B.trackName}
              waveform={decks.B.waveform}
              onAutoLoop={(beats) => setAutoLoop('B', beats)}
              onCueDown={() => cuePress('B')}
              onCueUp={() => cueRelease('B')}
              onJogBend={(degrees) => jogBend('B', degrees)}
              onLoad={(file) => loadFileToDeck('B', file)}
              onLoopExit={() => exitLoop('B')}
              onNudge={(direction) => nudgeDeck('B', direction)}
              onPitchChange={(value) => setPitch('B', value)}
              onSeek={(seconds) => seek('B', seconds)}
              onSync={() => syncDeck('B')}
              onTogglePlayback={() => togglePlayback('B')}
              onTrackDrop={(trackId) => loadLibraryTrackById('B', trackId)}
            />
          </div>

          <div className="library-dock">
            <LibraryPanel
              tracks={tracks}
              keyboardLoadDeckId={masterDeckId === 'A' ? 'B' : 'A'}
              onAddFiles={addFiles}
              onAddYouTubeTracks={addYouTubeTracks}
              onLoadTrack={loadLibraryTrack}
            />
          </div>
        </div>
      </div>

      <SettingsPanel
        cueDeviceId={output.cueDeviceId}
        devices={output.devices}
        error={output.error}
        masterDeviceId={output.masterDeviceId}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onCueDeviceChange={setCueDevice}
        onMasterDeviceChange={setMasterDevice}
        onRefreshDevices={refreshOutputDevices}
      />

      {shortcutsOpen ? (
        <div className="shortcut-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="shortcut-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="micro-label">Keyboard</p>
                <h2 className="text-xl font-bold text-white">Shortcuts</h2>
              </div>
              <button
                aria-label="Close keyboard shortcuts"
                className="icon-button"
                type="button"
                onClick={() => setShortcutsOpen(false)}
              >
                <X size={15} strokeWidth={2.4} />
              </button>
            </div>
            <p className="micro-label shortcut-section">Decks</p>
            <dl className="shortcut-grid">
              <dt>Q / W</dt>
              <dd>Play-pause deck A / B</dd>
              <dt>A / S</dt>
              <dd>Cue deck A / B (hold to preview)</dd>
              <dt>D / F</dt>
              <dd>Sync deck A / B with the master</dd>
              <dt>[ / ]</dt>
              <dd>Nudge deck A back / forward (Shift for deck B)</dd>
              <dt>Shift + Up/Down</dt>
              <dd>Pitch deck A up / down</dd>
              <dt>Alt + Up/Down</dt>
              <dd>Pitch deck B up / down</dd>
            </dl>
            <p className="micro-label shortcut-section">Mixer</p>
            <dl className="shortcut-grid">
              <dt>T / Y</dt>
              <dd>Headphone cue channel A / B</dd>
              <dt>Z / X / C</dt>
              <dd>Nudge crossfader left / right / center</dd>
            </dl>
            <p className="micro-label shortcut-section">General</p>
            <dl className="shortcut-grid">
              <dt>K</dt>
              <dd>Expand or shrink the crate</dd>
              <dt>Enter</dt>
              <dd>Load the focused crate track into the non-master deck</dd>
              <dt>?</dt>
              <dd>Toggle this panel (Esc closes)</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </main>
  )
}
