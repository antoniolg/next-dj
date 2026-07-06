import { useEffect, useRef } from 'react'
import type { WaveformData } from './waveformData'
import { getPeakAt } from './waveformData'

interface ZoomWaveProps {
  accent: string
  bpm: number
  duration: number
  firstBeatOffset: number
  getPosition: () => number
  waveform: WaveformData | null
  windowSeconds?: number
}

function drawBeatGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  bpm: number,
  firstBeatOffset: number,
  startSeconds: number,
  windowSeconds: number
): void {
  if (bpm <= 0) {
    return
  }

  const beatPeriod = 60 / bpm
  const firstBeat = firstBeatOffset + Math.floor((startSeconds - firstBeatOffset) / beatPeriod) * beatPeriod
  const pixelsPerSecond = width / windowSeconds

  for (let beatTime = firstBeat; beatTime <= startSeconds + windowSeconds; beatTime += beatPeriod) {
    if (beatTime < 0) {
      continue
    }

    const beatIndex = Math.round((beatTime - firstBeatOffset) / beatPeriod)
    const x = (beatTime - startSeconds) * pixelsPerSecond
    const strong = beatIndex % 4 === 0

    context.strokeStyle = strong ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.16)'
    context.lineWidth = (strong ? 2 : 1) * dpr
    context.beginPath()
    context.moveTo(x, strong ? 0 : height * 0.16)
    context.lineTo(x, strong ? height : height * 0.84)
    context.stroke()
  }
}

function drawZoom(
  canvas: HTMLCanvasElement,
  waveform: WaveformData | null,
  accent: string,
  bpm: number,
  firstBeatOffset: number,
  duration: number,
  position: number,
  windowSeconds: number
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
  context.fillStyle = '#06080d'
  context.fillRect(0, 0, width, height)

  const centerY = height / 2
  const startSeconds = position - windowSeconds / 2

  context.strokeStyle = 'rgba(255,255,255,0.08)'
  context.lineWidth = 1 * dpr
  context.beginPath()
  context.moveTo(0, centerY)
  context.lineTo(width, centerY)
  context.stroke()

  if (!waveform || duration <= 0) {
    context.fillStyle = 'rgba(148,163,184,0.22)'
    context.font = `${11 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`
    context.fillText('Zoom waveform', 12 * dpr, centerY + 4 * dpr)
  } else {
    const secondsPerPixel = windowSeconds / width

    for (let x = 0; x < width; x += dpr) {
      const seconds = startSeconds + x * secondsPerPixel

      if (seconds < 0 || seconds > duration) {
        continue
      }

      const bucketIndex = (seconds / duration) * waveform.zoom.bucketCount
      const { min, max } = getPeakAt(waveform.zoom, bucketIndex)
      const minY = centerY + min * centerY * 0.9
      const maxY = centerY + max * centerY * 0.9
      const distanceFromNeedle = Math.abs(x - width / 2) / (width / 2)
      const alpha = 0.92 - distanceFromNeedle * 0.4

      context.globalAlpha = x < width / 2 ? alpha * 0.55 : alpha
      context.strokeStyle = accent
      context.lineWidth = Math.max(1, dpr)
      context.beginPath()
      context.moveTo(x, minY)
      context.lineTo(x, maxY)
      context.stroke()
    }

    context.globalAlpha = 1
  }

  drawBeatGrid(context, width, height, dpr, bpm, firstBeatOffset, startSeconds, windowSeconds)

  const needleX = width / 2
  context.fillStyle = 'rgba(255,255,255,0.98)'
  context.fillRect(needleX - dpr, 0, dpr * 2, height)
  context.fillStyle = accent
  context.beginPath()
  context.moveTo(needleX - 5 * dpr, 0)
  context.lineTo(needleX + 5 * dpr, 0)
  context.lineTo(needleX, 6 * dpr)
  context.closePath()
  context.fill()
}

export function ZoomWave({
  accent,
  bpm,
  duration,
  firstBeatOffset,
  getPosition,
  waveform,
  windowSeconds = 8
}: ZoomWaveProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let frameId = 0

    const tick = (): void => {
      const canvas = canvasRef.current

      if (canvas) {
        drawZoom(canvas, waveform, accent, bpm, firstBeatOffset, duration, getPosition(), windowSeconds)
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [accent, bpm, duration, firstBeatOffset, getPosition, waveform, windowSeconds])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Zoomed waveform"
      className="waveform-canvas waveform-zoom"
      role="img"
    />
  )
}
