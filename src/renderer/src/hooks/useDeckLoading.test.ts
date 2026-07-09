import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LibraryTrack } from './useLibrary'
import { useDeckLoading } from './useDeckLoading'

const localTrack: LibraryTrack = {
  id: 'track-1',
  title: 'Local Track',
  duration: 60,
  bpm: 120,
  firstBeatOffset: 0,
  source: 'local',
  file: new File(['audio'], 'local.mp3', { type: 'audio/mpeg' })
}

const remoteTrack: LibraryTrack = {
  id: 'track-2',
  title: 'Remote Track',
  duration: 60,
  bpm: 120,
  firstBeatOffset: 0,
  source: 'youtube',
  youtubeUrl: 'https://youtube.com/watch?v=abc'
}

function createOptions(overrides: Partial<Parameters<typeof useDeckLoading>[0]> = {}) {
  return {
    libraryReady: true,
    addFiles: vi.fn().mockResolvedValue([localTrack]),
    resolveTrackFile: vi.fn().mockResolvedValue(localTrack.file ?? null),
    getTrack: vi.fn((trackId: string) => (trackId === localTrack.id ? localTrack : undefined)),
    loadTrack: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

describe('useDeckLoading', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads dropped files, persists the selected track and clears loading state', async () => {
    const options = createOptions()
    const { result } = renderHook(() => useDeckLoading(options))
    const file = new File(['audio'], 'drop.mp3', { type: 'audio/mpeg' })

    await act(async () => {
      await result.current.loadFileToDeck('A', file)
    })

    expect(options.addFiles).toHaveBeenCalledWith([file])
    expect(options.loadTrack).toHaveBeenCalledWith('A', file, { bpm: 120, firstBeatOffset: 0 })
    expect(localStorage.getItem('nextdj.deckTracks.v1')).toContain(localTrack.id)
    expect(result.current.loadingDecks.A).toBeUndefined()
  })

  it('loads library tracks through the resolver', async () => {
    const file = new File(['audio'], 'resolved.mp3', { type: 'audio/mpeg' })
    const options = createOptions({
      resolveTrackFile: vi.fn().mockResolvedValue(file)
    })
    const { result } = renderHook(() => useDeckLoading(options))

    await act(async () => {
      await result.current.loadLibraryTrack('B', remoteTrack)
    })

    expect(options.resolveTrackFile).toHaveBeenCalledWith(remoteTrack)
    expect(options.loadTrack).toHaveBeenCalledWith('B', file, { bpm: 120, firstBeatOffset: 0 })
    expect(localStorage.getItem('nextdj.deckTracks.v1')).toContain(remoteTrack.id)
    expect(result.current.loadingDecks.B).toBeUndefined()
  })

  it('falls back to deck-side BPM detection when stored analysis is invalid', async () => {
    const file = new File(['audio'], 'resolved.mp3', { type: 'audio/mpeg' })
    const unanalysedTrack: LibraryTrack = { ...remoteTrack, bpm: 0 }
    const options = createOptions({
      resolveTrackFile: vi.fn().mockResolvedValue(file)
    })
    const { result } = renderHook(() => useDeckLoading(options))

    await act(async () => {
      await result.current.loadLibraryTrack('A', unanalysedTrack)
    })

    expect(options.loadTrack).toHaveBeenCalledWith('A', file, undefined)
  })

  it('skips deck loading when a library track cannot be resolved', async () => {
    const options = createOptions({
      resolveTrackFile: vi.fn().mockResolvedValue(null)
    })
    const { result } = renderHook(() => useDeckLoading(options))

    await act(async () => {
      await result.current.loadLibraryTrack('A', remoteTrack)
    })

    expect(options.loadTrack).not.toHaveBeenCalled()
    expect(result.current.loadingDecks.A).toBeUndefined()
  })

  it('loads tracks by id when present', async () => {
    const options = createOptions()
    const { result } = renderHook(() => useDeckLoading(options))

    await act(async () => {
      await result.current.loadLibraryTrackById('A', localTrack.id)
      await result.current.loadLibraryTrackById('A', 'missing')
    })

    expect(options.loadTrack).toHaveBeenCalledTimes(1)
  })

  it('restores persisted deck selections once the library is ready', async () => {
    localStorage.setItem('nextdj.deckTracks.v1', JSON.stringify({ A: localTrack.id }))
    const options = createOptions()

    renderHook(() => useDeckLoading(options))

    await waitFor(() =>
      expect(options.loadTrack).toHaveBeenCalledWith('A', localTrack.file, { bpm: 120, firstBeatOffset: 0 })
    )
  })

  it('does not restore until the library is ready', async () => {
    localStorage.setItem('nextdj.deckTracks.v1', JSON.stringify({ A: localTrack.id }))
    const options = createOptions({ libraryReady: false })

    renderHook(() => useDeckLoading(options))

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(options.loadTrack).not.toHaveBeenCalled()
  })
})
