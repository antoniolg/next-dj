import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getMasterBeatIndex } from './app/masterBeat'
import { DeckPanel } from './components/Deck/DeckPanel'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MixerPanel } from './components/Mixer/MixerPanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { useAppShortcuts } from './hooks/useAppShortcuts'
import { useDeckLoading } from './hooks/useDeckLoading'
import { useEngine } from './hooks/useEngine'
import { useLibrary } from './hooks/useLibrary'
import { useRecorder } from './hooks/useRecorder'

export function App(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
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
  const { loadingDecks, loadFileToDeck, loadLibraryTrack, loadLibraryTrackById } = useDeckLoading({
    libraryReady,
    addFiles,
    resolveTrackFile,
    getTrack,
    loadTrack
  })

  const getDeckAPosition = useCallback((): number => engine.deckA.getPosition(), [engine])
  const getDeckBPosition = useCallback((): number => engine.deckB.getPosition(), [engine])

  useEffect(() => {
    document.title = 'NextDJ'
  }, [])

  useAppShortcuts({
    deckPitch: { A: decks.A.pitch, B: decks.B.pitch },
    loadingDecks,
    crossfade: mixer.crossfade,
    shortcutsOpen,
    setShortcutsOpen,
    togglePlayback,
    cuePress,
    cueRelease,
    syncDeck,
    toggleCue,
    setCrossfade,
    setPitch,
    nudgeDeck
  })

  const masterDeck = masterDeckId ? decks[masterDeckId] : null
  const masterAccent = masterDeckId === 'B' ? '#f59e0b' : '#22d3ee'
  const masterBeatIndex = getMasterBeatIndex(masterDeckId, decks)

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
