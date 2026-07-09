import { clamp } from './deckMath'

export const START_SCHEDULE_DELAY = 0.01

export function clampPosition(seconds: number, duration: number): number {
  return clamp(seconds, 0, duration)
}

export function getScheduledStart(currentTime: number): number {
  return currentTime + START_SCHEDULE_DELAY
}

export function getScheduledOffset(offsetSeconds: number, playbackRate: number, duration: number): number {
  return clampPosition(offsetSeconds + START_SCHEDULE_DELAY * playbackRate, duration)
}

export function getPlaybackPosition(
  started: boolean,
  offsetSeconds: number,
  currentTime: number,
  startContextTime: number,
  playbackRate: number,
  duration: number
): number {
  if (!started) {
    return clampPosition(offsetSeconds, duration)
  }

  const elapsed = Math.max(0, currentTime - startContextTime) * playbackRate
  return clampPosition(offsetSeconds + elapsed, duration)
}

export function getJogConsumedSeconds(playbackRate: number, basePlaybackRate: number, currentTime: number, lastFoldTime: number): number {
  return (playbackRate - basePlaybackRate) * (currentTime - lastFoldTime)
}
