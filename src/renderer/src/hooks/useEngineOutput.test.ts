import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DJEngine } from '../audio/engine'
import { CUE_OUTPUT_STORAGE_KEY, MASTER_OUTPUT_STORAGE_KEY, useEngineOutput } from './useEngineOutput'

function createEngine(overrides: Partial<DJEngine['outputRouter']> = {}): DJEngine {
  return {
    outputRouter: {
      listOutputDevices: vi.fn().mockResolvedValue([{ deviceId: 'default', label: 'Default' }]),
      setMasterDevice: vi.fn().mockResolvedValue(undefined),
      setCueDevice: vi.fn().mockResolvedValue(undefined),
      ...overrides
    }
  } as unknown as DJEngine
}

describe('useEngineOutput', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('restores persisted devices and lists outputs on mount', async () => {
    localStorage.setItem(MASTER_OUTPUT_STORAGE_KEY, 'speakers')
    localStorage.setItem(CUE_OUTPUT_STORAGE_KEY, 'headphones')
    const engine = createEngine()

    const { result } = renderHook(() => useEngineOutput(engine))

    await waitFor(() => expect(result.current.output.devices).toHaveLength(1))
    expect(result.current.output.masterDeviceId).toBe('speakers')
    expect(result.current.output.cueDeviceId).toBe('headphones')
    expect(engine.outputRouter.setMasterDevice).toHaveBeenCalledWith('speakers')
    expect(engine.outputRouter.setCueDevice).toHaveBeenCalledWith('headphones')
  })

  it('persists and applies explicit master and cue device changes', async () => {
    const engine = createEngine()
    const { result } = renderHook(() => useEngineOutput(engine))

    act(() => {
      result.current.setMasterDevice('speakers')
      result.current.setCueDevice('headphones')
    })

    await waitFor(() => {
      expect(engine.outputRouter.setMasterDevice).toHaveBeenCalledWith('speakers')
      expect(engine.outputRouter.setCueDevice).toHaveBeenCalledWith('headphones')
    })
    expect(localStorage.getItem(MASTER_OUTPUT_STORAGE_KEY)).toBe('speakers')
    expect(localStorage.getItem(CUE_OUTPUT_STORAGE_KEY)).toBe('headphones')
  })

  it('surfaces output listing errors without dropping current devices', async () => {
    const engine = createEngine({
      listOutputDevices: vi.fn().mockRejectedValue(new Error('No permission'))
    })

    const { result } = renderHook(() => useEngineOutput(engine))

    await waitFor(() => expect(result.current.output.error).toBe('No permission'))
  })

  it('surfaces device routing errors', async () => {
    const engine = createEngine({
      setMasterDevice: vi.fn().mockRejectedValue(new Error('Bad master'))
    })
    const { result } = renderHook(() => useEngineOutput(engine))

    act(() => {
      result.current.setMasterDevice('broken')
    })

    await waitFor(() => expect(result.current.output.error).toBe('Bad master'))
  })
})
