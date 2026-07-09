import { app, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import type { YouTubeDownloadResult, YouTubeTrackSummary } from '../shared/nextdj.js'

const execFileAsync = promisify(execFile)
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be'])
const AUDIO_EXTENSION_PATTERN = /\.(aif|aiff|flac|m4a|mp3|ogg|opus|wav)$/i
const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/
const MAX_YTDLP_BUFFER = 1024 * 1024 * 20

export interface YtDlpInfo {
  id?: unknown
  title?: unknown
  duration?: unknown
  webpage_url?: unknown
  original_url?: unknown
  url?: unknown
  entries?: unknown
}

export function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return YOUTUBE_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

export function getAudioExtension(fileName: string): string | null {
  const match = AUDIO_EXTENSION_PATTERN.exec(fileName)
  return match?.[0].toLowerCase() ?? null
}

export function parseDownloadedFilePaths(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => getAudioExtension(line))
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function createYouTubeWatchUrl(info: YtDlpInfo): string {
  const webpageUrl = readString(info.webpage_url)

  if (webpageUrl) {
    return webpageUrl
  }

  const url = readString(info.url)

  if (YOUTUBE_VIDEO_ID_PATTERN.test(url)) {
    return `https://www.youtube.com/watch?v=${url}`
  }

  return url
}

export function mapYouTubeInfo(info: YtDlpInfo, index: number): YouTubeTrackSummary | null {
  const url = createYouTubeWatchUrl(info)
  const id = readString(info.id) || readString(info.url) || url
  const title = readString(info.title) || `YouTube track ${index + 1}`

  if (!id || !url) {
    return null
  }

  return {
    id,
    title,
    duration: readNumber(info.duration),
    url
  }
}

function getYouTubeCacheDirectory(): string {
  return join(app.getPath('userData'), 'youtube-cache')
}

export async function listYouTubeTracks(rawUrl: string): Promise<YouTubeTrackSummary[]> {
  const url = rawUrl.trim()

  if (!isYouTubeUrl(url)) {
    throw new Error('Paste a YouTube or YouTube Music URL.')
  }

  try {
    const result = await execFileAsync('yt-dlp', ['--flat-playlist', '--dump-single-json', url], {
      maxBuffer: MAX_YTDLP_BUFFER
    })
    const parsed = JSON.parse(result.stdout) as YtDlpInfo
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [parsed]

    return entries
      .map((entry, index) => mapYouTubeInfo(entry as YtDlpInfo, index))
      .filter((track): track is YouTubeTrackSummary => track !== null)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'yt-dlp could not read this playlist.'
    throw new Error(message, { cause: error })
  }
}

export async function downloadYouTubeAudio(rawUrl: string): Promise<YouTubeDownloadResult> {
  const url = rawUrl.trim()

  if (!isYouTubeUrl(url)) {
    throw new Error('Paste a YouTube or YouTube Music URL.')
  }

  const outputDirectory = getYouTubeCacheDirectory()
  await mkdir(outputDirectory, { recursive: true })

  const downloadStartedAt = Date.now()
  let downloadedPaths: string[]

  try {
    const result = await execFileAsync(
      'yt-dlp',
      [
        '--extract-audio',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '0',
        '--no-mtime',
        '--print',
        'after_move:filepath',
        '--restrict-filenames',
        '--output',
        join(outputDirectory, '%(playlist_index|)03d-%(title).120s-%(id)s.%(ext)s'),
        url
      ],
      { maxBuffer: MAX_YTDLP_BUFFER }
    )
    downloadedPaths = parseDownloadedFilePaths(result.stdout)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'yt-dlp failed.'
    throw new Error(message, { cause: error })
  }

  const candidatePaths =
    downloadedPaths.length > 0
      ? downloadedPaths
      : (await readdir(outputDirectory)).map((entry) => join(outputDirectory, entry))
  const importedFiles = await Promise.all(
    candidatePaths
      .filter((filePath) => getAudioExtension(filePath))
      .map(async (filePath) => {
        const fileStat = await stat(filePath)
        return { filePath, mtimeMs: fileStat.mtimeMs }
      })
  )
  const currentImportFiles =
    downloadedPaths.length > 0
      ? importedFiles
      : importedFiles.filter((file) => file.mtimeMs >= downloadStartedAt - 1000)

  currentImportFiles.sort((a, b) => a.mtimeMs - b.mtimeMs)

  const files = await Promise.all(
    currentImportFiles.map(async (file) => {
      const data = await readFile(file.filePath)
      const arrayBuffer = new ArrayBuffer(data.byteLength)
      new Uint8Array(arrayBuffer).set(data)

      return {
        data: arrayBuffer,
        name: basename(file.filePath),
        lastModified: file.mtimeMs
      }
    })
  )

  return {
    file: files[0] ?? null,
    outputDirectory
  }
}

export function registerYouTubeIpc(): void {
  ipcMain.handle('youtube:list-tracks', (_event, url: unknown) => {
    if (typeof url !== 'string') {
      throw new Error('Paste a YouTube or YouTube Music URL.')
    }

    return listYouTubeTracks(url)
  })

  ipcMain.handle('youtube:download-audio', (_event, url: unknown) => {
    if (typeof url !== 'string') {
      throw new Error('Paste a YouTube or YouTube Music URL.')
    }

    return downloadYouTubeAudio(url)
  })
}
