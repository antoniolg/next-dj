import { computeWaveformData, type WaveformData } from '../components/Waveform/waveformData'
import { detectBpm } from './bpm'

export type EqBand = 'low' | 'mid' | 'high'

export interface TrackMetadata {
  name: string
  bpm: number
  firstBeatOffset: number
}

export interface HotCue {
  position: number
  color: string
}

export interface LoopState {
  start: number | null
  end: number | null
  active: boolean
}

export const HOT_CUE_COLORS = ['#22d3ee', '#f97316', '#a78bfa', '#22c55e'] as const
export const MIN_PITCH_PERCENT = -8
export const MAX_PITCH_PERCENT = 8

const MIN_EQ_DB = -26
const MAX_EQ_DB = 6
const HOT_CUE_STORAGE_KEY = 'nextdj.hotCues'
const CUE_POINT_STORAGE_KEY = 'nextdj.cuePoints'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export class Deck {
  readonly output: GainNode
  readonly cueOutput: GainNode

  onEnded: (() => void) | null = null

  private readonly context: AudioContext
  private readonly trimGain: GainNode
  private readonly lowFilter: BiquadFilterNode
  private readonly midFilter: BiquadFilterNode
  private readonly highFilter: BiquadFilterNode
  private readonly channelFader: GainNode

  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private started = false
  private suppressEnded = false
  private startContextTime = 0
  private offsetSeconds = 0
  private playbackRate = 1
  private basePlaybackRate = 1
  private cuePreviewing = false
  private pitchBendTimeout: number | null = null

  duration = 0
  metadata: TrackMetadata = { name: 'No track loaded', bpm: 0, firstBeatOffset: 0 }
  waveform: WaveformData | null = null
  hotCues: Array<HotCue | null> = [null, null, null, null]
  loop: LoopState = { start: null, end: null, active: false }
  cuePoint = 0

  constructor(context: AudioContext) {
    this.context = context
    this.output = context.createGain()
    this.cueOutput = context.createGain()
    this.trimGain = context.createGain()
    this.lowFilter = context.createBiquadFilter()
    this.midFilter = context.createBiquadFilter()
    this.highFilter = context.createBiquadFilter()
    this.channelFader = context.createGain()

    this.trimGain.gain.value = 1
    this.channelFader.gain.value = 1
    this.output.gain.value = 1
    this.cueOutput.gain.value = 1

    this.lowFilter.type = 'lowshelf'
    this.lowFilter.frequency.value = 320

    this.midFilter.type = 'peaking'
    this.midFilter.frequency.value = 1000
    this.midFilter.Q.value = 1

    this.highFilter.type = 'highshelf'
    this.highFilter.frequency.value = 3200

    this.trimGain
      .connect(this.lowFilter)
      .connect(this.midFilter)
      .connect(this.highFilter)
      .connect(this.channelFader)
      .connect(this.output)

    this.highFilter.connect(this.cueOutput)
  }

  get isPlaying(): boolean {
    return this.started
  }

  async loadFile(file: File | ArrayBuffer): Promise<void> {
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file
    const decoded = await this.context.decodeAudioData(arrayBuffer.slice(0))

    this.stop()
    this.buffer = decoded
    this.duration = decoded.duration
    this.waveform = computeWaveformData(decoded)
    const { bpm, firstBeatOffset } = await detectBpm(decoded)
    this.metadata = {
      name: file instanceof File ? file.name : 'Loaded audio',
      bpm,
      firstBeatOffset
    }
    this.hotCues = this.loadHotCues(this.metadata.name)
    this.cuePoint = this.loadCuePoint(this.metadata.name)
    this.loop = { start: null, end: null, active: false }
  }

  async play(): Promise<void> {
    if (!this.buffer || this.started) {
      return
    }

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    this.startSourceAt(this.offsetSeconds)
  }

  pause(): void {
    if (!this.started) {
      return
    }

    this.offsetSeconds = this.getPosition()
    this.stopSource(true)
  }

  stop(): void {
    this.stopSource(true)
    this.offsetSeconds = 0
    this.startContextTime = 0
  }

  seek(seconds: number): void {
    const nextOffset = this.clampPosition(seconds)
    const shouldRestart = this.started

    this.stopSource(true)
    this.offsetSeconds = nextOffset

    if (shouldRestart) {
      this.startSourceAt(nextOffset)
    }
  }

  setPitch(percent: number): number {
    const clamped = clamp(percent, MIN_PITCH_PERCENT, MAX_PITCH_PERCENT)

    if (this.started) {
      this.offsetSeconds = this.getPosition()
      this.startContextTime = this.context.currentTime
    }

    this.playbackRate = 1 + clamped / 100
    this.basePlaybackRate = this.playbackRate

    if (this.source) {
      this.source.playbackRate.setValueAtTime(this.playbackRate, this.context.currentTime)
    }

    return clamped
  }

  nudge(seconds: number): void {
    this.seek(this.getPosition() + seconds)
  }

  pitchBend(percent: number, durationMs: number): void {
    if (!this.source || durationMs <= 0) {
      return
    }

    if (this.pitchBendTimeout !== null) {
      window.clearTimeout(this.pitchBendTimeout)
      this.pitchBendTimeout = null
    }

    const bentRate = this.basePlaybackRate * (1 + percent / 100)
    this.playbackRate = bentRate
    this.source.playbackRate.setValueAtTime(bentRate, this.context.currentTime)

    this.pitchBendTimeout = window.setTimeout(() => {
      this.offsetSeconds = this.getPosition()
      this.startContextTime = this.context.currentTime
      this.playbackRate = this.basePlaybackRate
      this.source?.playbackRate.setValueAtTime(this.basePlaybackRate, this.context.currentTime)
      this.pitchBendTimeout = null
    }, durationMs)
  }

  setCuePoint(seconds: number = this.getPosition()): void {
    this.cuePoint = this.clampPosition(seconds)
    this.saveCuePoint()
  }

  async cuePress(): Promise<void> {
    if (this.duration <= 0) {
      return
    }

    if (this.started) {
      this.pause()
      this.seek(this.cuePoint)
      return
    }

    const position = this.getPosition()

    if (Math.abs(position - this.cuePoint) > 0.08) {
      this.setCuePoint(position)
      this.seek(this.cuePoint)
      return
    }

    this.cuePreviewing = true
    await this.play()
  }

  cueRelease(): void {
    if (!this.cuePreviewing) {
      return
    }

    this.cuePreviewing = false
    this.pause()
    this.seek(this.cuePoint)
  }

  getEffectiveBpm(): number {
    return this.metadata.bpm > 0 ? this.metadata.bpm * this.playbackRate : 0
  }

  triggerHotCue(index: number): void {
    if (!this.isValidHotCueIndex(index) || this.duration <= 0) {
      return
    }

    const existing = this.hotCues[index]

    if (existing) {
      this.seek(existing.position)
      return
    }

    this.hotCues = this.hotCues.map((cue, cueIndex) =>
      cueIndex === index ? { position: this.getPosition(), color: HOT_CUE_COLORS[index] } : cue
    )
    this.saveHotCues()
  }

  clearHotCue(index: number): void {
    if (!this.isValidHotCueIndex(index)) {
      return
    }

    this.hotCues = this.hotCues.map((cue, cueIndex) => (cueIndex === index ? null : cue))
    this.saveHotCues()
  }

  setLoopIn(): void {
    const position = this.getPosition()
    const end = this.loop.end !== null && this.loop.end > position ? this.loop.end : null

    this.loop = {
      start: position,
      end,
      active: end !== null
    }
  }

  setLoopOut(): void {
    const position = this.getPosition()
    const start = this.loop.start !== null && this.loop.start < position ? this.loop.start : null

    this.loop = {
      start: start ?? this.loop.start,
      end: position,
      active: start !== null
    }
  }

  setAutoLoop(beats: number): void {
    if (this.metadata.bpm <= 0 || beats <= 0 || this.duration <= 0) {
      return
    }

    const start = this.getPosition()
    const seconds = (60 / this.metadata.bpm) * beats
    const end = this.clampPosition(start + seconds)

    if (end > start) {
      this.loop = { start, end, active: true }
    }
  }

  exitLoop(): void {
    this.loop = { ...this.loop, active: false }
  }

  tickLoop(): void {
    if (!this.loop.active || this.loop.start === null || this.loop.end === null || this.loop.end <= this.loop.start) {
      return
    }

    const position = this.getPosition()

    if (position >= this.loop.end) {
      this.seek(this.loop.start)
    }
  }

  setEq(band: EqBand, dB: number): void {
    const gain = clamp(dB, MIN_EQ_DB, MAX_EQ_DB)
    const filter = this.getEqFilter(band)
    filter.gain.setValueAtTime(gain, this.context.currentTime)
  }

  setTrim(value: number): void {
    this.trimGain.gain.setValueAtTime(Math.max(0, value), this.context.currentTime)
  }

  setChannelFader(value: number): void {
    this.channelFader.gain.setValueAtTime(clamp(value, 0, 1), this.context.currentTime)
  }

  getPosition(): number {
    if (!this.started) {
      return this.clampPosition(this.offsetSeconds)
    }

    const elapsed = (this.context.currentTime - this.startContextTime) * this.playbackRate
    return this.clampPosition(this.offsetSeconds + elapsed)
  }

  private startSourceAt(offsetSeconds: number): void {
    if (!this.buffer) {
      return
    }

    const source = this.context.createBufferSource()
    const offset = this.clampPosition(offsetSeconds)

    source.buffer = this.buffer
    source.playbackRate.value = this.playbackRate
    source.connect(this.trimGain)
    source.onended = (): void => {
      if (this.suppressEnded) {
        this.suppressEnded = false
        return
      }

      this.started = false
      this.source = null
      this.offsetSeconds = this.duration
      this.startContextTime = 0
      this.onEnded?.()
    }

    this.source = source
    this.started = true
    this.offsetSeconds = offset
    this.startContextTime = this.context.currentTime
    this.suppressEnded = false
    source.start(0, offset)
  }

  private stopSource(suppressEnded: boolean): void {
    if (!this.source) {
      this.started = false
      return
    }

    this.suppressEnded = suppressEnded
    this.source.onended = null
    this.source.stop()
    this.source.disconnect()
    this.source = null
    this.started = false
  }

  private clampPosition(seconds: number): number {
    return clamp(seconds, 0, this.duration)
  }

  private isValidHotCueIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.hotCues.length
  }

  private loadHotCues(trackName: string): Array<HotCue | null> {
    try {
      const parsed = JSON.parse(localStorage.getItem(HOT_CUE_STORAGE_KEY) ?? '{}') as Record<
        string,
        Array<HotCue | null>
      >
      const stored = parsed[trackName]

      if (!Array.isArray(stored)) {
        return [null, null, null, null]
      }

      return HOT_CUE_COLORS.map((color, index) => {
        const cue = stored[index]

        if (!cue || typeof cue.position !== 'number') {
          return null
        }

        return {
          position: this.clampPosition(cue.position),
          color: typeof cue.color === 'string' ? cue.color : color
        }
      })
    } catch {
      return [null, null, null, null]
    }
  }

  private saveHotCues(): void {
    try {
      const parsed = JSON.parse(localStorage.getItem(HOT_CUE_STORAGE_KEY) ?? '{}') as Record<
        string,
        Array<HotCue | null>
      >

      parsed[this.metadata.name] = this.hotCues
      localStorage.setItem(HOT_CUE_STORAGE_KEY, JSON.stringify(parsed))
    } catch {
      localStorage.setItem(HOT_CUE_STORAGE_KEY, JSON.stringify({ [this.metadata.name]: this.hotCues }))
    }
  }

  private loadCuePoint(trackName: string): number {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUE_POINT_STORAGE_KEY) ?? '{}') as Record<string, number>
      const cuePoint = parsed[trackName]

      return typeof cuePoint === 'number' ? this.clampPosition(cuePoint) : 0
    } catch {
      return 0
    }
  }

  private saveCuePoint(): void {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUE_POINT_STORAGE_KEY) ?? '{}') as Record<string, number>
      parsed[this.metadata.name] = this.cuePoint
      localStorage.setItem(CUE_POINT_STORAGE_KEY, JSON.stringify(parsed))
    } catch {
      localStorage.setItem(CUE_POINT_STORAGE_KEY, JSON.stringify({ [this.metadata.name]: this.cuePoint }))
    }
  }

  private getEqFilter(band: EqBand): BiquadFilterNode {
    if (band === 'low') {
      return this.lowFilter
    }

    if (band === 'mid') {
      return this.midFilter
    }

    return this.highFilter
  }
}
