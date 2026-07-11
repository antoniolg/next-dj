import { describe, expect, it, vi } from 'vitest'
import { computeWaveformData, computeWaveformFromSamples, getLowPeakAt, getPeakAt } from '../../audio/waveformData'

// Deterministic pseudo-random generator (mulberry32) so fixtures are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed

  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateSamples(length: number, seed: number): Float32Array {
  const random = mulberry32(seed)
  const samples = new Float32Array(length)

  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.sin(i * 0.01) * 0.5 + (random() - 0.5) * 0.5
  }

  return samples
}

const SAMPLE_RATE = 44100
const OVERVIEW_BUCKETS = 2000
const ZOOM_BUCKETS_PER_SECOND = 120
const MIN_ZOOM_BUCKETS = 3000
const MAX_ZOOM_BUCKETS = 24000

function referenceBucketCounts(frameCount: number, duration: number): { overview: number; zoom: number } {
  const overview = Math.min(OVERVIEW_BUCKETS, Math.max(1, frameCount))
  const zoom = Math.min(
    Math.max(MIN_ZOOM_BUCKETS, Math.ceil(duration * ZOOM_BUCKETS_PER_SECOND)),
    Math.min(MAX_ZOOM_BUCKETS, Math.max(1, frameCount))
  )

  return { overview, zoom }
}

