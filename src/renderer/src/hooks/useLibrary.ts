import { useCallback, useState } from 'react'
import { detectBpm } from '../audio/bpm'

export interface LibraryTrack {
  id: string
  title: string
  duration: number
  bpm: number
  firstBeatOffset: number
  file?: File
  source: 'local' | 'youtube'
  youtubeUrl?: string
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(aif|aiff|flac|m4a|mp3|ogg|wav)$/i.test(file.name)
}

function createTrackId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function readDuration(file: File): Promise<number> {
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

async function readBpm(file: File): Promise<{ bpm: number; firstBeatOffset: number }> {
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

export function useLibrary(): {
  tracks: LibraryTrack[]
  addFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  addYouTubeTracks: (youtubeTracks: YouTubeTrackSummary[]) => LibraryTrack[]
  resolveTrackFile: (track: LibraryTrack) => Promise<File | null>
  getTrack: (trackId: string) => LibraryTrack | undefined
} {
  const [tracks, setTracks] = useState<LibraryTrack[]>([])

  const addFiles = useCallback(async (files: File[] | FileList): Promise<LibraryTrack[]> => {
    const audioFiles = Array.from(files).filter(isAudioFile)
    const nextTracks = await Promise.all(
      audioFiles.map(async (file) => ({
        id: createTrackId(file),
        title: file.name,
        duration: await readDuration(file),
        ...(await readBpm(file)),
        file,
        source: 'local' as const
      }))
    )

    setTracks((current) => {
      const existingIds = new Set(current.map((track) => track.id))
      const uniqueNextTracks = nextTracks.filter((track) => !existingIds.has(track.id))

      return [...current, ...uniqueNextTracks]
    })

    return nextTracks
  }, [])

  const addYouTubeTracks = useCallback((youtubeTracks: YouTubeTrackSummary[]): LibraryTrack[] => {
    const nextTracks = youtubeTracks.map((track) => ({
      id: `youtube-${track.id}`,
      title: track.title,
      duration: track.duration,
      bpm: 0,
      firstBeatOffset: 0,
      source: 'youtube' as const,
      youtubeUrl: track.url
    }))

    setTracks((current) => {
      const existingIds = new Set(current.map((track) => track.id))
      const uniqueNextTracks = nextTracks.filter((track) => !existingIds.has(track.id))

      return [...current, ...uniqueNextTracks]
    })

    return nextTracks
  }, [])

  const resolveTrackFile = useCallback(async (track: LibraryTrack): Promise<File | null> => {
    if (track.file) {
      return track.file
    }

    if (track.source !== 'youtube' || !track.youtubeUrl) {
      return null
    }

    const downloader = window.nextdj?.downloadYouTubeAudio

    if (!downloader) {
      return null
    }

    const result = await downloader(track.youtubeUrl)

    if (!result.file) {
      return null
    }

    const file = new File([result.file.data], result.file.name, {
      lastModified: result.file.lastModified,
      type: 'audio/mpeg'
    })
    const duration = await readDuration(file)
    const bpm = await readBpm(file)

    setTracks((current) =>
      current.map((currentTrack) =>
        currentTrack.id === track.id
          ? {
              ...currentTrack,
              duration,
              ...bpm,
              file
            }
          : currentTrack
      )
    )

    return file
  }, [])

  const getTrack = useCallback(
    (trackId: string): LibraryTrack | undefined => tracks.find((track) => track.id === trackId),
    [tracks]
  )

  return { tracks, addFiles, addYouTubeTracks, resolveTrackFile, getTrack }
}
