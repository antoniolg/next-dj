import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LibraryTrack } from '../../hooks/useLibrary'
import { LibraryPanel } from './LibraryPanel'

const tracks: LibraryTrack[] = [
  {
    id: 'track-a',
    title: 'First Track',
    duration: 75,
    bpm: 124,
    firstBeatOffset: 0,
    source: 'local'
  },
  {
    id: 'track-b',
    title: 'Second Track',
    duration: 90,
    bpm: 126,
    firstBeatOffset: 0.2,
    source: 'local'
  }
]

function renderPanel(overrides: Partial<Parameters<typeof LibraryPanel>[0]> = {}) {
  return render(
    <LibraryPanel
      keyboardLoadDeckId="A"
      tracks={tracks}
      onAddFiles={vi.fn().mockResolvedValue([])}
      onAddYouTubeTracks={vi.fn()}
      onLoadTrack={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />
  )
}

describe('LibraryPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    delete window.nextdj
    localStorage.clear()
  })

  it('loads focused tracks from the expanded crate keyboard flow', async () => {
    const onLoadTrack = vi.fn().mockResolvedValue(undefined)
    renderPanel({ keyboardLoadDeckId: 'B', onLoadTrack })

    fireEvent.click(screen.getByRole('button', { name: 'Expand crate' }))

    const firstRow = await screen.findByLabelText('First Track. Press Enter to load into deck B')
    fireEvent.keyDown(firstRow, { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByLabelText('Second Track. Press Enter to load into deck B'), { key: 'Enter' })

    expect(onLoadTrack).toHaveBeenCalledWith('B', tracks[1])
    expect(screen.getByRole('button', { name: 'Expand crate' })).toBeInTheDocument()
  })

  it('adds files from the hidden file input and drop target', () => {
    const onAddFiles = vi.fn().mockResolvedValue([])
    const { container } = renderPanel({ onAddFiles })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['audio'], 'set.wav', { type: 'audio/wav' })

    fireEvent.change(input, { target: { files: [file] } })

    expect(onAddFiles).toHaveBeenCalledWith([file])

    const droppedFiles = [new File(['more-audio'], 'drop.wav', { type: 'audio/wav' })]
    fireEvent.drop(container.querySelector('.library-panel') as HTMLElement, {
      dataTransfer: { files: droppedFiles }
    })

    expect(onAddFiles).toHaveBeenLastCalledWith(droppedFiles)
  })

  it('imports YouTube playlists through the desktop bridge', async () => {
    const onAddYouTubeTracks = vi.fn()
    const youtubeTracks = [
      { id: 'abc', title: 'Playlist Track', duration: 180, url: 'https://youtube.com/watch?v=abc' }
    ]

    window.nextdj = {
      appName: 'NextDJ',
      downloadYouTubeAudio: vi.fn(),
      listYouTubeTracks: vi.fn().mockResolvedValue(youtubeTracks),
      startRecording: vi.fn(),
      appendRecordingChunk: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      revealRecording: vi.fn(),
      onRecordingWriteError: vi.fn()
    }

    renderPanel({ onAddYouTubeTracks })

    fireEvent.click(screen.getByRole('button', { name: 'Import YouTube Music' }))
    fireEvent.change(screen.getByLabelText('YouTube Music playlist URL'), {
      target: { value: 'https://music.youtube.com/playlist?list=abc' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(window.nextdj?.listYouTubeTracks).toHaveBeenCalledWith('https://music.youtube.com/playlist?list=abc'))
    expect(onAddYouTubeTracks).toHaveBeenCalledWith(youtubeTracks)
    expect(await screen.findByText('Listed 1 track. Downloads happen on load.')).toBeInTheDocument()
  })

  it('persists collapsed state without hiding controls permanently', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Hide crate' }))

    expect(localStorage.getItem('nextdj.library.collapsed')).toBe('1')
    expect(screen.queryByText('First Track')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show crate' }))

    expect(localStorage.getItem('nextdj.library.collapsed')).toBe('0')
    expect(screen.getByText('First Track')).toBeInTheDocument()
  })
})
