import type { Deck, HotCue, LoopState } from '../audio/deck'
import type { WaveformData } from '../components/Waveform/waveformData'

export interface DeckState {
  trackName: string
  duration: number
  position: number
  isPlaying: boolean
  pitch: number
  bpm: number
  firstBeatOffset: number
  effectiveBpm: number
  waveform: WaveformData | null
  hotCues: Array<HotCue | null>
  loop: LoopState
}

export const createDeckState = (): DeckState => ({
  trackName: 'No track loaded',
  duration: 0,
  position: 0,
  isPlaying: false,
  pitch: 0,
  bpm: 0,
  firstBeatOffset: 0,
  effectiveBpm: 0,
  waveform: null,
  hotCues: [null, null, null, null],
  loop: { start: null, end: null, active: false }
})

export function getDeckSnapshot(deck: Deck, pitch: number): DeckState {
  return {
    trackName: deck.metadata.name,
    duration: deck.duration,
    position: deck.getPosition(),
    isPlaying: deck.isPlaying,
    pitch,
    bpm: deck.metadata.bpm,
    firstBeatOffset: deck.metadata.firstBeatOffset,
    effectiveBpm: deck.getEffectiveBpm(),
    waveform: deck.waveform,
    hotCues: deck.hotCues,
    loop: deck.loop
  }
}
