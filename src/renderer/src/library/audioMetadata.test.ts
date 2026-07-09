import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { detectBpm } from '../audio/bpm'
import { readAudioMetadata, readBpm, readDuration } from './audioMetadata'

vi.mock('../audio/bpm', () => ({
  detectBpm: vi.fn()
}))

class MockAudio {
  duration = 0
  onloadedmetadata: (() => void) | null = null
  onerror: (() => void) | null = null
  preload = ''
  src = ''

  removeAttribute = vi.fn()
  load = vi.fn()
}

function installAudioMock(audio: MockAudio): void {
  Object.defineProperty(globalThis, 'Audio', {
    configurable: true,
    value: vi.fn(function AudioMock() {
      return audio
    })
  })
  Object.defineProperty(globalThis.URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:track')
  })
  Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn()
  })
}

describe('audio metadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(globalThis, 'AudioContext')
  })

  it('reads finite audio duration and cleans up the object URL', async () => {
    const audio = new MockAudio()
    audio.duration = 123
    installAudioMock(audio)

    const durationPromise = readDuration(new File(['audio'], 'track.mp3'))
    audio.onloadedmetadata?.()

    await expect(durationPromise).resolves.toBe(123)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:track')
    expect(audio.removeAttribute).toHaveBeenCalledWith('src')
    expect(audio.load).toHaveBeenCalled()
  })

  it('falls back to zero duration on load errors', async () => {
    const audio = new MockAudio()
    installAudioMock(audio)

    const durationPromise = readDuration(new File(['audio'], 'track.mp3'))
    audio.onerror?.()

    await expect(durationPromise).resolves.toBe(0)
  })

  it('decodes files before BPM detection', async () => {
    const decodedBuffer = { duration: 1 } as AudioBuffer
    const close = vi.fn()
    const decodeAudioData = vi.fn<(_: ArrayBuffer) => Promise<AudioBuffer>>().mockResolvedValue(decodedBuffer)
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: vi.fn(function AudioContextMock() {
        return { close, decodeAudioData }
      })
    })
    vi.mocked(detectBpm).mockResolvedValue({ bpm: 128, firstBeatOffset: 0.25 })

    await expect(readBpm(new File(['audio'], 'track.mp3'))).resolves.toEqual({
      bpm: 128,
      firstBeatOffset: 0.25
    })
    expect(decodeAudioData).toHaveBeenCalled()
    expect(detectBpm).toHaveBeenCalledWith(decodedBuffer)
    expect(close).toHaveBeenCalled()
  })

  it('returns empty BPM metadata when decoding fails', async () => {
    const close = vi.fn()
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: vi.fn(function AudioContextMock() {
        return {
          close,
          decodeAudioData: vi.fn().mockRejectedValue(new Error('decode failed'))
        }
      })
    })

    await expect(readBpm(new File(['audio'], 'track.mp3'))).resolves.toEqual({
      bpm: 0,
      firstBeatOffset: 0
    })
    expect(close).toHaveBeenCalled()
  })

  it('reads duration and BPM metadata in parallel', async () => {
    const audio = new MockAudio()
    audio.duration = 45
    installAudioMock(audio)
    const decodedBuffer = { duration: 45 } as AudioBuffer
    const close = vi.fn()
    const decodeState: { resolve?: (buffer: AudioBuffer) => void } = {}
    const decodeAudioData = vi.fn(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          decodeState.resolve = resolve
        })
    )
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: vi.fn(function AudioContextMock() {
        return { close, decodeAudioData }
      })
    })
    vi.mocked(detectBpm).mockResolvedValue({ bpm: 126, firstBeatOffset: 0.1 })

    const file = new File(['audio'], 'track.mp3')
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8))
    const metadataPromise = readAudioMetadata(file)

    await waitFor(() => expect(decodeAudioData).toHaveBeenCalled())
    audio.onloadedmetadata?.()
    decodeState.resolve?.(decodedBuffer)

    await expect(metadataPromise).resolves.toEqual({
      duration: 45,
      bpm: 126,
      firstBeatOffset: 0.1
    })
  })
})
