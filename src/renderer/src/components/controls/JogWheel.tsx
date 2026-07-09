import { useCallback, useRef, useState } from 'react'
import { NextDjMark } from './NextDjMark'
import { getJogAngleDelta, getJogProgressDegrees, getJogSeekPosition } from './jogWheelMath'

interface JogWheelProps {
  position: number
  duration: number
  isPlaying: boolean
  accent: string
  label: string
  onBend: (degrees: number) => void
  onSeek: (seconds: number) => void
}

function pointerAngle(event: React.PointerEvent<HTMLButtonElement>): number {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - rect.left - rect.width / 2
  const y = event.clientY - rect.top - rect.height / 2
  return Math.atan2(y, x) * (180 / Math.PI)
}

export function JogWheel({
  position,
  duration,
  isPlaying,
  accent,
  label,
  onBend,
  onSeek
}: JogWheelProps): JSX.Element {
  const dragRef = useRef<{ angle: number; position: number } | null>(null)
  const [dragRotation, setDragRotation] = useState(0)
  const rotation = dragRef.current ? dragRotation : position * 150
  const progressDegrees = getJogProgressDegrees(position, duration)

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
      const delta = getJogAngleDelta(dragRef.current.angle, nextAngle)

      if (isPlaying) {
        dragRef.current = { angle: nextAngle, position: dragRef.current.position }
        setDragRotation((current: number) => current + delta)
        onBend(delta)
        return
      }

      const nextPosition = getJogSeekPosition(dragRef.current.position, delta, duration)

      dragRef.current = { angle: nextAngle, position: nextPosition }
      setDragRotation((current: number) => current + delta)
      onSeek(nextPosition)
    },
    [duration, isPlaying, onBend, onSeek]
  )

  const clearDrag = useCallback((): void => {
    dragRef.current = null
  }, [])

  return (
    <button
      aria-label={label}
      className={`jog-wheel ${isPlaying && !dragRef.current ? 'jog-wheel-playing' : ''}`}
      style={
        {
          '--jog-accent': accent,
          '--jog-progress': `${progressDegrees}deg`
        } as React.CSSProperties
      }
      type="button"
      onPointerCancel={clearDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearDrag}
    >
      <span aria-hidden="true" className="jog-arc" />
      <span aria-hidden="true" className="jog-ticks" />
      <span className="jog-rotor" style={{ transform: `rotate(${rotation}deg)` }}>
        <span className="jog-platter" />
        <span className="jog-cap">
          <NextDjMark className="jog-logo" />
        </span>
      </span>
    </button>
  )
}
