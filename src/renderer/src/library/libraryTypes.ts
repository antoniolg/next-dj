export interface LibraryTrack {
  id: string
  title: string
  duration: number
  bpm: number
  firstBeatOffset: number
  file?: File
  source: 'local' | 'youtube'
  youtubeUrl?: string
}

export interface PersistedTrack {
  id: string
  title: string
  duration: number
  bpm: number
  firstBeatOffset: number
  source: 'local' | 'youtube'
  youtubeUrl?: string
  fileName?: string
  fileType?: string
  fileLastModified?: number
  hasFile: boolean
}
