import { buildMonoSamples } from '../../audio/monoSamples'

export interface PeakBuckets {
  bucketCount: number
  peaks: Float32Array
  lows: Float32Array
}

export interface WaveformData {
  overview: PeakBuckets
  zoom: PeakBuckets
}

const OVERVIEW_BUCKETS = 2000
const ZOOM_BUCKETS_PER_SECOND = 120
const MIN_ZOOM_BUCKETS = 3000
const MAX_ZOOM_BUCKETS = 24000
const LOW_BAND_CUTOFF_HZ = 180

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function buildPeakBuckets(samples: Float32Array, sampleRate: number, bucketCount: number): PeakBuckets {
  const frameCount = samples.length
  const peaks = new Float32Array(bucketCount * 2)
  const lows = new Float32Array(bucketCount * 2)

  // Two cascaded one-pole low-passes isolate the bass band; buckets cover the
  // buffer contiguously, so the filter state carries across the whole pass.
  const alpha = 1 - Math.exp((-2 * Math.PI * LOW_BAND_CUTOFF_HZ) / sampleRate)
  let lp1 = 0
  let lp2 = 0

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket / bucketCount) * frameCount)
    const end = Math.max(start + 1, Math.floor(((bucket + 1) / bucketCount) * frameCount))
    let min = 1
    let max = -1
    let lowMin = 1
    let lowMax = -1

    for (let frame = start; frame < end; frame += 1) {
      const sample = samples[frame] ?? 0
      min = Math.min(min, sample)
      max = Math.max(max, sample)

      lp1 += alpha * (sample - lp1)
      lp2 += alpha * (lp1 - lp2)
      lowMin = Math.min(lowMin, lp2)
      lowMax = Math.max(lowMax, lp2)
    }

    peaks[bucket * 2] = min
    peaks[bucket * 2 + 1] = max
    lows[bucket * 2] = lowMin
    lows[bucket * 2 + 1] = lowMax
  }

  return { bucketCount, peaks, lows }
}

export function computeWaveformData(buffer: AudioBuffer): WaveformData {
  const samples = buildMonoSamples(buffer)
  const overviewBucketCount = Math.min(OVERVIEW_BUCKETS, Math.max(1, buffer.length))
  const zoomBucketCount = Math.min(
    Math.max(MIN_ZOOM_BUCKETS, Math.ceil(buffer.duration * ZOOM_BUCKETS_PER_SECOND)),
    Math.min(MAX_ZOOM_BUCKETS, Math.max(1, buffer.length))
  )

  return {
    overview: buildPeakBuckets(samples, buffer.sampleRate, overviewBucketCount),
    zoom: buildPeakBuckets(samples, buffer.sampleRate, zoomBucketCount)
  }
}

export function getPeakAt(buckets: PeakBuckets, index: number): { min: number; max: number } {
  const clampedIndex = clamp(Math.floor(index), 0, buckets.bucketCount - 1)

  return {
    min: buckets.peaks[clampedIndex * 2] ?? 0,
    max: buckets.peaks[clampedIndex * 2 + 1] ?? 0
  }
}

export function getLowPeakAt(buckets: PeakBuckets, index: number): { min: number; max: number } {
  const clampedIndex = clamp(Math.floor(index), 0, buckets.bucketCount - 1)

  return {
    min: buckets.lows[clampedIndex * 2] ?? 0,
    max: buckets.lows[clampedIndex * 2 + 1] ?? 0
  }
}
