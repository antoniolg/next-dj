export type EqBand = 'low' | 'mid' | 'high'

export interface TrackMetadata {
  name: string
}

const MIN_EQ_DB = -26
const MAX_EQ_DB = 6
const MIN_PITCH_PERCENT = -8
const MAX_PITCH_PERCENT = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export class Deck {
  readonly output: GainNode

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

  duration = 0
  metadata: TrackMetadata = { name: 'No track loaded' }

  constructor(context: AudioContext) {
    this.context = context
    this.output = context.createGain()
    this.trimGain = context.createGain()
    this.lowFilter = context.createBiquadFilter()
    this.midFilter = context.createBiquadFilter()
    this.highFilter = context.createBiquadFilter()
    this.channelFader = context.createGain()

    this.trimGain.gain.value = 1
    this.channelFader.gain.value = 1
    this.output.gain.value = 1

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
    this.metadata = {
      name: file instanceof File ? file.name : 'Loaded audio'
    }
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

  setPitch(percent: number): void {
    const clamped = clamp(percent, MIN_PITCH_PERCENT, MAX_PITCH_PERCENT)

    if (this.started) {
      this.offsetSeconds = this.getPosition()
      this.startContextTime = this.context.currentTime
    }

    this.playbackRate = 1 + clamped / 100

    if (this.source) {
      this.source.playbackRate.setValueAtTime(this.playbackRate, this.context.currentTime)
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
