import { computeWaveformData, type WaveformData } from '../components/Waveform/waveformData'
import { measureAsync, measureSync } from '../performance/perfMarks'
import { detectBpm } from './bpm'
import { clearHotCueState, triggerHotCueState } from './deckHotCues'
import {
  createAutoLoopState,
  createEmptyLoop,
  createLoopInState,
  createLoopOutState,
  deactivateLoop
} from './deckLoops'
import {
  loadCuePoint,
  loadHotCues,
  saveCuePoint,
  saveHotCues
} from './deckPersistence'
import {
  calculateJogPlaybackRate,
  clampEqDb,
  clampPitchPercent,
  clampPositiveValue,
  clampUnitValue,
  pitchPercentToRate
} from './deckMath'
import {
  getJogConsumedSeconds,
  getLoopedPosition,
  getPlaybackPosition,
  clampPosition as clampDeckPosition
} from './deckTransport'
import { EMPTY_HOT_CUES, type HotCue, type LoopState, type TrackMetadata } from './deckTypes'
import { configureDeckSourceLoop, startDeckSource } from './deckSource'

export type EqBand = 'low' | 'mid' | 'high'
export interface DeckLoadAnalysis {
  bpm: number
  firstBeatOffset: number
}

const JOG_TICK_MS = 40

