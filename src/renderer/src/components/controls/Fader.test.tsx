import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Fader } from './Fader'

describe('Fader', () => {
  it('renders accessible slider state and formatted values', () => {
    render(
      <Fader
        accent="#22d3ee"
        label="Channel volume"
        max={1}
        min={0}
        value={0.5}
        valueFormatter={(value) => `${Math.round(value * 100)}%`}
        onChange={vi.fn()}
      />
    )

    const slider = screen.getByRole('slider', { name: 'Channel volume' })

    expect(slider).toHaveAttribute('aria-valuenow', '0.5')
    expect(slider).toHaveAttribute('aria-valuetext', '50%')
    expect(screen.getByText('Channel volume')).toBeInTheDocument()
  })

  it('steps keyboard changes in vertical orientation', () => {
    const onChange = vi.fn()

    render(<Fader accent="#22d3ee" label="Pitch" max={8} min={-8} step={0.5} value={0} onChange={onChange} />)

    const slider = screen.getByRole('slider', { name: 'Pitch' })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    fireEvent.keyDown(slider, { key: 'ArrowDown' })

    expect(onChange).toHaveBeenNthCalledWith(1, 0.5)
    expect(onChange).toHaveBeenNthCalledWith(2, -0.5)
  })

  it('uses horizontal arrow keys for horizontal faders', () => {
    const onChange = vi.fn()

    render(
      <Fader
        accent="#22d3ee"
        label="Crossfade"
        max={1}
        min={-1}
        orientation="horizontal"
        step={0.25}
        value={0}
        onChange={onChange}
      />
    )

    const slider = screen.getByRole('slider', { name: 'Crossfade' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })

    expect(onChange).toHaveBeenNthCalledWith(1, 0.25)
    expect(onChange).toHaveBeenNthCalledWith(2, -0.25)
  })

  it('removes focus from disabled sliders', () => {
    render(
      <Fader accent="#22d3ee" disabled label="Disabled" max={1} min={0} value={0.5} onChange={vi.fn()} />
    )

    expect(screen.getByRole('slider', { name: 'Disabled' })).toHaveAttribute('tabindex', '-1')
  })

  it('does not emit unchanged stepped values', () => {
    const onChange = vi.fn()

    render(<Fader accent="#22d3ee" label="Pitch" max={8} min={-8} step={0.5} value={8} onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Pitch' }), { key: 'ArrowUp' })

    expect(onChange).not.toHaveBeenCalled()
  })
})
