import { useCallback, useRef, useState } from 'react'
import type { DeckId } from '../../hooks/useEngine'
import type { LibraryTrack } from '../../hooks/useLibrary'

interface LibraryPanelProps {
  tracks: LibraryTrack[]
  onAddFiles: (files: File[] | FileList) => Promise<LibraryTrack[]>
  onLoadTrack: (deckId: DeckId, track: LibraryTrack) => Promise<void>
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function LibraryPanel({
  tracks,
  onAddFiles,
  onLoadTrack
}: LibraryPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)

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
      className={`console-panel library-panel ${isDropTarget ? 'library-panel-drop-target' : ''}`}
      onDragLeave={() => setIsDropTarget(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">Track library</p>
          <h2 className="text-2xl font-black leading-none text-white">Crate</h2>
        </div>
        <button className="load-button" type="button" onClick={() => inputRef.current?.click()}>
          Add tracks
        </button>
        <input
          ref={inputRef}
          multiple
          accept="audio/*"
          className="sr-only"
          type="file"
          onChange={handleFileChange}
        />
      </div>

      <div className="library-table-wrap mt-4">
        <table className="library-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Duration</th>
              <th>BPM</th>
              <th aria-label="Load controls" />
            </tr>
          </thead>
          <tbody>
            {tracks.length === 0 ? (
              <tr>
                <td className="library-empty" colSpan={4}>
                  Drop audio here or add tracks to build your crate.
                </td>
              </tr>
            ) : (
              tracks.map((track) => (
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
                  <td>{formatTime(track.duration)}</td>
                  <td>—</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button
                        className="library-load-button"
                        type="button"
                        onClick={() => void onLoadTrack('A', track)}
                      >
                        Load A
                      </button>
                      <button
                        className="library-load-button"
                        type="button"
                        onClick={() => void onLoadTrack('B', track)}
                      >
                        Load B
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
