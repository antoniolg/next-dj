import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: electronMock.exposeInMainWorld
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
    on: electronMock.on,
    removeListener: electronMock.removeListener
  }
}))

describe('preload bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    electronMock.exposeInMainWorld.mockClear()
    electronMock.invoke.mockReset()
    electronMock.on.mockClear()
    electronMock.removeListener.mockClear()
  })

  it('exposes the stable nextdj bridge contract', async () => {
    await import('./index.js')

    expect(electronMock.exposeInMainWorld).toHaveBeenCalledWith(
      'nextdj',
      expect.objectContaining({
        appName: 'NextDJ',
        downloadYouTubeAudio: expect.any(Function),
        listYouTubeTracks: expect.any(Function),
        startRecording: expect.any(Function),
        appendRecordingChunk: expect.any(Function),
        stopRecording: expect.any(Function),
        cancelRecording: expect.any(Function),
        revealRecording: expect.any(Function),
        onRecordingWriteError: expect.any(Function)
      })
    )
  })

  it('routes bridge calls to IPC channels without changing their names', async () => {
    electronMock.invoke.mockResolvedValue(undefined)
    await import('./index.js')
    const bridge = electronMock.exposeInMainWorld.mock.calls[0][1]
    const chunk = new ArrayBuffer(8)

    await bridge.downloadYouTubeAudio('https://youtube.com/watch?v=abc')
    await bridge.listYouTubeTracks('https://music.youtube.com/playlist?list=abc')
    await bridge.startRecording({ extension: 'webm', video: false })
    await bridge.appendRecordingChunk('recording-1', chunk)
    await bridge.stopRecording('recording-1')
    await bridge.cancelRecording('recording-1', true)
    await bridge.revealRecording('/tmp/set.webm')

    expect(electronMock.invoke).toHaveBeenNthCalledWith(1, 'youtube:download-audio', 'https://youtube.com/watch?v=abc')
    expect(electronMock.invoke).toHaveBeenNthCalledWith(2, 'youtube:list-tracks', 'https://music.youtube.com/playlist?list=abc')
    expect(electronMock.invoke).toHaveBeenNthCalledWith(3, 'recording:start', { extension: 'webm', video: false })
    expect(electronMock.invoke).toHaveBeenNthCalledWith(4, 'recording:append-chunk', 'recording-1', chunk)
    expect(electronMock.invoke).toHaveBeenNthCalledWith(5, 'recording:stop', 'recording-1')
    expect(electronMock.invoke).toHaveBeenNthCalledWith(6, 'recording:cancel', 'recording-1', true)
    expect(electronMock.invoke).toHaveBeenNthCalledWith(7, 'recording:reveal', '/tmp/set.webm')
  })

  it('returns an unsubscribe function for recording write errors', async () => {
    await import('./index.js')
    const bridge = electronMock.exposeInMainWorld.mock.calls[0][1]
    const callback = vi.fn()

    const unsubscribe = bridge.onRecordingWriteError(callback)
    const listener = electronMock.on.mock.calls[0][1]

    listener({}, { id: 'recording-1', message: 'disk full' })
    unsubscribe()

    expect(electronMock.on).toHaveBeenCalledWith('recording:write-error', expect.any(Function))
    expect(callback).toHaveBeenCalledWith({ id: 'recording-1', message: 'disk full' })
    expect(electronMock.removeListener).toHaveBeenCalledWith('recording:write-error', listener)
  })
})
