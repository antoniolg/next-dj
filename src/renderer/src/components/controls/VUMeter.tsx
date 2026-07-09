import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateMeterLevel, getPeakSegment, getVuSegmentColor } from './vuMeterMath'

interface VUMeterProps {
  analyser: AnalyserNode | null
  label?: string
  segments?: number
}

const PEAK_HOLD_MS = 800

export function VUMeter({ analyser, label, segments = 18 }: VUMeterProps): JSX.Element {
  const [level, setLevel] = useState(0)
  const [peak, setPeak] = useState(0)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const levelRef = useRef(0)
  const peakRef = useRef({ value: 0, at: 0 })
  const segmentItems = useMemo(
    () => Array.from({ length: segments }, (_, index) => index),
    [segments]
  )

  useEffect(() => {
    if (!analyser) {
      levelRef.current = 0
      peakRef.current = { value: 0, at: 0 }
      setLevel(0)
      setPeak(0)
      return
    }

    dataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    let frameId = 0

    const tick = (): void => {
      const data = dataRef.current

      if (data) {
        analyser.getByteTimeDomainData(data)
        const targetLevel = calculateMeterLevel(data)
        const nextLevel =
          targetLevel > levelRef.current
            ? targetLevel
            : levelRef.current * 0.88 + targetLevel * 0.12

        levelRef.current = nextLevel < 0.01 ? 0 : nextLevel

        const now = performance.now()

        if (levelRef.current >= peakRef.current.value || now - peakRef.current.at > PEAK_HOLD_MS) {
          peakRef.current = { value: levelRef.current, at: now }
        }

        setLevel(levelRef.current)
        setPeak(peakRef.current.value)
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [analyser])

  const peakSegment = getPeakSegment(peak, segments)

  return (
    <div className="vu">
      <div aria-label={label ?? 'VU meter'} className="vu-meter">
        {segmentItems.map((segment) => {
          const threshold = (segment + 1) / segments
          const lit = level >= threshold || segment === peakSegment
          const color = getVuSegmentColor(segment, segments)

          return <span key={segment} className={`vu-segment vu-${color} ${lit ? 'vu-lit' : ''}`} />
        })}
      </div>
      {label ? <span className="vu-label">{label}</span> : null}
    </div>
  )
}
