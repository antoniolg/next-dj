import { resolve } from 'node:path'

export const ALLOWED_RECORDING_EXTENSIONS = new Set(['m4a', 'mp4', 'webm'])
export const MIN_RECORDING_FREE_BYTES = 500 * 1024 * 1024

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function timestampedRecordingFileName(extension: string, now = new Date()): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

  return `NextDJ ${date} ${time}.${extension}`
}

export function isAllowedRecordingExtension(extension: unknown): extension is string {
  return typeof extension === 'string' && ALLOWED_RECORDING_EXTENSIONS.has(extension)
}

export function isPathInsideDirectory(filePath: unknown, directory: string): filePath is string {
  if (typeof filePath !== 'string') {
    return false
  }

  const resolvedDirectory = resolve(directory)
  const resolvedFilePath = resolve(filePath)

  return resolvedFilePath === resolvedDirectory || resolvedFilePath.startsWith(`${resolvedDirectory}/`)
}
