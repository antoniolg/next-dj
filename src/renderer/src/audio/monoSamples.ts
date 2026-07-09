export function buildMonoSamples(buffer: AudioBuffer, frameCount = buffer.length): Float32Array {
  const sampleCount = Math.max(0, Math.min(frameCount, buffer.length))
  const samples = new Float32Array(sampleCount)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))

  if (channels.length === 0) {
    return samples
  }

  if (channels.length === 1) {
    samples.set(channels[0].subarray(0, sampleCount))
    return samples
  }

  for (let frame = 0; frame < sampleCount; frame += 1) {
    let sample = 0

    for (const channel of channels) {
      sample += channel[frame] ?? 0
    }

    samples[frame] = sample / channels.length
  }

  return samples
}
