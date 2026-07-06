import { useEffect, useMemo, useRef, useState } from 'react'

interface VUMeterProps {
  analyser: AnalyserNode | null
  label?: string
  segments?: number
}

export function VUMeter({ analyser, label, segments = 18 }: VUMeterProps): JSX.Element {
  const [level, setLevel] = useState(0)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const segmentItems = useMemo(
    () => Array.from({ length: segments }, (_, index) => index),
    [segments]
  )

  useEffect(() => {
    if (!analyser) {
      setLevel(0)
      return
    }

    dataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    let frameId = 0

    const tick = (): void => {
      const data = dataRef.current

      if (data) {
        analyser.getByteTimeDomainData(data)
        let sum = 0

        for (const sample of data) {
          const centered = (sample - 128) / 128
          sum += centered * centered
        }

        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2))
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [analyser])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="vu-meter" aria-label={label ?? 'VU meter'}>
        {segmentItems.map((segment) => {
          const threshold = (segment + 1) / segments
          const lit = level >= threshold
          const color = segment > segments * 0.82 ? 'red' : segment > segments * 0.62 ? 'yellow' : 'green'

          return <span key={segment} className={`vu-segment vu-${color} ${lit ? 'vu-lit' : ''}`} />
        })}
      </div>
      {label ? <span className="text-[0.6rem] font-bold uppercase text-slate-500">{label}</span> : null}
    </div>
  )
}
