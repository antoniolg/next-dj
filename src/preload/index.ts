import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

export interface YouTubeAudioFile {
  data: ArrayBuffer
  name: string
  lastModified: number
}

export interface YouTubeDownloadResult {
  file: YouTubeAudioFile | null
  outputDirectory: string
}

export interface YouTubeTrackSummary {
  id: string
  title: string
  duration: number
  url: string
}

export interface RecordingStartResult {
  id: string
  filePath: string
}

export interface RecordingStopResult {
  filePath: string
  bytes: number
}

export interface RecordingWriteError {
  id: string
  message: string
}

contextBridge.exposeInMainWorld('nextdj', {
  appName: 'NextDJ',
  downloadYouTubeAudio: (url: string): Promise<YouTubeDownloadResult> => ipcRenderer.invoke('youtube:download-audio', url),
  listYouTubeTracks: (url: string): Promise<YouTubeTrackSummary[]> => ipcRenderer.invoke('youtube:list-tracks', url),
  startRecording: (options: { extension: string; video: boolean }): Promise<RecordingStartResult> =>
    ipcRenderer.invoke('recording:start', options),
  appendRecordingChunk: (id: string, chunk: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('recording:append-chunk', id, chunk),
  stopRecording: (id: string): Promise<RecordingStopResult> => ipcRenderer.invoke('recording:stop', id),
  cancelRecording: (id: string, deleteFile: boolean): Promise<void> =>
    ipcRenderer.invoke('recording:cancel', id, deleteFile),
  revealRecording: (filePath: string): Promise<void> => ipcRenderer.invoke('recording:reveal', filePath),
  onRecordingWriteError: (callback: (error: RecordingWriteError) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, error: RecordingWriteError): void => callback(error)
    ipcRenderer.on('recording:write-error', listener)
    return () => ipcRenderer.removeListener('recording:write-error', listener)
  }
})