function referenceBuildPeakBuckets(
  samples: Float32Array,
  sampleRate: number,
  bucketCount: number
): { bucketCount: number; peaks: Float32Array; lows: Float32Array } {
  const LOW_BAND_CUTOFF_HZ = 180
  const frameCount = samples.length
  const peaks = new Float32Array(bucketCount * 2)
  const lows = new Float32Array(bucketCount * 2)
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

function createAudioBuffer(channels: number[][], sampleRate = 1): AudioBuffer {
  const length = Math.max(...channels.map((channel) => channel.length))

  return {
    duration: length / sampleRate,
    length,
    numberOfChannels: channels.length,
    sampleRate,
    getChannelData: (index: number) => Float32Array.from(channels[index] ?? [])
  } as AudioBuffer
}

describe('waveform data', () => {
  it('builds min/max peak buckets from mono samples', () => {
    const waveform = computeWaveformData(createAudioBuffer([[-1, -0.5, 0.25, 0.75]], 4))

    expect(waveform.overview.bucketCount).toBe(4)
    expect(getPeakAt(waveform.overview, 0)).toEqual({ min: -1, max: -1 })
    expect(getPeakAt(waveform.overview, 3)).toEqual({ min: 0.75, max: 0.75 })
  })

  it('mixes channels before calculating peaks', () => {
    const waveform = computeWaveformData(
      createAudioBuffer([
        [1, -1],
        [-0.5, 0.25]
      ])
    )

    expect(getPeakAt(waveform.overview, 0)).toEqual({ min: 0.25, max: 0.25 })
    expect(getPeakAt(waveform.overview, 1)).toEqual({ min: -0.375, max: -0.375 })
  })

  it('clamps peak lookup indexes', () => {
    const waveform = computeWaveformData(createAudioBuffer([[0.2, 0.8]]))

    expect(getPeakAt(waveform.overview, -10).min).toBeCloseTo(0.2)
    expect(getPeakAt(waveform.overview, -10).max).toBeCloseTo(0.2)
    expect(getPeakAt(waveform.overview, 100).min).toBeCloseTo(0.8)
    expect(getPeakAt(waveform.overview, 100).max).toBeCloseTo(0.8)
  })

  it('keeps a low-band peak track alongside full-range peaks', () => {
    const waveform = computeWaveformData(createAudioBuffer([Array.from({ length: 4000 }, () => 1)], 48_000))
    const low = getLowPeakAt(waveform.overview, 10)

    expect(low.max).toBeGreaterThan(low.min)
    expect(low.max).toBeLessThan(1)
  })

  it('mixes channel data once before building overview and zoom buckets', () => {
    const getChannelData = vi.fn((index: number) => Float32Array.from(index === 0 ? [1, 0] : [0, 1]))
    const buffer = {
      duration: 2,
      length: 2,
      numberOfChannels: 2,
      sampleRate: 1,
      getChannelData
    } as unknown as AudioBuffer

    computeWaveformData(buffer)

    expect(getChannelData).toHaveBeenCalledTimes(2)
    expect(getChannelData).toHaveBeenNthCalledWith(1, 0)
    expect(getChannelData).toHaveBeenNthCalledWith(2, 1)
  })
})

describe('computeWaveformFromSamples single-pass equivalence (realistic buffer lengths)', () => {
  // Both lengths are chosen so frames do not divide evenly by bucket counts, and both are
  // comfortably above MIN_ZOOM_BUCKETS (3000) so buildPeakBuckets's per-bucket frame ranges
  // never overlap in this regime — the merged single pass must match it bit-for-bit.
  const REALISTIC_LENGTHS = [44101, 123457]
  const SEEDS = [1, 2, 3]

  for (const length of REALISTIC_LENGTHS) {
    for (const seed of SEEDS) {
      it(`matches the two-pass reference for length=${length} seed=${seed}`, () => {
        const samples = generateSamples(length, length + seed)
        const duration = length / SAMPLE_RATE
        const { overview: overviewBucketCount, zoom: zoomBucketCount } = referenceBucketCounts(length, duration)

        const refOverview = referenceBuildPeakBuckets(samples, SAMPLE_RATE, overviewBucketCount)
        const refZoom = referenceBuildPeakBuckets(samples, SAMPLE_RATE, zoomBucketCount)
        const merged = computeWaveformFromSamples(samples, SAMPLE_RATE, length, duration)

        expect(merged.overview.bucketCount).toBe(overviewBucketCount)
        expect(merged.zoom.bucketCount).toBe(zoomBucketCount)
        expect(Array.from(merged.overview.peaks)).toEqual(Array.from(refOverview.peaks))
        expect(Array.from(merged.overview.lows)).toEqual(Array.from(refOverview.lows))
        expect(Array.from(merged.zoom.peaks)).toEqual(Array.from(refZoom.peaks))
        expect(Array.from(merged.zoom.lows)).toEqual(Array.from(refZoom.lows))
      })
    }
  }

  // Short-buffer sanity test (NOT an equivalence test). Below ~3000 samples,
  // buildPeakBuckets's per-bucket range clamp (`end = Math.max(start + 1, ...)`) can make
  // bucket ranges overlap. Because the IIR low-band filter runs continuously across the
  // whole scan, an overlapped frame gets fed through the filter more than once in the
  // two-pass reference. The merged single pass computes the filter exactly once per frame,
  // so it cannot (and should not) reproduce that double-application here — this is expected
  // divergence, not a bug, so we only assert the merged output is well-formed, not equal to
  // buildPeakBuckets's output.
  it('produces well-formed (but not necessarily equal) output for a short buffer', () => {
    const length = 733
    const samples = generateSamples(length, 99)
    const duration = length / SAMPLE_RATE
    const { overview: overviewBucketCount, zoom: zoomBucketCount } = referenceBucketCounts(length, duration)

    const merged = computeWaveformFromSamples(samples, SAMPLE_RATE, length, duration)

    expect(merged.overview.bucketCount).toBe(overviewBucketCount)
    expect(merged.zoom.bucketCount).toBe(zoomBucketCount)

    for (const buckets of [merged.overview, merged.zoom]) {
      for (let i = 0; i < buckets.bucketCount; i += 1) {
        const min = buckets.peaks[i * 2]
        const max = buckets.peaks[i * 2 + 1]

        expect(Number.isFinite(min)).toBe(true)
        expect(Number.isFinite(max)).toBe(true)
        expect(min).toBeLessThanOrEqual(max)
      }
    }
  })
})
