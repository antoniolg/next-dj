import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Knob } from './Knob'

describe('Knob', () => {
  it('renders accessible value text and label', () => {
    render(
      <Knob
        accent="#22d3ee"
        defaultValue={0}
        label="High EQ"
        max={6}
        min={-26}
        value={3}
        valueFormatter={(value) => `${value} dB`}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'High EQ 3 dB' })).toBeInTheDocument()
    expect(screen.getByText('High EQ')).toBeInTheDocument()
  })

  it('resets to the default value on double click', () => {
    const onChange = vi.fn()

    render(
      <Knob
        accent="#22d3ee"
        defaultValue={0}
        label="Trim"
        max={2}
        min={0}
        step={0.1}
        value={1.4}
        onChange={onChange}
      />
    )

    fireEvent.doubleClick(screen.getByRole('button', { name: /Trim/ }))

    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('shows the formatted value while hovered', () => {
    render(
      <Knob
        accent="#22d3ee"
        defaultValue={0}
        label="Mid EQ"
        max={6}
        min={-26}
        value={-2}
        valueFormatter={(value) => `${value} dB`}
        onChange={vi.fn()}
      />
    )

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Mid EQ -2 dB' }))

    expect(screen.getByText('-2 dB')).toBeInTheDocument()
  })
})
