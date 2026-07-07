import { contextBridge, ipcRenderer } from 'electron'

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

contextBridge.exposeInMainWorld('nextdj', {
  appName: 'NextDJ',
  downloadYouTubeAudio: (url: string): Promise<YouTubeDownloadResult> => ipcRenderer.invoke('youtube:download-audio', url),
  listYouTubeTracks: (url: string): Promise<YouTubeTrackSummary[]> => ipcRenderer.invoke('youtube:list-tracks', url)
})
