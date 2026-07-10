import type { EqBand } from '../audio/deck'
import type { OutputDeviceInfo } from '../audio/output'

export type DeckId = 'A' | 'B'

export interface ChannelState {
  trim: number
  eq: Record<EqBand, number>
  volume: number
  cue: boolean
}

export interface MixerState {
  crossfade: number
  cueMix: number
  masterVolume: number
}

export interface OutputState {
  devices: OutputDeviceInfo[]
  masterDeviceId: string
  cueDeviceId: string
  error: string | null
}
