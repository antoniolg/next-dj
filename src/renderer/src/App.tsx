import { useState } from 'react'
import { DeckPanel } from './components/Deck/DeckPanel'
import { MixerPanel } from './components/Mixer/MixerPanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { useEngine } from './hooks/useEngine'

export function App(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  return (
    <main className="min-h-screen overflow-hidden bg-zinc-950 px-5 py-5 text-slate-100">
      <div className="console-shell mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1500px] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Desktop mixing console</p>
            <h1 className="text-3xl font-black leading-none text-white">NextDJ</h1>
          </div>
          <button
            aria-label="Open output settings"
            className="settings-gear"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <span />
          </button>
        </header>

        <div className="grid flex-1 gap-5 p-5 xl:grid-cols-[minmax(320px,1fr)_minmax(440px,0.95fr)_minmax(320px,1fr)]">
          <DeckPanel
            accent="#22d3ee"
            deckId="A"
            duration={decks.A.duration}
            isPlaying={decks.A.isPlaying}
            pitch={decks.A.pitch}
            position={decks.A.position}
            trackName={decks.A.trackName}
            onCueToStart={() => cueToStart('A')}
            onLoad={(file) => loadTrack('A', file)}
            onPitchChange={(value) => setPitch('A', value)}
            onSeek={(seconds) => seek('A', seconds)}
            onTogglePlayback={() => togglePlayback('A')}
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
            isPlaying={decks.B.isPlaying}
            pitch={decks.B.pitch}
            position={decks.B.position}
            trackName={decks.B.trackName}
            onCueToStart={() => cueToStart('B')}
            onLoad={(file) => loadTrack('B', file)}
            onPitchChange={(value) => setPitch('B', value)}
            onSeek={(seconds) => seek('B', seconds)}
            onTogglePlayback={() => togglePlayback('B')}
          />
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
    </main>
  )
}
