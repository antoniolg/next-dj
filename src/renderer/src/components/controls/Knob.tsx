import { useCallback, useMemo, useRef } from 'react'

interface KnobProps {
  value: number
  min: number
  max: number
  defaultValue: number
  label: string
  accent: string
  onChange: (value: number) => void
  step?: number
  valueFormatter?: (value: number) => string
}

const SWEEP_DEGREES = 270
const START_DEGREES = -135

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function Knob({
  value,
  min,
  max,
  defaultValue,
  label,
  accent,
  onChange,
  step = 0.01,
  valueFormatter = (nextValue) => nextValue.toFixed(1)
}: KnobProps): JSX.Element {
  const dragRef = useRef<{ y: number; value: number } | null>(null)
  const percentage = (value - min) / (max - min)
  const angle = START_DEGREES + percentage * SWEEP_DEGREES
  const ringStyle = useMemo(
    () => ({
      background: `conic-gradient(from 225deg, ${accent} ${percentage * 75}%, #1d2633 0 75%, transparent 0)`
    }),
    [accent, percentage]
  )

  const commitValue = useCallback(
    (nextValue: number): void => {
      const stepped = Math.round(nextValue / step) * step
      onChange(Number(clamp(stepped, min, max).toFixed(4)))
    },
    [max, min, onChange, step]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = { y: event.clientY, value }
    },
    [value]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      if (!dragRef.current) {
        return
      }

      const delta = dragRef.current.y - event.clientY
      const range = max - min
      commitValue(dragRef.current.value + (delta / 160) * range)
    },
    [commitValue, max, min]
  )

  const clearDrag = useCallback((): void => {
    dragRef.current = null
  }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        aria-label={`${label} ${valueFormatter(value)}`}
        className="knob-shell group relative grid h-16 w-16 place-items-center rounded-full focus:outline-none focus:ring-2 focus:ring-white/30"
        style={ringStyle}
        type="button"
        onDoubleClick={() => commitValue(defaultValue)}
        onPointerCancel={clearDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearDrag}
      >
        <span className="knob-face relative block h-12 w-12 rounded-full">
          <span
            className="absolute left-1/2 top-1/2 h-5 w-1 -translate-x-1/2 origin-bottom rounded-full"
            style={{ backgroundColor: accent, transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
          />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950 shadow-inner" />
        </span>
      </button>
      <div className="text-center">
        <p className="text-[0.65rem] font-bold uppercase text-slate-300">{label}</p>
        <p className="font-mono text-[0.65rem] text-slate-500">{valueFormatter(value)}</p>
      </div>
    </div>
  )
}
