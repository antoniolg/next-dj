import { detectBpm } from '../audio/bpm'

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
    const arrayBuffer = await file.arrayBuffer()
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0))

    return detectBpm(buffer)
  } catch {
    return { bpm: 0, firstBeatOffset: 0 }
  } finally {
    void context.close()
  }
}
