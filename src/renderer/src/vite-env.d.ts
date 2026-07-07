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

interface Window {
  nextdj?: {
    appName: string
    downloadYouTubeAudio: (url: string) => Promise<YouTubeDownloadResult>
    listYouTubeTracks: (url: string) => Promise<YouTubeTrackSummary[]>
  }
}
