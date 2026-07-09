import { getScheduledOffset, getScheduledStart } from './deckTransport'

interface StartDeckSourceOptions {
  buffer: AudioBuffer
  context: AudioContext
  destination: AudioNode
  duration: number
  offsetSeconds: number
  onEnded: () => void
  playbackRate: number
}

interface StartedDeckSource {
  offsetSeconds: number
  source: AudioBufferSourceNode
  startContextTime: number
}

export function startDeckSource({
  buffer,
  context,
  destination,
  duration,
  offsetSeconds,
  onEnded,
  playbackRate
}: StartDeckSourceOptions): StartedDeckSource {
  const source = context.createBufferSource()
  const startContextTime = getScheduledStart(context.currentTime)
  const scheduledOffset = getScheduledOffset(offsetSeconds, playbackRate, duration)

  source.buffer = buffer
  source.playbackRate.value = playbackRate
  source.connect(destination)
  source.onended = onEnded
  source.start(startContextTime, scheduledOffset)

  return {
    offsetSeconds: scheduledOffset,
    source,
    startContextTime
  }
}
