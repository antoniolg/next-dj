import { Headphones } from 'lucide-react'
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
      <span className="channel-badge" style={{ color: accent }}>
        {deckId}
      </span>

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
          valueFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`}
          onChange={(value) => onEqChange(deckId, band, value)}
        />
      ))}

      <button
        aria-pressed={values.cue}
        className={`cue-button ${values.cue ? 'cue-button-lit' : ''}`}
        style={{ '--cue-accent': accent } as React.CSSProperties}
        title="Listen on headphones"
        type="button"
        onClick={() => onCueToggle(deckId)}
      >
        <Headphones size={13} strokeWidth={2.4} />
        CUE
      </button>

      <div className="channel-fader-row">
        <Fader
          accent={accent}
          label=""
          max={1}
          min={0}
          value={values.volume}
          valueFormatter={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => onChannelVolumeChange(deckId, value)}
        />
        <VUMeter analyser={analyser} segments={16} />
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
      <div className="mixer-header">
        <span className="mixer-screw" />
        <h2 className="mixer-title">Mixer</h2>
        <span className="mixer-screw" />
      </div>

      <div className="mixer-body">
        <ChannelStrip
          accent="var(--accent-a)"
          analyser={analyserA}
          deckId="A"
          values={channelA}
          onChannelVolumeChange={onChannelVolumeChange}
          onCueToggle={onCueToggle}
          onEqChange={onEqChange}
          onTrimChange={onTrimChange}
        />

        <div className="master-strip">
          <VUMeter analyser={masterAnalyser} label="Master" segments={20} />
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
          <div className="phones-mix">
            <Knob
              accent="#94a3b8"
              defaultValue={0}
              label="Phones Mix"
              max={1}
              min={0}
              value={cueMix}
              valueFormatter={(value) => `${Math.round(value * 100)}%`}
              onChange={onCueMixChange}
            />
            <div className="phones-mix-scale">
              <span>CUE</span>
              <span>MIX</span>
            </div>
          </div>
        </div>

        <ChannelStrip
          accent="var(--accent-b)"
          analyser={analyserB}
          deckId="B"
          values={channelB}
          onChannelVolumeChange={onChannelVolumeChange}
          onCueToggle={onCueToggle}
          onEqChange={onEqChange}
          onTrimChange={onTrimChange}
        />
      </div>

      <div className="crossfader-well">
        <div className="crossfader-scale">
          <span>A</span>
          <span className="crossfader-notch" />
          <span>B</span>
        </div>
        <Fader
          accent="#e5e7eb"
          centerDetent
          label=""
          max={1}
          min={-1}
          orientation="horizontal"
          step={0.01}
          value={crossfade}
          valueFormatter={(value) => value.toFixed(2)}
          onChange={onCrossfadeChange}
        />
      </div>
    </section>
  )
}
