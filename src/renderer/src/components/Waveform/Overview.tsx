import { useCallback, useEffect, useRef } from 'react'
import type { WaveformData } from './waveformData'
import { getLowPeakAt, getPeakAt } from './waveformData'

const LOW_BAND_GAIN = 1.5

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

interface OverviewProps {
  accent: string
  duration: number
  getPosition: () => number
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
    context.fillStyle = accent
    context.fillRect(width / 2 - dpr, 0, dpr * 2, height)
    context.beginPath()
    context.moveTo(width / 2 - 5 * dpr, 0)
    context.lineTo(width / 2 + 5 * dpr, 0)
    context.lineTo(width / 2, 6 * dpr)
    context.closePath()
    context.fill()
    return
  }

  const playedRatio = Math.min(Math.max(position / duration, 0), 1)
  const playedX = playedRatio * width
  const centerY = height / 2

  context.lineWidth = Math.max(1, dpr)

  for (let x = 0; x < width; x += dpr) {
    const bucketIndex = (x / width) * waveform.overview.bucketCount
    const played = x <= playedX

    const { min, max } = getPeakAt(waveform.overview, bucketIndex)
    context.globalAlpha = played ? 0.24 : 0.42
    context.strokeStyle = accent
    context.beginPath()
    context.moveTo(x, centerY + min * centerY * 0.84)
    context.lineTo(x, centerY + max * centerY * 0.84)
    context.stroke()

    const low = getLowPeakAt(waveform.overview, bucketIndex)
    const lowMin = clamp(low.min * LOW_BAND_GAIN, -1, 1)
    const lowMax = clamp(low.max * LOW_BAND_GAIN, -1, 1)
    context.globalAlpha = played ? 0.55 : 1
    context.beginPath()
    context.moveTo(x, centerY + lowMin * centerY * 0.84)
    context.lineTo(x, centerY + lowMax * centerY * 0.84)
    context.stroke()
  }

  context.globalAlpha = 1
  context.fillStyle = accent
  context.fillRect(playedX - dpr, 0, dpr * 2, height)
  context.beginPath()
  context.moveTo(playedX - 5 * dpr, 0)
  context.lineTo(playedX + 5 * dpr, 0)
  context.lineTo(playedX, 6 * dpr)
  context.closePath()
  context.fill()
}

export function Overview({
  accent,
  duration,
  getPosition,
  waveform,
  onSeek
}: OverviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    let frameId = 0

    const tick = (): void => {
      const canvas = canvasRef.current

      if (canvas) {
        drawCanvas(canvas, waveform, accent, duration, getPosition())
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [accent, duration, getPosition, waveform])

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
