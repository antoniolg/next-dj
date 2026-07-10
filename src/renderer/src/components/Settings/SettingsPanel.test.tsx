import { render, screen } from '@testing-library/react'
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
})
