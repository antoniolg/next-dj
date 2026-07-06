import { useCallback } from 'react'

interface FaderProps {
  value: number
  min: number
  max: number
  label: string
  accent: string
  onChange: (value: number) => void
  orientation?: 'vertical' | 'horizontal'
  step?: number
  centerDetent?: boolean
  valueFormatter?: (value: number) => string
}

export function Fader({
  value,
  min,
  max,
  label,
  accent,
  onChange,
  orientation = 'vertical',
  step = 0.01,
  centerDetent = false,
  valueFormatter = (nextValue) => nextValue.toFixed(2)
}: FaderProps): JSX.Element {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onChange(Number(event.currentTarget.value))
    },
    [onChange]
  )

  const isVertical = orientation === 'vertical'

  return (
    <label className={`fader ${isVertical ? 'fader-vertical' : 'fader-horizontal'}`}>
      <span className="text-[0.65rem] font-bold uppercase text-slate-300">{label}</span>
      <span className="relative flex items-center justify-center">
        <input
          aria-label={label}
          className="fader-input"
          max={max}
          min={min}
          step={step}
          style={{ '--fader-accent': accent } as React.CSSProperties}
          type="range"
          value={value}
          onChange={handleChange}
        />
        {centerDetent ? <span className="fader-detent" /> : null}
      </span>
      <span className="font-mono text-[0.65rem] text-slate-500">{valueFormatter(value)}</span>
    </label>
  )
}
