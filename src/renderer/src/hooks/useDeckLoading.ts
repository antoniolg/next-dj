import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearDeckTrackSelection,
  persistDeckTrack,
  readDeckTrackSelection
} from '../app/deckTrackPersistence'
import type { DeckLoadAnalysis } from '../audio/deck'
import type { LibraryTrack, ResolvedTrackFile } from './useLibrary'
import type { DeckId } from './useEngine'

type DeckLoadingState = Partial<Record<DeckId, string>>

interface UseDeckLoadingOptions {
  libraryReady: boolean
  addFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  resolveTrackFile: (track: LibraryTrack) => Promise<ResolvedTrackFile | null>
  getTrack: (trackId: string) => LibraryTrack | undefined
  loadTrack: (deckId: DeckId, file: File, analysis?: DeckLoadAnalysis) => Promise<void>
}

function getValidAnalysis(analysis: DeckLoadAnalysis | undefined): DeckLoadAnalysis | undefined {
  if (!analysis || analysis.bpm <= 0 || !Number.isFinite(analysis.bpm) || !Number.isFinite(analysis.firstBeatOffset)) {
    return undefined
  }

  return {
    bpm: analysis.bpm,
    firstBeatOffset: analysis.firstBeatOffset
  }
}

function getTrackAnalysis(track: LibraryTrack | undefined): DeckLoadAnalysis | undefined {
  return track ? getValidAnalysis(track) : undefined
}

export function useDeckLoading({
  libraryReady,
  addFiles,
  resolveTrackFile,
  getTrack,
  loadTrack
}: UseDeckLoadingOptions): {
  loadingDecks: DeckLoadingState
  loadFileToDeck: (deckId: DeckId, file: File) => Promise<void>
  loadLibraryTrack: (deckId: DeckId, track: LibraryTrack) => Promise<void>
  loadLibraryTrackById: (deckId: DeckId, trackId: string) => Promise<void>
} {
  const [loadingDecks, setLoadingDecks] = useState<DeckLoadingState>({})
  const restoredDecksRef = useRef(false)

  const setDeckLoading = useCallback((deckId: DeckId, message: string | null): void => {
    setLoadingDecks((current) => {
      const next = { ...current }

      if (message) {
        next[deckId] = message
      } else {
        delete next[deckId]
      }

      return next
    })
  }, [])

  const loadFileToDeck = useCallback(
    async (deckId: DeckId, file: File): Promise<void> => {
      setDeckLoading(deckId, 'Analyzing audio...')

      try {
        const [track] = await addFiles([file])
        setDeckLoading(deckId, 'Loading deck...')
        await loadTrack(deckId, file, getTrackAnalysis(track))

        if (track) {
          persistDeckTrack(deckId, track.id)
        }
      } finally {
        setDeckLoading(deckId, null)
      }
    },
    [addFiles, loadTrack, setDeckLoading]
  )

  const loadLibraryTrack = useCallback(
    async (deckId: DeckId, track: LibraryTrack): Promise<void> => {
      setDeckLoading(deckId, track.file ? 'Loading deck...' : 'Downloading audio...')

      try {
        const resolved = await resolveTrackFile(track)

        if (!resolved) {
          return
        }

        setDeckLoading(deckId, 'Decoding waveform...')
        await loadTrack(deckId, resolved.file, getValidAnalysis(resolved.analysis) ?? getTrackAnalysis(track))
        persistDeckTrack(deckId, track.id)
      } finally {
        setDeckLoading(deckId, null)
      }
    },
    [loadTrack, resolveTrackFile, setDeckLoading]
  )

  const loadLibraryTrackById = useCallback(
    async (deckId: DeckId, trackId: string): Promise<void> => {
      const track = getTrack(trackId)

      if (track) {
        await loadLibraryTrack(deckId, track)
      }
    },
    [getTrack, loadLibraryTrack]
  )

  useEffect(() => {
    if (!libraryReady || restoredDecksRef.current) {
      return
    }

    restoredDecksRef.current = true
    const parsed = readDeckTrackSelection()

    ;(['A', 'B'] as const).forEach((deckId) => {
      const trackId = parsed[deckId]
      const track = trackId ? getTrack(trackId) : undefined

      if (track) {
        void loadLibraryTrack(deckId, track)
      }
    })

    if (!parsed.A && !parsed.B) {
      clearDeckTrackSelection()
    }
  }, [getTrack, libraryReady, loadLibraryTrack])

  return { loadingDecks, loadFileToDeck, loadLibraryTrack, loadLibraryTrackById }
}
