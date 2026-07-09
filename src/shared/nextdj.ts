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

export interface RecordingStartOptions {
  extension: string
  video: boolean
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

export interface NextDjBridge {
  appName: string
  downloadYouTubeAudio: (url: string) => Promise<YouTubeDownloadResult>
  listYouTubeTracks: (url: string) => Promise<YouTubeTrackSummary[]>
  startRecording: (options: RecordingStartOptions) => Promise<RecordingStartResult>
  appendRecordingChunk: (id: string, chunk: ArrayBuffer) => Promise<void>
  stopRecording: (id: string) => Promise<RecordingStopResult>
  cancelRecording: (id: string, deleteFile: boolean) => Promise<void>
  revealRecording: (filePath: string) => Promise<void>
  onRecordingWriteError: (callback: (error: RecordingWriteError) => void) => () => void
}
