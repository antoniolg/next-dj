import { memo } from 'react'
import { Headphones, RefreshCw, Volume2, X } from 'lucide-react'
import type { OutputDeviceInfo } from '../../audio/output'

interface SettingsPanelProps {
  open: boolean
  devices: OutputDeviceInfo[]
  masterDeviceId: string
  cueDeviceId: string
  error: string | null
  onClose: () => void
  onMasterDeviceChange: (deviceId: string) => void
  onCueDeviceChange: (deviceId: string) => void
  onRefreshDevices: () => Promise<void>
}

export const SettingsPanel = memo(function SettingsPanel({
  open,
  devices,
  masterDeviceId,
  cueDeviceId,
  error,
  onClose,
  onMasterDeviceChange,
  onCueDeviceChange,
  onRefreshDevices
}: SettingsPanelProps): JSX.Element | null {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="settings-panel ml-auto flex h-full w-full max-w-md flex-col p-6 text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="micro-label">Routing</p>
            <h2 className="text-xl font-bold">Output Devices</h2>
          </div>
          <button aria-label="Close settings" className="icon-button" title="Close" type="button" onClick={onClose}>
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <label className="settings-field">
            <span className="settings-field-label">
              <Volume2 size={14} strokeWidth={2.2} />
              Master output
            </span>
            <select
              className="device-select"
              value={masterDeviceId}
              onChange={(event) => onMasterDeviceChange(event.currentTarget.value)}
            >
              {devices.length === 0 ? <option value="default">System default</option> : null}
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span className="settings-field-label">
              <Headphones size={14} strokeWidth={2.2} />
              Headphones output
            </span>
            <select
              className="device-select"
              value={cueDeviceId}
              onChange={(event) => onCueDeviceChange(event.currentTarget.value)}
            >
              {devices.length === 0 ? <option value="default">System default</option> : null}
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="led-button w-full justify-center"
            type="button"
            onClick={() => {
              void onRefreshDevices()
            }}
          >
            <RefreshCw size={13} strokeWidth={2.4} />
            Refresh devices
          </button>
        </div>

        {error ? (
          <p className="mt-6 rounded border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{error}</p>
        ) : null}
      </aside>
    </div>
  )
})
