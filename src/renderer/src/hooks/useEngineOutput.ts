import { useCallback, useEffect, useState } from 'react'
import type { DJEngine } from '../audio/engine'
import type { OutputState } from './engineTypes'

export const MASTER_OUTPUT_STORAGE_KEY = 'nextdj.masterOutputDeviceId'
export const CUE_OUTPUT_STORAGE_KEY = 'nextdj.cueOutputDeviceId'

export function useEngineOutput(engine: DJEngine): {
  output: OutputState
  setMasterDevice: (deviceId: string) => void
  setCueDevice: (deviceId: string) => void
  refreshOutputDevices: () => Promise<void>
} {
  const [output, setOutput] = useState<OutputState>({
    devices: [],
    masterDeviceId: 'default',
    cueDeviceId: 'default',
    error: null
  })

  const refreshOutputDevices = useCallback(async (): Promise<void> => {
    try {
      const devices = await engine.outputRouter.listOutputDevices()
      setOutput((current) => ({ ...current, devices, error: null }))
    } catch (error) {
      setOutput((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not list audio outputs.'
      }))
    }
  }, [engine])

  useEffect(() => {
    const masterDeviceId = localStorage.getItem(MASTER_OUTPUT_STORAGE_KEY) ?? 'default'
    const cueDeviceId = localStorage.getItem(CUE_OUTPUT_STORAGE_KEY) ?? 'default'

    setOutput((current) => ({ ...current, masterDeviceId, cueDeviceId }))

    void engine.outputRouter.setMasterDevice(masterDeviceId).catch((error: unknown) => {
      setOutput((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not set master output.'
      }))
    })
    void engine.outputRouter.setCueDevice(cueDeviceId).catch((error: unknown) => {
      setOutput((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not set headphones output.'
      }))
    })
    void refreshOutputDevices()
  }, [engine, refreshOutputDevices])

  const setMasterDevice = useCallback(
    (deviceId: string): void => {
      setOutput((current) => ({ ...current, masterDeviceId: deviceId }))
      localStorage.setItem(MASTER_OUTPUT_STORAGE_KEY, deviceId)
      void engine.outputRouter
        .setMasterDevice(deviceId)
        .then(() => setOutput((current) => ({ ...current, error: null })))
        .catch((error: unknown) => {
          setOutput((current) => ({
            ...current,
            error: error instanceof Error ? error.message : 'Could not set master output.'
          }))
        })
    },
    [engine]
  )

  const setCueDevice = useCallback(
    (deviceId: string): void => {
      setOutput((current) => ({ ...current, cueDeviceId: deviceId }))
      localStorage.setItem(CUE_OUTPUT_STORAGE_KEY, deviceId)
      void engine.outputRouter
        .setCueDevice(deviceId)
        .then(() => setOutput((current) => ({ ...current, error: null })))
        .catch((error: unknown) => {
          setOutput((current) => ({
            ...current,
            error: error instanceof Error ? error.message : 'Could not set headphones output.'
          }))
        })
    },
    [engine]
  )

  return { output, setMasterDevice, setCueDevice, refreshOutputDevices }
}
