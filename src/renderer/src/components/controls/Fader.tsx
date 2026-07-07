import { useCallback, useRef } from 'react'

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
  disabled?: boolean
  hideLabel?: boolean
  showFill?: boolean
  valueFormatter?: (value: number) => string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
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
  disabled = false,
  hideLabel = false,
  showFill = false,
  valueFormatter = (nextValue) => nextValue.toFixed(2)
}: FaderProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const isVertical = orientation === 'vertical'
  const range = max - min
  const percentage = clamp((value - min) / range, 0, 1)

  const commitValue = useCallback(
    (nextValue: number): void => {
      let stepped = Math.round(nextValue / step) * step

      if (centerDetent && Math.abs(stepped - (min + max) / 2) < range * 0.02) {
        stepped = (min + max) / 2
      }

      onChange(Number(clamp(stepped, min, max).toFixed(4)))
    },
    [centerDetent, max, min, onChange, range, step]
  )

  const valueFromPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): number => {
      const track = trackRef.current

      if (!track) {
        return value
      }

      const rect = track.getBoundingClientRect()
      const ratio = isVertical
        ? 1 - (event.clientY - rect.top) / rect.height
        : (event.clientX - rect.left) / rect.width

      return min + clamp(ratio, 0, 1) * range
    },
    [isVertical, min, range, value]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (disabled) {
        return
      }

      event.currentTarget.setPointerCapture(event.pointerId)
      draggingRef.current = true
      commitValue(valueFromPointer(event))
    },
    [commitValue, disabled, valueFromPointer]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (draggingRef.current) {
        commitValue(valueFromPointer(event))
      }
    },
    [commitValue, valueFromPointer]
  )

  const clearDrag = useCallback((): void => {
    draggingRef.current = false
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const increase = isVertical ? event.key === 'ArrowUp' : event.key === 'ArrowRight'
      const decrease = isVertical ? event.key === 'ArrowDown' : event.key === 'ArrowLeft'

      if (increase || decrease) {
        event.preventDefault()
        onChange(Number(clamp(value + (increase ? step : -step), min, max).toFixed(4)))
      }
    },
    [isVertical, max, min, onChange, step, value]
  )

  const trackStyle = { '--fader-accent': accent }

  const thumbStyle = isVertical
    ? { bottom: `${percentage * 100}%` }
    : { left: `${percentage * 100}%` }

  return (
    <div className={`fader ${isVertical ? 'fader-vertical' : 'fader-horizontal'} ${disabled ? 'fader-disabled' : ''}`}>
      <div
        ref={trackRef}
        aria-label={label}
        aria-orientation={orientation}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        aria-valuetext={valueFormatter(value)}
        className="fader-track"
        role="slider"
        style={trackStyle as React.CSSProperties}
        tabIndex={disabled ? -1 : 0}
        title={`${label}: ${valueFormatter(value)}`}
        onKeyDown={handleKeyDown}
        onPointerCancel={clearDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearDrag}
      >
        {centerDetent ? <span className="fader-detent" /> : null}
        {showFill ? (
          <span
            className="fader-fill"
            style={isVertical ? { height: `${percentage * 100}%` } : { width: `${percentage * 100}%` }}
          />
        ) : null}
        <span className="fader-thumb" style={thumbStyle} />
      </div>
      {label && !hideLabel ? <span className="fader-label">{label}</span> : null}
    </div>
  )
}
