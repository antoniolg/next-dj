import { describe, expect, it } from 'vitest'
import { computeWaveformData, getLowPeakAt, getPeakAt } from './waveformData'

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
})
