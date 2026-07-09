import { useCallback, useState } from 'react'
import type { LibraryTrack } from '../../hooks/useLibrary'

interface UseYouTubeImportOptions {
  onAddYouTubeTracks: (youtubeTracks: YouTubeTrackSummary[]) => LibraryTrack[]
}

interface YouTubeImportState {
  isImportingYoutube: boolean
  youtubeStatus: string | null
  youtubeUrl: string
  setYoutubeUrl: (url: string) => void
  handleYoutubeImport: () => Promise<void>
}

export function useYouTubeImport({ onAddYouTubeTracks }: UseYouTubeImportOptions): YouTubeImportState {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeStatus, setYoutubeStatus] = useState<string | null>(null)
  const [isImportingYoutube, setIsImportingYoutube] = useState(false)

  const handleYoutubeImport = useCallback(async (): Promise<void> => {
    const listYouTubeTracks = window.nextdj?.listYouTubeTracks

    if (!listYouTubeTracks) {
      setYoutubeStatus('YouTube import is not available in this build.')
      return
    }

    setIsImportingYoutube(true)
    setYoutubeStatus('Reading playlist...')

    try {
      const youtubeTracks = await listYouTubeTracks(youtubeUrl)

      if (youtubeTracks.length === 0) {
        setYoutubeStatus('No tracks were found in this playlist.')
        return
      }

      onAddYouTubeTracks(youtubeTracks)
      setYoutubeStatus(`Listed ${youtubeTracks.length} track${youtubeTracks.length === 1 ? '' : 's'}. Downloads happen on load.`)
      setYoutubeUrl('')
    } catch (error) {
      setYoutubeStatus(error instanceof Error ? error.message : 'Could not read this playlist.')
    } finally {
      setIsImportingYoutube(false)
    }
  }, [onAddYouTubeTracks, youtubeUrl])

  return {
    isImportingYoutube,
    youtubeStatus,
    youtubeUrl,
    setYoutubeUrl,
    handleYoutubeImport
  }
}
