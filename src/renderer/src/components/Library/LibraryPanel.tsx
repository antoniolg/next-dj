import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Music, Plus } from 'lucide-react'
import type { DeckId } from '../../hooks/useEngine'
import type { LibraryTrack } from '../../hooks/useLibrary'

interface LibraryPanelProps {
  tracks: LibraryTrack[]
  onAddFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  onLoadTrack: (deckId: DeckId, track: LibraryTrack) => Promise<void>
}

const COLLAPSED_KEY = 'nextdj.library.collapsed'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatBpm(bpm: number): string {
  return bpm > 0 ? bpm.toFixed(1) : '--'
}

export function LibraryPanel({
  tracks,
  onAddFiles,
  onLoadTrack
}: LibraryPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

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

  return (
    <section
      className={`console-panel library-panel ${collapsed ? 'library-collapsed' : ''} ${isDropTarget ? 'library-panel-drop-target' : ''}`}
      onDragLeave={() => setIsDropTarget(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="library-header">
        <div className="library-title">
          <Music size={13} strokeWidth={2.4} />
          <span>Crate</span>
          <span className="library-count">{tracks.length}</span>
        </div>
        <div className="library-actions">
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
            aria-label={collapsed ? 'Expand library' : 'Collapse library'}
            className="icon-button"
            title={collapsed ? 'Expand library' : 'Collapse library'}
            type="button"
            onClick={() => setCollapsed((current) => !current)}
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
        <div className="library-table-wrap">
          {tracks.length === 0 ? (
            <div className="library-empty">
              <Music size={22} strokeWidth={1.6} />
              <p>Drop audio here or add tracks to build your crate.</p>
            </div>
          ) : (
            <table className="library-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th className="library-col-time">Time</th>
                  <th className="library-col-bpm">BPM</th>
                  <th className="library-col-load" aria-label="Load controls" />
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr
                    key={track.id}
                    draggable
                    onDragStart={(event) => handleDragStart(event, track.id)}
                  >
                    <td>
                      <span className="block truncate" title={track.title}>
                        {track.title}
                      </span>
                    </td>
                    <td className="library-col-time">{formatTime(track.duration)}</td>
                    <td className="library-col-bpm">{formatBpm(track.bpm)}</td>
                    <td className="library-col-load">
                      <div className="library-load-chips">
                        <button
                          className="load-chip load-chip-a"
                          title="Load into deck A"
                          type="button"
                          onClick={() => void onLoadTrack('A', track)}
                        >
                          A
                        </button>
                        <button
                          className="load-chip load-chip-b"
                          title="Load into deck B"
                          type="button"
                          onClick={() => void onLoadTrack('B', track)}
                        >
                          B
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
