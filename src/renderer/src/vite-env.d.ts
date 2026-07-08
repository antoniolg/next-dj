interface YouTubeAudioFile {
  data: ArrayBuffer
  name: string
  lastModified: number
}

interface YouTubeDownloadResult {
  file: YouTubeAudioFile | null
  outputDirectory: string
}

interface YouTubeTrackSummary {
  id: string
  title: string
  duration: number
  url: string
}

interface RecordingStartResult {
  id: string
  filePath: string
}

interface RecordingStopResult {
  filePath: string
  bytes: number
}

interface RecordingWriteError {
  id: string
  message: string
}

interface Window {
  nextdj?: {
    appName: string
    downloadYouTubeAudio: (url: string) => Promise<YouTubeDownloadResult>
    listYouTubeTracks: (url: string) => Promise<YouTubeTrackSummary[]>
    startRecording: (options: { extension: string; video: boolean }) => Promise<RecordingStartResult>
    appendRecordingChunk: (id: string, chunk: ArrayBuffer) => Promise<void>
    stopRecording: (id: string) => Promise<RecordingStopResult>
    cancelRecording: (id: string, deleteFile: boolean) => Promise<void>
    revealRecording: (filePath: string) => Promise<void>
    onRecordingWriteError: (callback: (error: RecordingWriteError) => void) => () => void
  }
}
