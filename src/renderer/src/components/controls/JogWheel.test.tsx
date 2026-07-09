import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JogWheel } from './JogWheel'
import { getJogAngleDelta, getJogProgressDegrees, getJogSeekPosition } from './jogWheelMath'

describe('JogWheel helpers', () => {
  it('wraps angle deltas across the 180 degree boundary', () => {
    expect(getJogAngleDelta(170, -170)).toBe(20)
    expect(getJogAngleDelta(-170, 170)).toBe(-20)
    expect(getJogAngleDelta(10, 30)).toBe(20)
  })

  it('calculates stopped-deck seek positions from jog deltas', () => {
    expect(getJogSeekPosition(10, 90, 60)).toBe(11)
    expect(getJogSeekPosition(0, -90, 60)).toBe(0)
    expect(getJogSeekPosition(59, 360, 60)).toBe(60)
  })

  it('calculates clamped progress degrees', () => {
    expect(getJogProgressDegrees(30, 60)).toBe(180)
    expect(getJogProgressDegrees(90, 60)).toBe(360)
    expect(getJogProgressDegrees(10, 0)).toBe(0)
  })
})

describe('JogWheel', () => {
  it('renders an accessible jog control with progress styling', () => {
    render(
      <JogWheel
        accent="#22d3ee"
        duration={60}
        isPlaying={false}
        label="Deck A jog"
        position={30}
        onBend={vi.fn()}
        onSeek={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Deck A jog' })).toHaveStyle({
      '--jog-progress': '180deg'
    })
  })
})
