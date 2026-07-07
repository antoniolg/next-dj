import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { WaveformData } from './waveformData'
import { getPeakAt } from './waveformData'

interface ZoomWaveformProps {
  accent: string
  bpm: number
  duration: number
  firstBeatOffset: number
  getPosition: () => number
  waveform: WaveformData | null
  onSeek: (seconds: number) => void
}

const WINDOW_SECONDS = 24
const PLAYHEAD_RATIO = 0.38

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getWindowStart(position: number, duration: number, windowSeconds: number): number {
  if (duration <= windowSeconds) {
    return 0
  }

  return clamp(position - windowSeconds * PLAYHEAD_RATIO, 0, duration - windowSeconds)
}

function drawBeatGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  bpm: number,
  firstBeatOffset: number,
  windowStart: number,
  windowSeconds: number
): void {
  if (bpm <= 0) {
    return
  }

  const beatSeconds = 60 / bpm

  if (!Number.isFinite(beatSeconds) || beatSeconds <= 0) {
    return
  }

  const firstBeat = Math.ceil((windowStart - firstBeatOffset) / beatSeconds)
  const lastBeat = Math.floor((windowStart + windowSeconds - firstBeatOffset) / beatSeconds)

  for (let beat = firstBeat; beat <= lastBeat; beat += 1) {
    const beatTime = firstBeatOffset + beat * beatSeconds
    const x = ((beatTime - windowStart) / windowSeconds) * width
    const isBar = Math.abs(beat % 4) === 0

    context.strokeStyle = isBar ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.11)'
    context.lineWidth = isBar ? 1.4 * dpr : 1 * dpr
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  waveform: WaveformData | null,
  accent: string,
  duration: number,
  position: number,
  bpm: number,
  firstBeatOffset: number
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
  context.fillStyle = '#05080b'
  context.fillRect(0, 0, width, height)

  const windowSeconds = Math.min(WINDOW_SECONDS, Math.max(duration, WINDOW_SECONDS))
  const windowStart = getWindowStart(position, duration, windowSeconds)
  const playheadX = clamp(((position - windowStart) / windowSeconds) * width, 0, width)
  const centerY = height / 2

  context.strokeStyle = 'rgba(255,255,255,0.08)'
  context.lineWidth = 1 * dpr
  context.beginPath()
  context.moveTo(0, centerY)
  context.lineTo(width, centerY)
  context.stroke()

  drawBeatGrid(context, width, height, dpr, bpm, firstBeatOffset, windowStart, windowSeconds)

  if (waveform && duration > 0) {
    for (let x = 0; x < width; x += dpr) {
      const time = windowStart + (x / width) * windowSeconds

      if (time < 0 || time > duration) {
        continue
      }

      const bucketIndex = (time / duration) * waveform.zoom.bucketCount
      const { min, max } = getPeakAt(waveform.zoom, bucketIndex)
      const minY = centerY + min * centerY * 0.9
      const maxY = centerY + max * centerY * 0.9

      context.globalAlpha = x <= playheadX ? 0.48 : 0.95
      context.strokeStyle = accent
      context.lineWidth = Math.max(1, dpr)
      context.beginPath()
      context.moveTo(x, minY)
      context.lineTo(x, maxY)
      context.stroke()
    }
  }

  context.globalAlpha = 1
  context.fillStyle = accent
  context.fillRect(playheadX - dpr, 0, dpr * 2, height)
  context.beginPath()
  context.moveTo(playheadX - 6 * dpr, 0)
  context.lineTo(playheadX + 6 * dpr, 0)
  context.lineTo(playheadX, 8 * dpr)
  context.closePath()
  context.fill()
}

export function ZoomWaveform({
  accent,
  bpm,
  duration,
  firstBeatOffset,
  getPosition,
  waveform,
  onSeek
}: ZoomWaveformProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const draggingRef = useRef(false)
  const dragWindowStartRef = useRef(0)
  const windowSeconds = useMemo(() => Math.min(WINDOW_SECONDS, Math.max(duration, WINDOW_SECONDS)), [duration])

  useEffect(() => {
    let frameId = 0

    const tick = (): void => {
      const canvas = canvasRef.current

      if (canvas) {
        drawCanvas(canvas, waveform, accent, duration, getPosition(), bpm, firstBeatOffset)
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [accent, bpm, duration, firstBeatOffset, getPosition, waveform])

  const seekFromPointer = useCallback(
    (clientX: number, windowStart: number): void => {
      const canvas = canvasRef.current

      if (!canvas || duration <= 0) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)

      onSeek(clamp(windowStart + ratio * windowSeconds, 0, duration))
    },
    [duration, onSeek, windowSeconds]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): void => {
      dragWindowStartRef.current = getWindowStart(getPosition(), duration, windowSeconds)
      draggingRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      seekFromPointer(event.clientX, dragWindowStartRef.current)
    },
    [duration, getPosition, seekFromPointer, windowSeconds]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): void => {
      if (draggingRef.current) {
        seekFromPointer(event.clientX, dragWindowStartRef.current)
      }
    },
    [seekFromPointer]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>): void => {
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLCanvasElement>): void => {
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Zoomed deck waveform"
      className="waveform-canvas waveform-zoom"
      role="img"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerCancel}
      onPointerUp={handlePointerUp}
    />
  )
}
