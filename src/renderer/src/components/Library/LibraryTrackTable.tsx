import type { MutableRefObject } from 'react'
import { Cloud } from 'lucide-react'
import type { DeckId } from '../../hooks/useEngine'
import type { LibraryTrack } from '../../hooks/useLibrary'
import { formatBpm, formatTime } from './libraryPanelUtils'

interface LibraryTrackTableProps {
  focusedTrackId: string | null
  keyboardLoadDeckId: DeckId
  rowRefs: MutableRefObject<Record<string, HTMLTableRowElement | null>>
  tracks: LibraryTrack[]
  onDragStart: (event: React.DragEvent<HTMLTableRowElement>, trackId: string) => void
  onFocusTrack: (trackId: string) => void
  onLoadTrack: (deckId: DeckId, track: LibraryTrack) => void
  onRowKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>, track: LibraryTrack) => void
}

export function LibraryTrackTable({
  focusedTrackId,
  keyboardLoadDeckId,
  rowRefs,
  tracks,
  onDragStart,
  onFocusTrack,
  onLoadTrack,
  onRowKeyDown
}: LibraryTrackTableProps): JSX.Element {
  return (
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
            ref={(element) => {
              rowRefs.current[track.id] = element
            }}
            key={track.id}
            aria-label={`${track.title}. Press Enter to load into deck ${keyboardLoadDeckId}`}
            draggable
            tabIndex={focusedTrackId === track.id ? 0 : -1}
            onDragStart={(event) => onDragStart(event, track.id)}
            onFocus={() => onFocusTrack(track.id)}
            onKeyDown={(event) => onRowKeyDown(event, track)}
          >
            <td>
              <span className="library-track-title" title={track.title}>
                <span className="library-track-title-text">{track.title}</span>
                {track.source === 'youtube' && !track.file ? (
                  <span aria-label="Not stored locally" className="library-track-remote" title="Not stored locally">
                    <Cloud aria-hidden="true" size={13} strokeWidth={2.3} />
                  </span>
                ) : null}
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
                  onClick={() => onLoadTrack('A', track)}
                >
                  A
                </button>
                <button
                  className="load-chip load-chip-b"
                  title="Load into deck B"
                  type="button"
                  onClick={() => onLoadTrack('B', track)}
                >
                  B
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
