import { useCallback, useEffect, useRef } from 'react'
import type { WaveformData } from './waveformData'
import { getPeakAt } from './waveformData'

interface OverviewProps {
  accent: string
  duration: number
  position: number
  waveform: WaveformData | null
  onSeek: (seconds: number) => void
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  waveform: WaveformData | null,
  accent: string,
  duration: number,
  position: number
): void {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.floor(rect.width * dpr))
  const height = Math.max(1, Math.floor(rect.height * dpr))

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#070a0f'
  context.fillRect(0, 0, width, height)

  context.strokeStyle = 'rgba(255,255,255,0.08)'
  context.lineWidth = 1 * dpr
  context.beginPath()
  context.moveTo(0, height / 2)
  context.lineTo(width, height / 2)
  context.stroke()

  if (!waveform || duration <= 0) {
    context.fillStyle = 'rgba(148,163,184,0.28)'
    context.font = `${11 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`
    context.fillText('Drop or load audio', 12 * dpr, height / 2 + 4 * dpr)
    return
  }

  const playedRatio = Math.min(Math.max(position / duration, 0), 1)
  const playedX = playedRatio * width
  const centerY = height / 2

  for (let x = 0; x < width; x += dpr) {
    const bucketIndex = (x / width) * waveform.overview.bucketCount
    const { min, max } = getPeakAt(waveform.overview, bucketIndex)
    const minY = centerY + min * centerY * 0.84
    const maxY = centerY + max * centerY * 0.84

    context.strokeStyle = x <= playedX ? accent : 'rgba(148,163,184,0.34)'
    context.lineWidth = Math.max(1, dpr)
    context.beginPath()
    context.moveTo(x, minY)
    context.lineTo(x, maxY)
    context.stroke()
  }

  context.fillStyle = 'rgba(255,255,255,0.94)'
  context.fillRect(playedX - dpr / 2, 0, dpr, height)
}

export function Overview({
  accent,
  duration,
  position,
  waveform,
  onSeek
}: OverviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    drawCanvas(canvas, waveform, accent, duration, position)
  }, [accent, duration, position, waveform])

  const seekFromPointer = useCallback(
    (clientX: number): void => {
      const canvas = canvasRef.current

      if (!canvas || duration <= 0) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
      onSeek(ratio * duration)
    },
    [duration, onSeek]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): void => {
      draggingRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      seekFromPointer(event.clientX)
    },
    [seekFromPointer]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): void => {
      if (draggingRef.current) {
        seekFromPointer(event.clientX)
      }
    },
    [seekFromPointer]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>): void => {
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Track overview waveform"
      className="waveform-canvas waveform-overview"
      role="img"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}
