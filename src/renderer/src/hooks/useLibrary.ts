import { useCallback, useEffect, useState } from 'react'
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

const LIBRARY_STORAGE_KEY = 'nextdj.library.v1'
const LIBRARY_DB_NAME = 'nextdj-library'
const LIBRARY_DB_VERSION = 1
const FILE_STORE_NAME = 'files'

interface PersistedTrack {
  id: string
  title: string
  duration: number
  bpm: number
  firstBeatOffset: number
  source: 'local' | 'youtube'
  youtubeUrl?: string
  fileName?: string
  fileType?: string
  fileLastModified?: number
  hasFile: boolean
}

function serializeTrack(track: LibraryTrack): PersistedTrack {
  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    bpm: track.bpm,
    firstBeatOffset: track.firstBeatOffset,
    source: track.source,
    youtubeUrl: track.youtubeUrl,
    fileName: track.file?.name,
    fileType: track.file?.type,
    fileLastModified: track.file?.lastModified,
    hasFile: Boolean(track.file)
  }
}

function persistTrackMetadata(tracks: LibraryTrack[]): void {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(tracks.map(serializeTrack)))
}

function readPersistedTracks(): PersistedTrack[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as PersistedTrack[]) : []
  } catch {
    return []
  }
}

function openLibraryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(FILE_STORE_NAME)
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open library database.'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function putPersistedFile(trackId: string, file: File): Promise<void> {
  const db = await openLibraryDb()

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(FILE_STORE_NAME)

    store.put(file, trackId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save audio file.'))
  })

  db.close()
}

async function getPersistedFile(trackId: string): Promise<Blob | null> {
  const db = await openLibraryDb()

  const file = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, 'readonly')
    const store = transaction.objectStore(FILE_STORE_NAME)
    const request = store.get(trackId)

    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
    request.onerror = () => reject(request.error ?? new Error('Could not read audio file.'))
  })

  db.close()
  return file
}

function fileFromBlob(blob: Blob, track: PersistedTrack): File {
  const fileName =
    track.source === 'youtube'
      ? createPlaylistFileName(track.title, track.fileName ?? `${track.title}.mp3`)
      : track.fileName ?? `${track.title}.mp3`

  return new File([blob], fileName, {
    lastModified: track.fileLastModified ?? Date.now(),
    type: track.fileType || blob.type || 'audio/mpeg'
  })
}

function readFileExtension(fileName: string): string {
  const match = /\.[a-z0-9]{2,5}$/i.exec(fileName)
  return match?.[0] ?? '.mp3'
}

const FILE_NAME_UNSAFE_CHARACTERS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])

export function createPlaylistFileName(title: string, downloadedFileName: string): string {
  const cleanedTitle = title
    .split('')
    .map((character) => (FILE_NAME_UNSAFE_CHARACTERS.has(character) || character.charCodeAt(0) < 32 ? ' ' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  return cleanedTitle ? `${cleanedTitle}${readFileExtension(downloadedFileName)}` : downloadedFileName
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
  isReady: boolean
  addFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  addYouTubeTracks: (youtubeTracks: YouTubeTrackSummary[]) => LibraryTrack[]
  resolveTrackFile: (track: LibraryTrack) => Promise<File | null>
  getTrack: (trackId: string) => LibraryTrack | undefined
} {
  const [tracks, setTracks] = useState<LibraryTrack[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const hydrate = async (): Promise<void> => {
      const persistedTracks = readPersistedTracks()
      const hydratedTracks = await Promise.all(
        persistedTracks.map(async (track): Promise<LibraryTrack> => {
          const blob = track.hasFile ? await getPersistedFile(track.id).catch(() => null) : null

          return {
            id: track.id,
            title: track.title,
            duration: track.duration,
            bpm: track.bpm,
            firstBeatOffset: track.firstBeatOffset,
            source: track.source,
            youtubeUrl: track.youtubeUrl,
            file: blob ? fileFromBlob(blob, track) : undefined
          }
        })
      )

      if (!cancelled) {
        setTracks(hydratedTracks)
        setIsReady(true)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [])

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

    await Promise.all(nextTracks.map((track) => (track.file ? putPersistedFile(track.id, track.file) : Promise.resolve())))

    setTracks((current) => {
      const existingIds = new Set(current.map((track) => track.id))
      const uniqueNextTracks = nextTracks.filter((track) => !existingIds.has(track.id))
      const updatedTracks = [...current, ...uniqueNextTracks]

      persistTrackMetadata(updatedTracks)
      return updatedTracks
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
      const updatedTracks = [...current, ...uniqueNextTracks]

      persistTrackMetadata(updatedTracks)
      return updatedTracks
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

    const file = new File([result.file.data], createPlaylistFileName(track.title, result.file.name), {
      lastModified: result.file.lastModified,
      type: 'audio/mpeg'
    })
    const duration = await readDuration(file)
    const bpm = await readBpm(file)

    await putPersistedFile(track.id, file)

    setTracks((current) => {
      const updatedTracks = current.map((currentTrack) =>
        currentTrack.id === track.id
          ? {
              ...currentTrack,
              duration,
              ...bpm,
              file
            }
          : currentTrack
      )

      persistTrackMetadata(updatedTracks)
      return updatedTracks
    })

    return file
  }, [])

  const getTrack = useCallback(
    (trackId: string): LibraryTrack | undefined => tracks.find((track) => track.id === trackId),
    [tracks]
  )

  return { tracks, isReady, addFiles, addYouTubeTracks, resolveTrackFile, getTrack }
}
