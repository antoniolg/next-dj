import { detectBpm } from '../audio/bpm'
import { measureAsync } from '../performance/perfMarks'

export interface AudioMetadata {
  duration: number
  bpm: number
  firstBeatOffset: number
}

export function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio()
    const objectUrl = URL.createObjectURL(file)

    const cleanup = (): void => {
      URL.revokeObjectURL(objectUrl)
      audio.removeAttribute('src')
      audio.load()
    }

    audio.preload = 'metadata'
    audio.onloadedmetadata = (): void => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0
      cleanup()
      resolve(duration)
    }
    audio.onerror = (): void => {
      cleanup()
      resolve(0)
    }
    audio.src = objectUrl
  })
}

export async function readBpm(file: File): Promise<{ bpm: number; firstBeatOffset: number }> {
  const context = new AudioContext()

  try {
    const arrayBuffer = await measureAsync('library.audioMetadata.readFile', () => file.arrayBuffer())
    const buffer = await measureAsync('library.audioMetadata.decodeAudioData', () =>
      context.decodeAudioData(arrayBuffer.slice(0))
    )

    return measureAsync('library.audioMetadata.detectBpm', () => detectBpm(buffer))
  } catch {
    return { bpm: 0, firstBeatOffset: 0 }
  } finally {
    void context.close()
  }
}

export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  const [duration, bpm] = await Promise.all([
    measureAsync('library.audioMetadata.readDuration', () => readDuration(file)),
    readBpm(file)
  ])

  return {
    duration,
    ...bpm
  }
}
