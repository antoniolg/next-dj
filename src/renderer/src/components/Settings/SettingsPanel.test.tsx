import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from './SettingsPanel'

describe('SettingsPanel', () => {
  it('renders output errors when open', () => {
    render(
      <SettingsPanel
        cueDeviceId="default"
        devices={[]}
        error="Could not set headphones output."
        masterDeviceId="default"
        open
        onClose={vi.fn()}
        onCueDeviceChange={vi.fn()}
        onMasterDeviceChange={vi.fn()}
        onRefreshDevices={vi.fn()}
      />
    )

    expect(screen.getByText('Could not set headphones output.')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <SettingsPanel
        cueDeviceId="default"
        devices={[]}
        error={null}
        masterDeviceId="default"
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
