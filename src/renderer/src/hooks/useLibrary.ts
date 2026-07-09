import { useCallback, useEffect, useMemo, useState } from 'react'
import type { YouTubeTrackSummary } from '../../../shared/nextdj'
import { readAudioMetadata } from '../library/audioMetadata'
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

export function useLibrary(): {
  tracks: LibraryTrack[]
  isReady: boolean
  addFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  addYouTubeTracks: (youtubeTracks: YouTubeTrackSummary[]) => LibraryTrack[]
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
        ...(await readAudioMetadata(file)),
        file,
        source: 'local' as const
      }))
    )

    await Promise.all(nextTracks.map((track) => (track.file ? putPersistedFile(track.id, track.file) : Promise.resolve())))

    setTracks((current) => {
      const updatedTracks = mergeUniqueTracks(current, nextTracks)

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

  return { tracks, isReady, addFiles, addYouTubeTracks, resolveTrackFile, getTrack }
}
