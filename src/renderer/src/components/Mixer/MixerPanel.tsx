import type { EqBand } from '../../audio/deck'
import type { DeckId } from '../../hooks/useEngine'
import { Fader } from '../controls/Fader'
import { Knob } from '../controls/Knob'
import { VUMeter } from '../controls/VUMeter'

interface ChannelValues {
  trim: number
  eq: Record<EqBand, number>
  volume: number
  cue: boolean
}

interface MixerPanelProps {
  channelA: ChannelValues
  channelB: ChannelValues
  crossfade: number
  cueMix: number
  masterVolume: number
  analyserA: AnalyserNode | null
  analyserB: AnalyserNode | null
  masterAnalyser: AnalyserNode | null
  onTrimChange: (deckId: DeckId, value: number) => void
  onEqChange: (deckId: DeckId, band: EqBand, value: number) => void
  onChannelVolumeChange: (deckId: DeckId, value: number) => void
  onCueToggle: (deckId: DeckId) => void
  onCrossfadeChange: (value: number) => void
  onCueMixChange: (value: number) => void
  onMasterVolumeChange: (value: number) => void
}

const EQ_BANDS: Array<{ band: EqBand; label: string }> = [
  { band: 'high', label: 'Hi' },
  { band: 'mid', label: 'Mid' },
  { band: 'low', label: 'Low' }
]

function ChannelStrip({
  deckId,
  accent,
  values,
  analyser,
  onTrimChange,
  onEqChange,
  onChannelVolumeChange,
  onCueToggle
}: {
  deckId: DeckId
  accent: string
  values: ChannelValues
  analyser: AnalyserNode | null
  onTrimChange: MixerPanelProps['onTrimChange']
  onEqChange: MixerPanelProps['onEqChange']
  onChannelVolumeChange: MixerPanelProps['onChannelVolumeChange']
  onCueToggle: MixerPanelProps['onCueToggle']
}): JSX.Element {
  return (
    <div className="channel-strip">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black" style={{ color: accent }}>
          CH {deckId}
        </h3>
        <button
          aria-pressed={values.cue}
          className={`cue-button ${values.cue ? 'cue-button-lit' : ''}`}
          style={{ '--cue-accent': accent } as React.CSSProperties}
          type="button"
          onClick={() => onCueToggle(deckId)}
        >
          Cue
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Knob
          accent={accent}
          defaultValue={1}
          label="Trim"
          max={1.5}
          min={0}
          step={0.01}
          value={values.trim}
          valueFormatter={(value) => value.toFixed(2)}
          onChange={(value) => onTrimChange(deckId, value)}
        />
        <VUMeter analyser={analyser} label="Level" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {EQ_BANDS.map(({ band, label }) => (
          <Knob
            key={band}
            accent={accent}
            defaultValue={0}
            label={label}
            max={6}
            min={-26}
            step={0.5}
            value={values.eq[band]}
            valueFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`}
            onChange={(value) => onEqChange(deckId, band, value)}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-center">
        <Fader
          accent={accent}
          label="Volume"
          max={1}
          min={0}
          value={values.volume}
          onChange={(value) => onChannelVolumeChange(deckId, value)}
        />
      </div>
    </div>
  )
}

export function MixerPanel({
  channelA,
  channelB,
  crossfade,
  cueMix,
  masterVolume,
  analyserA,
  analyserB,
  masterAnalyser,
  onTrimChange,
  onEqChange,
  onChannelVolumeChange,
  onCueToggle,
  onCrossfadeChange,
  onCueMixChange,
  onMasterVolumeChange
}: MixerPanelProps): JSX.Element {
  return (
    <section className="console-panel mixer-panel">
      <div className="flex items-center justify-between">
        <span className="mixer-screw" />
        <h2 className="text-center text-sm font-black uppercase text-slate-400">Mixer</h2>
        <span className="mixer-screw" />
      </div>

      <div className="mt-5 grid grid-cols-[1fr_92px_1fr] gap-4">
        <ChannelStrip
          accent="#22d3ee"
          analyser={analyserA}
          deckId="A"
          values={channelA}
          onChannelVolumeChange={onChannelVolumeChange}
          onCueToggle={onCueToggle}
          onEqChange={onEqChange}
          onTrimChange={onTrimChange}
        />

        <div className="master-strip">
          <VUMeter analyser={masterAnalyser} label="Master" segments={22} />
          <Knob
            accent="#f8fafc"
            defaultValue={0.9}
            label="Master"
            max={1}
            min={0}
            value={masterVolume}
            valueFormatter={(value) => `${Math.round(value * 100)}%`}
            onChange={onMasterVolumeChange}
          />
          <Knob
            accent="#f59e0b"
            defaultValue={0}
            label="Cue Mix"
            max={1}
            min={0}
            value={cueMix}
            valueFormatter={(value) => `${Math.round(value * 100)}%`}
            onChange={onCueMixChange}
          />
        </div>

        <ChannelStrip
          accent="#f59e0b"
          analyser={analyserB}
          deckId="B"
          values={channelB}
          onChannelVolumeChange={onChannelVolumeChange}
          onCueToggle={onCueToggle}
          onEqChange={onEqChange}
          onTrimChange={onTrimChange}
        />
      </div>

      <div className="mt-5 rounded border border-black/50 bg-zinc-950/70 p-4 shadow-inner">
        <Fader
          accent="#e5e7eb"
          label="Crossfader"
          max={1}
          min={-1}
          orientation="horizontal"
          step={0.01}
          value={crossfade}
          valueFormatter={(value) => (value < -0.02 ? 'A' : value > 0.02 ? 'B' : 'Center')}
          onChange={onCrossfadeChange}
        />
      </div>
    </section>
  )
}
