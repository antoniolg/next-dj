import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileFromBlob, persistTrackMetadata, readPersistedLibrary, readPersistedTracks } from './libraryRepository'
import type { LibraryTrack, PersistedTrack } from './libraryTypes'

describe('library repository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists track metadata without storing File objects in localStorage', () => {
    const file = new File(['audio'], 'set.wav', { lastModified: 123, type: 'audio/wav' })
    const tracks: LibraryTrack[] = [
      {
        id: 'track-1',
        title: 'Set',
        artist: 'DJ Example',
        artworkUrl: 'https://example.com/set.jpg',
        duration: 120,
        bpm: 124,
        firstBeatOffset: 0.12,
        source: 'local',
        file
      }
    ]

    persistTrackMetadata(tracks)

    expect(JSON.parse(localStorage.getItem('nextdj.library.v2') ?? '{}')).toMatchObject({ version: 2 })

    expect(readPersistedTracks()).toEqual([
      {
        id: 'track-1',
        title: 'Set',
        artist: 'DJ Example',
        artworkUrl: 'https://example.com/set.jpg',
        duration: 120,
        bpm: 124,
        firstBeatOffset: 0.12,
        source: 'local',
        fileName: 'set.wav',
        fileType: 'audio/wav',
        fileLastModified: 123,
        hasFile: true
      }
    ])
  })

  it('returns an empty list when metadata storage is corrupt', () => {
    localStorage.setItem('nextdj.library.v2', '{')

    expect(readPersistedTracks()).toEqual([])
  })

  it('migrates legacy arrays and quarantines invalid rows independently', () => {
    localStorage.setItem(
      'nextdj.library.v1',
      JSON.stringify([
        {
          id: 'valid',
          title: 'Valid',
          duration: 120,
          bpm: 124,
          firstBeatOffset: 0.1,
          source: 'local',
          hasFile: false
        },
        {
          id: 'invalid',
          title: { poisoned: true },
          duration: 120,
          bpm: 124,
          firstBeatOffset: 0.1,
          source: 'local',
          hasFile: false
        }
      ])
    )

    const result = readPersistedLibrary()

    expect(result.migrated).toBe(true)
    expect(result.tracks.map((track) => track.id)).toEqual(['valid'])
    expect(result.issues).toEqual([{ index: 1, reason: 'title is invalid' }])
    expect(localStorage.getItem('nextdj.library.quarantine.v1')).toContain('title is invalid')
  })

  it('rejects unsupported envelopes without throwing during startup', () => {
    localStorage.setItem('nextdj.library.v2', JSON.stringify({ version: 999, tracks: [] }))

    expect(readPersistedLibrary()).toMatchObject({ tracks: [], migrated: false })
    expect(readPersistedLibrary().issues[0].reason).toContain('unsupported')
  })

  it('recreates local files from persisted metadata', () => {
    vi.setSystemTime(new Date('2026-07-09T08:00:00Z'))
    const blob = new Blob(['audio'], { type: 'audio/mpeg' })
    const track: PersistedTrack = {
      id: 'track-1',
      title: 'Set',
      duration: 120,
      bpm: 124,
      firstBeatOffset: 0.12,
      source: 'local',
      hasFile: true
    }

    const file = fileFromBlob(blob, track)

    expect(file.name).toBe('Set.mp3')
    expect(file.type).toBe('audio/mpeg')
    expect(file.lastModified).toBe(new Date('2026-07-09T08:00:00Z').getTime())
    vi.useRealTimers()
  })

  it('uses sanitized playlist names for external files', () => {
    const blob = new Blob(['audio'])
    const track: PersistedTrack = {
      id: 'track-1',
      title: 'Artist / Track?',
      duration: 120,
      bpm: 124,
      firstBeatOffset: 0.12,
      source: 'external',
      fileName: 'download.webm',
      fileType: 'audio/webm',
      fileLastModified: 123,
      hasFile: true
    }

    const file = fileFromBlob(blob, track)

    expect(file.name).toBe('Artist Track.webm')
    expect(file.type).toBe('audio/webm')
    expect(file.lastModified).toBe(123)
  })
})
