export interface PlaylistImportFile {
  data: ArrayBuffer
  name: string
  lastModified: number
  type?: string
}

export interface PlaylistImportResolvedFile {
  file: PlaylistImportFile | null
  outputDirectory: string
}

export interface PlaylistImportProviderSummary {
  id: string
  displayName: string
}

export interface PlaylistImportTrack {
  providerId: string
  id: string
  title: string
  duration: number
  externalRef: string
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
  listPlaylistImportProviders: () => Promise<PlaylistImportProviderSummary[]>
  listPlaylistImportTracks: (input: string) => Promise<PlaylistImportTrack[]>
  resolvePlaylistImportTrack: (providerId: string, externalRef: string) => Promise<PlaylistImportResolvedFile>
  startRecording: (options: RecordingStartOptions) => Promise<RecordingStartResult>
  appendRecordingChunk: (id: string, chunk: ArrayBuffer) => Promise<void>
  stopRecording: (id: string) => Promise<RecordingStopResult>
  cancelRecording: (id: string, deleteFile: boolean) => Promise<void>
  revealRecording: (filePath: string) => Promise<void>
  onRecordingWriteError: (callback: (error: RecordingWriteError) => void) => () => void
}
