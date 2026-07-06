import { useCallback, useRef, useState } from 'react'

interface JogWheelProps {
  position: number
  duration: number
  isPlaying: boolean
  accent: string
  label: string
  onSeek: (seconds: number) => void
}

function pointerAngle(event: React.PointerEvent<HTMLButtonElement>): number {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - rect.left - rect.width / 2
  const y = event.clientY - rect.top - rect.height / 2
  return Math.atan2(y, x) * (180 / Math.PI)
}

function angleDelta(previous: number, next: number): number {
  let delta = next - previous

  if (delta > 180) {
    delta -= 360
  } else if (delta < -180) {
    delta += 360
  }

  return delta
}

export function JogWheel({
  position,
  duration,
  isPlaying,
  accent,
  label,
  onSeek
}: JogWheelProps): JSX.Element {
  const dragRef = useRef<{ angle: number; position: number } | null>(null)
  const [dragRotation, setDragRotation] = useState(0)
  const rotation = dragRef.current ? dragRotation : position * 150

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = { angle: pointerAngle(event), position }
      setDragRotation(position * 150)
    },
    [position]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>): void => {
      if (!dragRef.current || duration <= 0) {
        return
      }

      const nextAngle = pointerAngle(event)
      const delta = angleDelta(dragRef.current.angle, nextAngle)
      const nextPosition = Math.min(duration, Math.max(0, dragRef.current.position + (delta / 360) * 4))

      dragRef.current = { angle: nextAngle, position: nextPosition }
      setDragRotation((current: number) => current + delta)
      onSeek(nextPosition)
    },
    [duration, onSeek]
  )

  const clearDrag = useCallback((): void => {
    dragRef.current = null
  }, [])

  return (
    <button
      aria-label={label}
      className={`jog-wheel ${isPlaying && !dragRef.current ? 'jog-wheel-playing' : ''}`}
      style={{ '--jog-accent': accent } as React.CSSProperties}
      type="button"
      onPointerCancel={clearDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearDrag}
    >
      <span className="jog-platter" style={{ transform: `rotate(${rotation}deg)` }}>
        <span className="jog-marker" />
      </span>
      <span className="jog-cap">
        <span className="jog-label">NEXTDJ</span>
      </span>
    </button>
  )
}