export { MAX_PITCH_PERCENT, MIN_PITCH_PERCENT } from './deckMath'

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
  private jogPendingSeconds = 0
  private jogIntervalId: number | null = null
  private jogLastFoldTime = 0
  private transportIntent = 0

  duration = 0
  metadata: TrackMetadata = { name: 'No track loaded', bpm: 0, firstBeatOffset: 0 }
  waveform: WaveformData | null = null
  hotCues: Array<HotCue | null> = [...EMPTY_HOT_CUES]
  loop: LoopState = createEmptyLoop()
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

  async loadFile(file: File | ArrayBuffer, analysis?: DeckLoadAnalysis): Promise<void> {
    const arrayBuffer =
      file instanceof File ? await measureAsync('deck.loadFile.readFile', () => file.arrayBuffer()) : file
    const decoded = await measureAsync('deck.loadFile.decodeAudioData', () =>
      this.context.decodeAudioData(arrayBuffer.slice(0))
    )

    this.stop()
    this.buffer = decoded
    this.duration = decoded.duration
    this.waveform = measureSync('deck.loadFile.computeWaveform', () => computeWaveformData(decoded))
    const { bpm, firstBeatOffset } =
      analysis && analysis.bpm > 0 && Number.isFinite(analysis.bpm) && Number.isFinite(analysis.firstBeatOffset)
        ? analysis
        : await measureAsync('deck.loadFile.detectBpm', () => detectBpm(decoded))
    this.metadata = {
      name: file instanceof File ? file.name : 'Loaded audio',
      bpm,
      firstBeatOffset
    }
    this.hotCues = loadHotCues(this.metadata.name, (seconds) => this.clampPosition(seconds))
    this.cuePoint = loadCuePoint(this.metadata.name, (seconds) => this.clampPosition(seconds))
    this.loop = createEmptyLoop()
  }

  async play(): Promise<void> {
    const intent = ++this.transportIntent

    if (!this.buffer || this.started) {
      return
    }

    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    if (intent !== this.transportIntent || !this.buffer || this.started) {
      return
    }

    this.startSourceAt(this.offsetSeconds)
  }

  pause(): void {
    this.transportIntent += 1

    if (!this.started) {
      return
    }

    this.offsetSeconds = this.getPosition()
    this.stopSource(true)
  }

  stop(): void {
    this.transportIntent += 1
    this.stopSource(true)
    this.offsetSeconds = 0
    this.startContextTime = 0
  }

  seek(seconds: number): void {
    this.transportIntent += 1
    const nextOffset = getLoopedPosition(this.clampPosition(seconds), this.loop)
    const shouldRestart = this.started

    this.stopSource(true)
    this.offsetSeconds = nextOffset

    if (shouldRestart) {
      this.startSourceAt(nextOffset)
    }
  }

  setPitch(percent: number): number {
    const clamped = clampPitchPercent(percent)

    if (this.started) {
      this.offsetSeconds = this.getPosition()
      this.startContextTime = this.context.currentTime
    }

    this.playbackRate = pitchPercentToRate(clamped)
    this.basePlaybackRate = this.playbackRate

    if (this.source) {
      this.source.playbackRate.setValueAtTime(this.playbackRate, this.context.currentTime)
    }

    return clamped
  }

  nudge(seconds: number): void {
    this.seek(this.getPosition() + seconds)
  }

  jogShift(seconds: number): void {
    if (!this.started) {
      this.nudge(seconds)
      return
    }

    this.jogPendingSeconds += seconds
    this.applyJogRate()

    if (this.jogIntervalId === null) {
      this.jogIntervalId = window.setInterval(() => this.jogTick(), JOG_TICK_MS)
    }
  }

  setCuePoint(seconds: number = this.getPosition()): void {
    this.cuePoint = this.clampPosition(seconds)
    saveCuePoint(this.metadata.name, this.cuePoint)
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
    const result = triggerHotCueState(this.hotCues, index, this.getPosition(), this.duration)

    if (result.seekPosition !== null) {
      this.seek(result.seekPosition)
      return
    }

    this.hotCues = result.hotCues

    if (result.shouldSave) {
      saveHotCues(this.metadata.name, this.hotCues)
    }
  }

  clearHotCue(index: number): void {
    this.hotCues = clearHotCueState(this.hotCues, index)
    saveHotCues(this.metadata.name, this.hotCues)
  }

  setLoopIn(): void {
    this.loop = createLoopInState(this.loop, this.getPosition())
    this.applySourceLoop()
  }

  setLoopOut(): void {
    this.loop = createLoopOutState(this.loop, this.getPosition())
    this.applySourceLoop()
  }

  setAutoLoop(beats: number): void {
    const start = this.getPosition()
    const loop = createAutoLoopState(this.metadata.bpm, beats, this.duration, start, (seconds) =>
      this.clampPosition(seconds)
    )

    if (loop) {
      this.loop = loop
      this.applySourceLoop()
    }
  }

  exitLoop(): void {
    if (this.started) {
      this.offsetSeconds = this.getPosition()
      this.startContextTime = this.context.currentTime
    }

    this.loop = deactivateLoop(this.loop)
    this.applySourceLoop()
  }

  setEq(band: EqBand, dB: number): void {
    const gain = clampEqDb(dB)
    const filter = this.getEqFilter(band)
    filter.gain.setValueAtTime(gain, this.context.currentTime)
  }

  setTrim(value: number): void {
    this.trimGain.gain.setValueAtTime(clampPositiveValue(value), this.context.currentTime)
  }

  setChannelFader(value: number): void {
    this.channelFader.gain.setValueAtTime(clampUnitValue(value), this.context.currentTime)
  }

  getPosition(): number {
    if (!this.started) {
      return this.clampPosition(this.offsetSeconds)
    }

    return getLoopedPosition(
      getPlaybackPosition(
        this.started,
        this.offsetSeconds,
        this.context.currentTime,
        this.startContextTime,
        this.playbackRate,
        this.duration
      ),
      this.loop
    )
  }

  private startSourceAt(offsetSeconds: number): void {
    if (!this.buffer) {
      return
    }

    const { source, offsetSeconds: scheduledOffset, startContextTime } = startDeckSource({
      buffer: this.buffer,
      context: this.context,
      destination: this.trimGain,
      duration: this.duration,
      offsetSeconds,
      playbackRate: this.playbackRate,
      loop: this.loop,
      onEnded: () => {
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
    })

    this.source = source
    this.started = true
    this.offsetSeconds = scheduledOffset
    this.startContextTime = startContextTime
    this.suppressEnded = false
  }

  private applySourceLoop(): void {
    if (this.source) {
      configureDeckSourceLoop(this.source, this.loop)
    }
  }

  // Fold elapsed time at the current rate into the offset, then bend the
  // rate so the pending jog shift is consumed within JOG_CHASE_SECONDS.
  private applyJogRate(): void {
    this.offsetSeconds = this.getPosition()
    this.startContextTime = this.context.currentTime
    this.jogLastFoldTime = this.context.currentTime

    this.playbackRate = calculateJogPlaybackRate(this.basePlaybackRate, this.jogPendingSeconds)
    this.source?.playbackRate.setValueAtTime(this.playbackRate, this.context.currentTime)
  }

  private jogTick(): void {
    const consumed = getJogConsumedSeconds(
      this.playbackRate,
      this.basePlaybackRate,
      this.context.currentTime,
      this.jogLastFoldTime
    )
    this.jogPendingSeconds -= consumed

    if (!this.started || Math.abs(this.jogPendingSeconds) < 0.0005) {
      this.endJog()
      return
    }

    this.applyJogRate()
  }

  private endJog(): void {
    if (this.jogIntervalId !== null) {
      window.clearInterval(this.jogIntervalId)
      this.jogIntervalId = null
    }

    this.jogPendingSeconds = 0

    if (this.started) {
      this.offsetSeconds = this.getPosition()
      this.startContextTime = this.context.currentTime
    }

    this.playbackRate = this.basePlaybackRate
    this.source?.playbackRate.setValueAtTime(this.basePlaybackRate, this.context.currentTime)
  }

  private stopSource(suppressEnded: boolean): void {
    if (this.jogIntervalId !== null) {
      window.clearInterval(this.jogIntervalId)
      this.jogIntervalId = null
      this.jogPendingSeconds = 0
      this.playbackRate = this.basePlaybackRate
    }

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
    return clampDeckPosition(seconds, this.duration)
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
