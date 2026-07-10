import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from './SettingsPanel'

describe('SettingsPanel', () => {
  it('renders output errors when open', () => {
    render(
      <SettingsPanel
        cue={{ activeDeviceId: 'default', requestedDeviceId: 'default', pending: false, error: null }}
        devices={[]}
        deviceListError="Could not list outputs."
        master={{ activeDeviceId: 'default', requestedDeviceId: 'default', pending: false, error: null }}
        open
        onClose={vi.fn()}
        onCueDeviceChange={vi.fn()}
        onMasterDeviceChange={vi.fn()}
        onRefreshDevices={vi.fn()}
      />
    )

    expect(screen.getByText('Could not list outputs.')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <SettingsPanel
        cue={{ activeDeviceId: 'default', requestedDeviceId: 'default', pending: false, error: null }}
        devices={[]}
        deviceListError={null}
        master={{ activeDeviceId: 'default', requestedDeviceId: 'default', pending: false, error: null }}
        open={false}
        onClose={vi.fn()}
        onCueDeviceChange={vi.fn()}
        onMasterDeviceChange={vi.fn()}
        onRefreshDevices={vi.fn()}
      />
    )

    expect(screen.queryByText('Output Devices')).not.toBeInTheDocument()
  })

  it('exposes modal semantics, moves focus, and closes with Escape', async () => {
    const onClose = vi.fn()

    render(
      <SettingsPanel
        cue={{ activeDeviceId: 'default', requestedDeviceId: 'default', pending: false, error: null }}
        devices={[]}
        deviceListError={null}
        master={{ activeDeviceId: 'default', requestedDeviceId: 'default', pending: false, error: null }}
        open
        onClose={onClose}
        onCueDeviceChange={vi.fn()}
        onMasterDeviceChange={vi.fn()}
        onRefreshDevices={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Output Devices' })).toHaveAttribute('aria-modal', 'true')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close settings' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
