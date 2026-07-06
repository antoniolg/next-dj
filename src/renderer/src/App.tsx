import { useCallback, useEffect, useState } from 'react'
import { DeckPanel } from './components/Deck/DeckPanel'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MixerPanel } from './components/Mixer/MixerPanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { useEngine } from './hooks/useEngine'
import { useLibrary, type LibraryTrack } from './hooks/useLibrary'

const APP_VERSION = '0.1.0'
const CROSSFADER_NUDGE = 0.08
const PITCH_NUDGE = 0.1

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
  const {
    engine,
    decks,
    channels,
    mixer,
    output,
    loadTrack,
    togglePlayback,
    seek,
    cueToStart,
    setPitch,
    syncDeck,
    triggerHotCue,
    clearHotCue,
    setLoopIn,
    setLoopOut,
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
  const { tracks, addFiles, getTrack } = useLibrary()

  const loadFileToDeck = useCallback(
    async (deckId: 'A' | 'B', file: File): Promise<void> => {
      await addFiles([file])
      await loadTrack(deckId, file)
    },
    [addFiles, loadTrack]
  )

  const loadLibraryTrack = useCallback(
    async (deckId: 'A' | 'B', track: LibraryTrack): Promise<void> => {
      await loadTrack(deckId, track.file)
    },
    [loadTrack]
  )

  const loadLibraryTrackById = useCallback(
    async (deckId: 'A' | 'B', trackId: string): Promise<void> => {
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
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return
      }

      const isRepeatSensitive =
        event.code === 'KeyQ' ||
        event.code === 'KeyW' ||
        event.code === 'KeyA' ||
        event.code === 'KeyS' ||
        event.code === 'KeyC' ||
        event.code.startsWith('Digit')

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

      if (event.code === 'KeyQ') {
        event.preventDefault()
        void togglePlayback('A')
        return
      }

      if (event.code === 'KeyW') {
        event.preventDefault()
        void togglePlayback('B')
        return
      }

      if (event.code === 'KeyA') {
        event.preventDefault()
        toggleCue('A')
        return
      }

      if (event.code === 'KeyS') {
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

      const deckAHotCue = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code)

      if (deckAHotCue >= 0) {
        event.preventDefault()
        triggerHotCue('A', deckAHotCue)
        return
      }

      const deckBHotCue = ['Digit7', 'Digit8', 'Digit9', 'Digit0'].indexOf(event.code)

      if (deckBHotCue >= 0) {
        event.preventDefault()
        triggerHotCue('B', deckBHotCue)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    decks.A.pitch,
    decks.B.pitch,
    mixer.crossfade,
    shortcutsOpen,
    setCrossfade,
    setPitch,
    toggleCue,
    togglePlayback,
    triggerHotCue
  ])

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-5 text-slate-100">
      <div className="console-shell mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1500px] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Desktop mixing console</p>
            <h1 className="text-3xl font-black leading-none text-white">NextDJ</h1>
            <p className="mt-1 font-mono text-[0.65rem] uppercase text-slate-500">v{APP_VERSION}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Show keyboard shortcuts"
              className="shortcut-button"
              type="button"
              onClick={() => setShortcutsOpen(true)}
            >
              ?
            </button>
            <button
              aria-label="Open output settings"
              className="settings-gear"
              type="button"
              onClick={() => setSettingsOpen(true)}
            >
              <span />
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-5 p-5 xl:grid-cols-[minmax(320px,1fr)_minmax(440px,0.95fr)_minmax(320px,1fr)]">
          <DeckPanel
            accent="#22d3ee"
            deckId="A"
            duration={decks.A.duration}
            bpm={decks.A.bpm}
            effectiveBpm={decks.A.effectiveBpm}
            firstBeatOffset={decks.A.firstBeatOffset}
            getPosition={getDeckAPosition}
            hotCues={decks.A.hotCues}
            isPlaying={decks.A.isPlaying}
            loop={decks.A.loop}
            pitch={decks.A.pitch}
            position={decks.A.position}
            trackName={decks.A.trackName}
            waveform={decks.A.waveform}
            onAutoLoop={(beats) => setAutoLoop('A', beats)}
            onClearHotCue={(index) => clearHotCue('A', index)}
            onCueToStart={() => cueToStart('A')}
            onHotCue={(index) => triggerHotCue('A', index)}
            onLoad={(file) => loadFileToDeck('A', file)}
            onLoopExit={() => exitLoop('A')}
            onLoopIn={() => setLoopIn('A')}
            onLoopOut={() => setLoopOut('A')}
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
            masterAnalyser={engine.mixer.masterAnalyser}
            masterVolume={mixer.masterVolume}
            onChannelVolumeChange={setChannelVolume}
            onCrossfadeChange={setCrossfade}
            onCueMixChange={setCueMix}
            onCueToggle={toggleCue}
            onEqChange={setEq}
            onMasterVolumeChange={setMasterVolume}
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
            hotCues={decks.B.hotCues}
            isPlaying={decks.B.isPlaying}
            loop={decks.B.loop}
            pitch={decks.B.pitch}
            position={decks.B.position}
            trackName={decks.B.trackName}
            waveform={decks.B.waveform}
            onAutoLoop={(beats) => setAutoLoop('B', beats)}
            onClearHotCue={(index) => clearHotCue('B', index)}
            onCueToStart={() => cueToStart('B')}
            onHotCue={(index) => triggerHotCue('B', index)}
            onLoad={(file) => loadFileToDeck('B', file)}
            onLoopExit={() => exitLoop('B')}
            onLoopIn={() => setLoopIn('B')}
            onLoopOut={() => setLoopOut('B')}
            onPitchChange={(value) => setPitch('B', value)}
            onSeek={(seconds) => seek('B', seconds)}
            onSync={() => syncDeck('B')}
            onTogglePlayback={() => togglePlayback('B')}
            onTrackDrop={(trackId) => loadLibraryTrackById('B', trackId)}
          />
        </div>

        <div className="px-5 pb-5">
          <LibraryPanel tracks={tracks} onAddFiles={addFiles} onLoadTrack={loadLibraryTrack} />
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
                <p className="text-xs font-black uppercase text-slate-500">Keyboard</p>
                <h2 className="text-xl font-black text-white">Shortcuts</h2>
              </div>
              <button
                aria-label="Close keyboard shortcuts"
                className="shortcut-close"
                type="button"
                onClick={() => setShortcutsOpen(false)}
              >
                x
              </button>
            </div>
            <dl className="shortcut-grid mt-5">
              <dt>Q / W</dt>
              <dd>Play-pause deck A / B</dd>
              <dt>A / S</dt>
              <dd>CUE toggle deck A / B</dd>
              <dt>1-4</dt>
              <dd>Hot cues deck A</dd>
              <dt>7-0</dt>
              <dd>Hot cues deck B</dd>
              <dt>Z / X / C</dt>
              <dd>Nudge crossfader left / right / center</dd>
              <dt>Shift + Up/Down</dt>
              <dd>Pitch deck A up / down</dd>
              <dt>Alt + Up/Down</dt>
              <dd>Pitch deck B up / down</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </main>
  )
}
