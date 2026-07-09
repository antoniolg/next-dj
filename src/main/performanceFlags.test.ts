import { describe, expect, it } from 'vitest'
import {
  appendRendererPerfFlag,
  isRendererPerfEnabled,
  readPerfRecordingsDir,
  readPerfUserDataDir,
  readRemoteDebuggingPort
} from './performanceFlags.js'

describe('main performance flags', () => {
  it('accepts valid remote debugging ports only', () => {
    expect(readRemoteDebuggingPort('9222')).toBe(9222)
    expect(readRemoteDebuggingPort('1023')).toBeNull()
    expect(readRemoteDebuggingPort('65536')).toBeNull()
    expect(readRemoteDebuggingPort('abc')).toBeNull()
    expect(readRemoteDebuggingPort('')).toBeNull()
  })

  it('enables renderer perf tracing only with the explicit flag', () => {
    expect(isRendererPerfEnabled('1')).toBe(true)
    expect(isRendererPerfEnabled('true')).toBe(false)
    expect(isRendererPerfEnabled(undefined)).toBe(false)
  })

  it('accepts an explicit temporary user data directory for perf runs', () => {
    expect(readPerfUserDataDir('/tmp/nextdj-perf')).toBe('/tmp/nextdj-perf')
    expect(readPerfUserDataDir('')).toBeNull()
    expect(readPerfUserDataDir('   ')).toBeNull()
    expect(readPerfUserDataDir(undefined)).toBeNull()
  })

  it('accepts an explicit temporary recordings directory for perf runs', () => {
    expect(readPerfRecordingsDir('/tmp/nextdj-recordings')).toBe('/tmp/nextdj-recordings')
    expect(readPerfRecordingsDir('')).toBeNull()
    expect(readPerfRecordingsDir('   ')).toBeNull()
    expect(readPerfRecordingsDir(undefined)).toBeNull()
  })

  it('appends the renderer perf query only when enabled', () => {
    expect(appendRendererPerfFlag('http://localhost:5173/', false)).toBe('http://localhost:5173/')
    expect(appendRendererPerfFlag('http://localhost:5173/', true)).toBe('http://localhost:5173/?nextdjPerf=1')
    expect(appendRendererPerfFlag('http://localhost:5173/?foo=bar', true)).toBe(
      'http://localhost:5173/?foo=bar&nextdjPerf=1'
    )
  })
})
