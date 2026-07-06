export interface BpmDetectionResult {
  bpm: number
  firstBeatOffset: number
}

const LOWPASS_FREQUENCY = 150
const ENVELOPE_WINDOW = 1024
const MIN_TEMPO = 70
const MAX_TEMPO = 180
const MIN_PEAK_DISTANCE_SECONDS = 0.22
const MAX_ANALYSIS_SECONDS = 240

function normalizeTempo(bpm: number): number {
  let normalized = bpm

  while (normalized < MIN_TEMPO) {
    normalized *= 2
  }

  while (normalized > MAX_TEMPO) {
    normalized /= 2
  }

  return normalized
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint]
}

function getMonoSample(buffer: AudioBuffer, frame: number): number {
  let sample = 0

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    sample += buffer.getChannelData(channel)[frame] ?? 0
  }

  return sample / Math.max(1, buffer.numberOfChannels)
}

async function renderLowpassed(buffer: AudioBuffer): Promise<AudioBuffer> {
  const frameCount = Math.min(buffer.length, Math.floor(buffer.sampleRate * MAX_ANALYSIS_SECONDS))
  const offline = new OfflineAudioContext(1, frameCount, buffer.sampleRate)
  const sourceBuffer = offline.createBuffer(1, frameCount, buffer.sampleRate)
  const channelData = sourceBuffer.getChannelData(0)

  for (let frame = 0; frame < frameCount; frame += 1) {
    channelData[frame] = getMonoSample(buffer, frame)
  }

  const source = offline.createBufferSource()
  const filter = offline.createBiquadFilter()

  source.buffer = sourceBuffer
  filter.type = 'lowpass'
  filter.frequency.value = LOWPASS_FREQUENCY
  filter.Q.value = 0.7

  source.connect(filter).connect(offline.destination)
  source.start()

  return offline.startRendering()
}

function buildEnvelope(buffer: AudioBuffer): Float32Array {
  const samples = buffer.getChannelData(0)
  const bucketCount = Math.max(1, Math.floor(samples.length / ENVELOPE_WINDOW))
  const envelope = new Float32Array(bucketCount)

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = bucket * ENVELOPE_WINDOW
    const end = Math.min(samples.length, start + ENVELOPE_WINDOW)
    let energy = 0

    for (let frame = start; frame < end; frame += 1) {
      energy += Math.abs(samples[frame] ?? 0)
    }

    envelope[bucket] = energy / Math.max(1, end - start)
  }

  return envelope
}

function pickPeaks(envelope: Float32Array, secondsPerBucket: number): number[] {
  const values = Array.from(envelope)
  const floor = median(values)
  const upper = median(values.filter((value) => value >= floor))
  const threshold = Math.max(floor * 1.45, upper * 0.85)
  const minDistanceBuckets = Math.max(1, Math.round(MIN_PEAK_DISTANCE_SECONDS / secondsPerBucket))
  const candidates: Array<{ index: number; value: number }> = []

  for (let index = 1; index < envelope.length - 1; index += 1) {
    const value = envelope[index]

    if (value >= threshold && value > envelope[index - 1] && value >= envelope[index + 1]) {
      candidates.push({ index, value })
    }
  }

  candidates.sort((a, b) => b.value - a.value)

  const selected: Array<{ index: number; value: number }> = []

  for (const candidate of candidates) {
    if (selected.every((peak) => Math.abs(peak.index - candidate.index) >= minDistanceBuckets)) {
      selected.push(candidate)
    }
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map((peak) => peak.index * secondsPerBucket)
}

function scoreIntervals(peaks: number[]): { bpm: number; score: number } | null {
  const histogram = new Map<number, number>()

  for (let index = 0; index < peaks.length; index += 1) {
    for (let offset = 1; offset <= 8 && index + offset < peaks.length; offset += 1) {
      const interval = peaks[index + offset] - peaks[index]

      if (interval <= 0) {
        continue
      }

      const tempo = normalizeTempo(60 / (interval / offset))

      if (tempo < MIN_TEMPO || tempo > MAX_TEMPO) {
        continue
      }

      const rounded = Math.round(tempo)
      const closeness = 1 / offset
      histogram.set(rounded, (histogram.get(rounded) ?? 0) + closeness)
    }
  }

  let best: { bpm: number; score: number } | null = null

  for (const [bpm, score] of histogram) {
    const neighborScore = score + (histogram.get(bpm - 1) ?? 0) * 0.45 + (histogram.get(bpm + 1) ?? 0) * 0.45

    if (!best || neighborScore > best.score) {
      best = { bpm, score: neighborScore }
    }
  }

  return best
}

function estimateFirstBeatOffset(peaks: number[], bpm: number): number {
  if (peaks.length === 0 || bpm <= 0) {
    return 0
  }

  const beatPeriod = 60 / bpm
  const earlyPeaks = peaks.slice(0, Math.min(12, peaks.length))
  const offsets = earlyPeaks.map((peak) => peak % beatPeriod)
  const averageOffset = offsets.reduce((sum, offset) => sum + offset, 0) / offsets.length

  return Math.max(0, Math.min(beatPeriod, averageOffset))
}

export async function detectBpm(buffer: AudioBuffer): Promise<BpmDetectionResult> {
  if (buffer.duration <= 0) {
    return { bpm: 0, firstBeatOffset: 0 }
  }

  const rendered = await renderLowpassed(buffer)
  const secondsPerBucket = ENVELOPE_WINDOW / rendered.sampleRate
  const envelope = buildEnvelope(rendered)
  const peaks = pickPeaks(envelope, secondsPerBucket)
  const best = scoreIntervals(peaks)

  if (!best) {
    return { bpm: 0, firstBeatOffset: 0 }
  }

  const bpm = Math.round(best.bpm * 10) / 10
  const firstBeatOffset = estimateFirstBeatOffset(peaks, bpm)

  return { bpm, firstBeatOffset }
}
