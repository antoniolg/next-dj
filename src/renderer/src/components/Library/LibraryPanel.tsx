import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Info, Link, Maximize2, Minimize2, Music, Plus } from 'lucide-react'
import type { DeckId } from '../../hooks/useEngine'
import type { LibraryTrack } from '../../hooks/useLibrary'
import { LibraryTrackTable } from './LibraryTrackTable'
import { YouTubeImportForm } from './YouTubeImportForm'
import { isEditableTarget } from './libraryPanelUtils'

interface LibraryPanelProps {
  tracks: LibraryTrack[]
  keyboardLoadDeckId: DeckId
  onAddFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  onAddYouTubeTracks: (youtubeTracks: YouTubeTrackSummary[]) => LibraryTrack[]
  onLoadTrack: (deckId: DeckId, track: LibraryTrack) => Promise<void>
}

const COLLAPSED_KEY = 'nextdj.library.collapsed'

export function LibraryPanel({
  tracks,
  keyboardLoadDeckId,
  onAddFiles,
  onAddYouTubeTracks,
  onLoadTrack
}: LibraryPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const [isDropTarget, setIsDropTarget] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')
  const [expanded, setExpanded] = useState(false)
  const [focusedTrackId, setFocusedTrackId] = useState<string | null>(null)
  const [youtubeOpen, setYoutubeOpen] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeStatus, setYoutubeStatus] = useState<string | null>(null)
  const [isImportingYoutube, setIsImportingYoutube] = useState(false)

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const toggleExpanded = useCallback((): void => {
    setExpanded((current) => {
      const nextExpanded = !current

      if (nextExpanded) {
        setCollapsed(false)
      }

      return nextExpanded
    })
  }, [])

  useEffect(() => {
    setFocusedTrackId((current) => {
      if (tracks.length === 0) {
        return null
      }

      return current && tracks.some((track) => track.id === current) ? current : tracks[0].id
    })
  }, [tracks])

  useEffect(() => {
    if (!expanded || tracks.length === 0) {
      return
    }

    const nextFocusedTrackId =
      focusedTrackId && tracks.some((track) => track.id === focusedTrackId)
        ? focusedTrackId
        : tracks[0].id

    if (nextFocusedTrackId !== focusedTrackId) {
      setFocusedTrackId(nextFocusedTrackId)
    }

    window.requestAnimationFrame(() => {
      rowRefs.current[nextFocusedTrackId]?.focus()
    })
  }, [expanded, focusedTrackId, tracks])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target) || event.repeat) {
        return
      }

      if (event.code === 'KeyK') {
        event.preventDefault()
        toggleExpanded()
        return
      }

      if (expanded && event.key === 'Escape') {
        event.preventDefault()
        setExpanded(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded, toggleExpanded])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const files = event.currentTarget.files

      if (files) {
        void onAddFiles(files)
      }

      event.currentTarget.value = ''
    },
    [onAddFiles]
  )

  const focusTrackAtIndex = useCallback(
    (index: number): void => {
      const track = tracks[index]

      if (!track) {
        return
      }

      setFocusedTrackId(track.id)
      rowRefs.current[track.id]?.focus()
    },
    [tracks]
  )

  const loadTrackFromKeyboard = useCallback(
    (track: LibraryTrack): void => {
      setExpanded(false)
      void onLoadTrack(keyboardLoadDeckId, track)
    },
    [keyboardLoadDeckId, onLoadTrack]
  )

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, track: LibraryTrack): void => {
      if (event.target !== event.currentTarget) {
        return
      }

      const currentIndex = tracks.findIndex((item) => item.id === track.id)

      if (currentIndex < 0) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        loadTrackFromKeyboard(track)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusTrackAtIndex(Math.min(tracks.length - 1, currentIndex + 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusTrackAtIndex(Math.max(0, currentIndex - 1))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        focusTrackAtIndex(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        focusTrackAtIndex(tracks.length - 1)
      }
    },
    [focusTrackAtIndex, loadTrackFromKeyboard, tracks]
  )

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLTableRowElement>, trackId: string): void => {
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData('text/plain', trackId)
    },
    []
  )

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault()
      setIsDropTarget(true)
    }
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>): void => {
      event.preventDefault()
      setIsDropTarget(false)

      if (event.dataTransfer.files.length > 0) {
        void onAddFiles(event.dataTransfer.files)
      }
    },
    [onAddFiles]
  )

  const handleCollapsedToggle = useCallback((): void => {
    setExpanded(false)
    setCollapsed((current) => !current)
  }, [])

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

  return (
    <section
      className={`console-panel library-panel ${collapsed ? 'library-collapsed' : ''} ${expanded ? 'library-expanded' : ''} ${isDropTarget ? 'library-panel-drop-target' : ''}`}
      onDragLeave={() => setIsDropTarget(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="library-header">
        <div className="library-title">
          <Music size={13} strokeWidth={2.4} />
          <span>Crate</span>
          <span className="library-info" title={`${tracks.length} tracks`}>
            <Info size={13} strokeWidth={2.2} />
          </span>
        </div>
        <div className="library-actions">
          <button
            aria-label="Import YouTube Music"
            className={`icon-button ${youtubeOpen ? 'icon-button-active' : ''}`}
            title="Import YouTube Music"
            type="button"
            onClick={() => setYoutubeOpen((current) => !current)}
          >
            <Link size={15} strokeWidth={2.4} />
          </button>
          <button
            aria-label="Add tracks"
            className="icon-button"
            title="Add tracks"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Plus size={15} strokeWidth={2.4} />
          </button>
          <button
            aria-label={expanded ? 'Shrink crate' : 'Expand crate'}
            className={`icon-button ${expanded ? 'icon-button-active' : ''}`}
            title={expanded ? 'Shrink crate (K)' : 'Expand crate (K)'}
            type="button"
            onClick={toggleExpanded}
          >
            {expanded ? <Minimize2 size={15} strokeWidth={2.4} /> : <Maximize2 size={15} strokeWidth={2.4} />}
          </button>
          <button
            aria-label={collapsed ? 'Show crate' : 'Hide crate'}
            className="icon-button"
            title={collapsed ? 'Show crate' : 'Hide crate'}
            type="button"
            onClick={handleCollapsedToggle}
          >
            {collapsed ? <ChevronUp size={15} strokeWidth={2.4} /> : <ChevronDown size={15} strokeWidth={2.4} />}
          </button>
        </div>
        <input
          ref={inputRef}
          multiple
          accept="audio/*"
          className="sr-only"
          type="file"
          onChange={handleFileChange}
        />
      </div>

      {collapsed ? null : (
        <>
          {youtubeOpen ? (
            <YouTubeImportForm
              disabled={isImportingYoutube}
              status={youtubeStatus}
              url={youtubeUrl}
              onSubmit={() => void handleYoutubeImport()}
              onUrlChange={setYoutubeUrl}
            />
          ) : null}

          <div className="library-table-wrap">
            {tracks.length === 0 ? (
              <div className="library-empty">
                <Music size={22} strokeWidth={1.6} />
                <p>Drop audio here or add tracks to build your crate.</p>
              </div>
            ) : (
              <LibraryTrackTable
                focusedTrackId={focusedTrackId}
                keyboardLoadDeckId={keyboardLoadDeckId}
                rowRefs={rowRefs}
                tracks={tracks}
                onDragStart={handleDragStart}
                onFocusTrack={setFocusedTrackId}
                onLoadTrack={(deckId, track) => void onLoadTrack(deckId, track)}
                onRowKeyDown={handleRowKeyDown}
              />
            )}
          </div>
        </>
      )}
    </section>
  )
}
