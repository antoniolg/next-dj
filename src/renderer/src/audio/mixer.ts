let sharedAudioContext: AudioContext | null = null

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getAudioContext(): AudioContext {
  sharedAudioContext ??= new AudioContext()
  return sharedAudioContext
}

export class Mixer {
  readonly context: AudioContext
  readonly channelAInput: GainNode
  readonly channelBInput: GainNode
  readonly channelAAnalyser: AnalyserNode
  readonly channelBAnalyser: AnalyserNode
  readonly masterAnalyser: AnalyserNode
  readonly masterGain: GainNode

  private readonly channelACrossfadeGain: GainNode
  private readonly channelBCrossfadeGain: GainNode

  constructor(context = getAudioContext()) {
    this.context = context
    this.channelAInput = context.createGain()
    this.channelBInput = context.createGain()
    this.channelAAnalyser = context.createAnalyser()
    this.channelBAnalyser = context.createAnalyser()
    this.masterAnalyser = context.createAnalyser()
    this.masterGain = context.createGain()
    this.channelACrossfadeGain = context.createGain()
    this.channelBCrossfadeGain = context.createGain()

    this.configureAnalyser(this.channelAAnalyser)
    this.configureAnalyser(this.channelBAnalyser)
    this.configureAnalyser(this.masterAnalyser)

    this.masterGain.gain.value = 0.9

    this.channelAInput
      .connect(this.channelAAnalyser)
      .connect(this.channelACrossfadeGain)
      .connect(this.masterGain)

    this.channelBInput
      .connect(this.channelBAnalyser)
      .connect(this.channelBCrossfadeGain)
      .connect(this.masterGain)

    this.masterGain.connect(this.masterAnalyser).connect(context.destination)
    this.setCrossfade(0)
  }

  setCrossfade(x: number): void {
    const clamped = clamp(x, -1, 1)
    const angle = ((clamped + 1) * Math.PI) / 4
    const gainA = Math.cos(angle)
    const gainB = Math.sin(angle)

    this.channelACrossfadeGain.gain.setValueAtTime(gainA, this.context.currentTime)
    this.channelBCrossfadeGain.gain.setValueAtTime(gainB, this.context.currentTime)
  }

  setMasterGain(value: number): void {
    this.masterGain.gain.setValueAtTime(clamp(value, 0, 1), this.context.currentTime)
  }

  private configureAnalyser(analyser: AnalyserNode): void {
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.8
  }
}
