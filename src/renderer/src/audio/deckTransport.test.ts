import { describe, expect, it } from 'vitest'
import {
  START_SCHEDULE_DELAY,
  clampPosition,
  getJogConsumedSeconds,
  getPlaybackPosition,
  getScheduledOffset,
  getScheduledStart
} from './deckTransport'

describe('deck transport helpers', () => {
  it('clamps deck positions inside track duration', () => {
    expect(clampPosition(-1, 60)).toBe(0)
    expect(clampPosition(61, 60)).toBe(60)
    expect(clampPosition(30, 60)).toBe(30)
  })

  it('calculates scheduled source start and offset', () => {
    expect(getScheduledStart(10)).toBe(10 + START_SCHEDULE_DELAY)
    expect(getScheduledOffset(1, 2, 60)).toBe(1 + START_SCHEDULE_DELAY * 2)
    expect(getScheduledOffset(60, 2, 60)).toBe(60)
  })

  it('calculates stopped and playing positions', () => {
    expect(getPlaybackPosition(false, 10, 50, 0, 1, 60)).toBe(10)
    expect(getPlaybackPosition(true, 10, 12, 10, 1.5, 60)).toBe(13)
    expect(getPlaybackPosition(true, 58, 12, 10, 2, 60)).toBe(60)
  })

  it('calculates consumed jog bend seconds', () => {
    expect(getJogConsumedSeconds(1.2, 1, 10.5, 10)).toBeCloseTo(0.1)
  })
})
