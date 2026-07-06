import { useEffect, useRef } from 'react'
import type { WaveformData } from './waveformData'
import { getPeakAt } from './waveformData'

interface ZoomWaveProps {
  accent: string
  duration: number
  getPosition: () => number
  waveform: WaveformData | null
  windowSeconds?: number
}

function drawZoom(
  canvas: HTMLCanvasElement,
  waveform: WaveformData | null,
  accent: string,
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
    const startSeconds = position - windowSeconds / 2

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
      const alpha = 0.9 - distanceFromNeedle * 0.38

      context.strokeStyle = x < width / 2 ? `rgba(255,255,255,${alpha})` : accent
      context.lineWidth = Math.max(1, dpr)
      context.beginPath()
      context.moveTo(x, minY)
      context.lineTo(x, maxY)
      context.stroke()
    }
  }

  const needleX = width / 2
  context.fillStyle = 'rgba(255,255,255,0.98)'
  context.fillRect(needleX - dpr, 0, dpr * 2, height)
  context.fillStyle = accent
  context.fillRect(needleX - 4 * dpr, 0, 8 * dpr, 3 * dpr)
}

export function ZoomWave({
  accent,
  duration,
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
        drawZoom(canvas, waveform, accent, duration, getPosition(), windowSeconds)
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [accent, duration, getPosition, waveform, windowSeconds])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Zoomed waveform"
      className="waveform-canvas waveform-zoom"
      role="img"
    />
  )
}
