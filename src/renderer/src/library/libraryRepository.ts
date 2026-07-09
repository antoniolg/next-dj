import { createPlaylistFileName } from './libraryFiles'
import type { LibraryTrack, PersistedTrack } from './libraryTypes'

const LIBRARY_STORAGE_KEY = 'nextdj.library.v1'
const LIBRARY_DB_NAME = 'nextdj-library'
const LIBRARY_DB_VERSION = 1
const FILE_STORE_NAME = 'files'

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

export function persistTrackMetadata(tracks: LibraryTrack[]): void {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(tracks.map(serializeTrack)))
}

export function readPersistedTracks(): PersistedTrack[] {
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

export async function putPersistedFile(trackId: string, file: File): Promise<void> {
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

export async function getPersistedFile(trackId: string): Promise<Blob | null> {
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

export function fileFromBlob(blob: Blob, track: PersistedTrack): File {
  const fileName =
    track.source === 'youtube'
      ? createPlaylistFileName(track.title, track.fileName ?? `${track.title}.mp3`)
      : track.fileName ?? `${track.title}.mp3`

  return new File([blob], fileName, {
    lastModified: track.fileLastModified ?? Date.now(),
    type: track.fileType || blob.type || 'audio/mpeg'
  })
}
