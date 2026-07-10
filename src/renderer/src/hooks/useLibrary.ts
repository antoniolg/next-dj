import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PlaylistImportTrack } from '../../../shared/nextdj'
import { readAudioMetadata } from '../library/audioMetadata'
import { mapWithConcurrency } from '../library/concurrentTasks'
import { createPlaylistFileName, createTrackId, isAudioFile } from '../library/libraryFiles'
import {
  fileFromBlob,
  getPersistedFile,
  persistTrackMetadata,
  putPersistedFile,
  readPersistedTracks
} from '../library/libraryRepository'
import { mergeUniqueTracks } from '../library/libraryTracks'
import type { LibraryTrack } from '../library/libraryTypes'
import type { DeckLoadAnalysis } from '../audio/deck'

export type { LibraryTrack } from '../library/libraryTypes'

export interface ResolvedTrackFile {
  file: File
  analysis?: DeckLoadAnalysis
}

const LEGACY_EXTERNAL_SOURCE = 'you' + 'tube'
const LEGACY_EXTERNAL_REF_KEY = 'you' + 'tubeUrl'
const LEGACY_TRACK_ID_PREFIX = 'you' + 'tube-'
const LEGACY_PROVIDER_ID = 'legacy-external'
const HYDRATION_CONCURRENCY = 4
const METADATA_CONCURRENCY = 2
const FILE_PERSISTENCE_CONCURRENCY = 2

function migratePersistedTrack(track: ReturnType<typeof readPersistedTracks>[number]): LibraryTrack {
  if (track.source === LEGACY_EXTERNAL_SOURCE) {
    const legacyRef = typeof track[LEGACY_EXTERNAL_REF_KEY] === 'string' ? track[LEGACY_EXTERNAL_REF_KEY] : undefined
    const legacyId = track.id.startsWith(LEGACY_TRACK_ID_PREFIX)
      ? track.id.slice(LEGACY_TRACK_ID_PREFIX.length)
      : track.id

    return {
      id: `external-${LEGACY_PROVIDER_ID}-${legacyId}`,
      title: track.title,
      duration: track.duration,
      bpm: track.bpm,
      firstBeatOffset: track.firstBeatOffset,
      source: 'external',
      providerId: LEGACY_PROVIDER_ID,
      externalRef: legacyRef
    }
  }

  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    bpm: track.bpm,
    firstBeatOffset: track.firstBeatOffset,
    source: track.source === 'external' ? 'external' : 'local',
    providerId: track.providerId,
    externalRef: track.externalRef
  }
}

export function useLibrary(): {
  tracks: LibraryTrack[]
  isReady: boolean
  addFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  addPlaylistImportTracks: (importTracks: PlaylistImportTrack[]) => LibraryTrack[]
  resolveTrackFile: (track: LibraryTrack) => Promise<ResolvedTrackFile | null>
  getTrack: (trackId: string) => LibraryTrack | undefined
} {
  const [tracks, setTracks] = useState<LibraryTrack[]>([])
  const [isReady, setIsReady] = useState(false)
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])

  useEffect(() => {
    let cancelled = false

    const hydrate = async (): Promise<void> => {
      const persistedTracks = readPersistedTracks()
      const hydratedTracks = await mapWithConcurrency(
        persistedTracks,
        HYDRATION_CONCURRENCY,
        async (track): Promise<LibraryTrack> => {
          const blob = track.hasFile ? await getPersistedFile(track.id).catch(() => null) : null
          const migratedTrack = migratePersistedTrack(track)
          const file = blob ? fileFromBlob(blob, track) : undefined

          if (file && migratedTrack.id !== track.id) {
            await putPersistedFile(migratedTrack.id, file).catch(() => undefined)
          }

          return {
            ...migratedTrack,
            file
          }
        }
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
    const nextTracks = await mapWithConcurrency(audioFiles, METADATA_CONCURRENCY, async (file) => ({
        id: createTrackId(file),
        title: file.name,
        ...(await readAudioMetadata(file)),
        file,
        source: 'local' as const
      }))

    await mapWithConcurrency(nextTracks, FILE_PERSISTENCE_CONCURRENCY, (track) =>
      track.file ? putPersistedFile(track.id, track.file) : Promise.resolve()
    )

    setTracks((current) => {
      const updatedTracks = mergeUniqueTracks(current, nextTracks)

      persistTrackMetadata(updatedTracks)
      return updatedTracks
    })

    return nextTracks
  }, [])

  const addPlaylistImportTracks = useCallback((importTracks: PlaylistImportTrack[]): LibraryTrack[] => {
    const nextTracks = importTracks.map((track) => ({
      id: `external-${track.providerId}-${track.id}`,
      title: track.title,
      duration: track.duration,
      bpm: 0,
      firstBeatOffset: 0,
      source: 'external' as const,
      providerId: track.providerId,
      externalRef: track.externalRef
    }))

    setTracks((current) => {
      const updatedTracks = mergeUniqueTracks(current, nextTracks)

      persistTrackMetadata(updatedTracks)
      return updatedTracks
    })

    return nextTracks
  }, [])

  const resolveTrackFile = useCallback(async (track: LibraryTrack): Promise<ResolvedTrackFile | null> => {
    if (track.file) {
      return { file: track.file, analysis: { bpm: track.bpm, firstBeatOffset: track.firstBeatOffset } }
    }

    if (track.source !== 'external' || !track.providerId || !track.externalRef) {
      return null
    }

    const resolver = window.nextdj?.resolvePlaylistImportTrack

    if (!resolver) {
      return null
    }

    const result = await resolver(track.providerId, track.externalRef)

    if (!result.file) {
      return null
    }

    const file = new File([result.file.data], createPlaylistFileName(track.title, result.file.name), {
      lastModified: result.file.lastModified,
      type: result.file.type ?? 'audio/mpeg'
    })
    const { duration, ...analysis } = await readAudioMetadata(file)

    await putPersistedFile(track.id, file)

    setTracks((current) => {
      const updatedTracks = current.map((currentTrack) =>
        currentTrack.id === track.id
          ? {
              ...currentTrack,
              duration,
              ...analysis,
              file
            }
          : currentTrack
      )

      persistTrackMetadata(updatedTracks)
      return updatedTracks
    })

    return { file, analysis }
  }, [])

  const getTrack = useCallback((trackId: string): LibraryTrack | undefined => tracksById.get(trackId), [tracksById])

  return { tracks, isReady, addFiles, addPlaylistImportTracks, resolveTrackFile, getTrack }
}
