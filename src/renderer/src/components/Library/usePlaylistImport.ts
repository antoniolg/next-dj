import { useCallback, useEffect, useState } from 'react'
import type { LibraryTrack } from '../../hooks/useLibrary'

interface UsePlaylistImportOptions {
  onAddPlaylistImportTracks: (importTracks: PlaylistImportTrack[]) => Promise<LibraryTrack[]>
}

interface PlaylistImportState {
  hasPlaylistImportProviders: boolean
  isImportingPlaylist: boolean
  playlistStatus: string | null
  playlistInput: string
  setPlaylistInput: (input: string) => void
  handlePlaylistImport: () => Promise<void>
}

export function usePlaylistImport({ onAddPlaylistImportTracks }: UsePlaylistImportOptions): PlaylistImportState {
  const [playlistInput, setPlaylistInput] = useState('')
  const [playlistStatus, setPlaylistStatus] = useState<string | null>(null)
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false)
  const [hasPlaylistImportProviders, setHasPlaylistImportProviders] = useState(false)

  useEffect(() => {
    let cancelled = false

    void window.nextdj
      ?.listPlaylistImportProviders()
      .then((providers) => {
        if (!cancelled) {
          setHasPlaylistImportProviders(providers.length > 0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasPlaylistImportProviders(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handlePlaylistImport = useCallback(async (): Promise<void> => {
    const listPlaylistImportTracks = window.nextdj?.listPlaylistImportTracks

    if (!listPlaylistImportTracks) {
      setPlaylistStatus('Playlist import is not available in this build.')
      return
    }

    setIsImportingPlaylist(true)
    setPlaylistStatus('Reading playlist...')

    try {
      const importTracks = await listPlaylistImportTracks(playlistInput)

      if (importTracks.length === 0) {
        setPlaylistStatus('No tracks were found in this playlist.')
        return
      }

      await onAddPlaylistImportTracks(importTracks)
      setPlaylistStatus(`Listed ${importTracks.length} track${importTracks.length === 1 ? '' : 's'}. Downloads happen on load.`)
      setPlaylistInput('')
    } catch (error) {
      setPlaylistStatus(error instanceof Error ? error.message : 'Could not read this playlist.')
    } finally {
      setIsImportingPlaylist(false)
    }
  }, [onAddPlaylistImportTracks, playlistInput])

  return {
    hasPlaylistImportProviders,
    isImportingPlaylist,
    playlistStatus,
    playlistInput,
    setPlaylistInput,
    handlePlaylistImport
  }
}
