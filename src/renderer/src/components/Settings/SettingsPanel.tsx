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

export function SettingsPanel({
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <aside className="settings-panel ml-auto h-full w-full max-w-md p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Routing</p>
            <h2 className="text-2xl font-black">Output Devices</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block text-sm font-bold uppercase text-slate-400">
            Master output
            <select
              className="device-select mt-2"
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

          <label className="block text-sm font-bold uppercase text-slate-400">
            Headphones output
            <select
              className="device-select mt-2"
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
            className="transport-button w-full"
            type="button"
            onClick={() => {
              void onRefreshDevices()
            }}
          >
            Refresh Devices
          </button>
        </div>

        {error ? <p className="mt-6 rounded border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{error}</p> : null}
      </aside>
    </div>
  )
}
