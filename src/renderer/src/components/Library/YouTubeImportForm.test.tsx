import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { YouTubeImportForm } from './YouTubeImportForm'

describe('YouTubeImportForm', () => {
  it('submits only when a URL is present', () => {
    const onSubmit = vi.fn()

    render(<YouTubeImportForm disabled={false} status={null} url="" onSubmit={onSubmit} onUrlChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('reports URL changes and submit events', () => {
    const onSubmit = vi.fn()
    const onUrlChange = vi.fn()

    render(
      <YouTubeImportForm
        disabled={false}
        status="Ready"
        url="https://music.youtube.com/playlist"
        onSubmit={onSubmit}
        onUrlChange={onUrlChange}
      />
    )

    fireEvent.change(screen.getByLabelText('YouTube Music playlist URL'), {
      target: { value: 'https://youtube.com/watch?v=abc' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    expect(onUrlChange).toHaveBeenCalledWith('https://youtube.com/watch?v=abc')
    expect(onSubmit).toHaveBeenCalled()
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('reflects the importing state', () => {
    render(
      <YouTubeImportForm
        disabled
        status="Reading playlist..."
        url="https://music.youtube.com/playlist"
        onSubmit={vi.fn()}
        onUrlChange={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Reading' })).toBeDisabled()
    expect(screen.getByLabelText('YouTube Music playlist URL')).toBeDisabled()
  })
})
