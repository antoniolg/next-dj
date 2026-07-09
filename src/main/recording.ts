import { app, ipcMain, shell, webContents } from 'electron'
import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, rm, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RecordingStartOptions } from '../shared/nextdj.js'
import {
  isAllowedRecordingExtension,
  isPathInsideDirectory,
  MIN_RECORDING_FREE_BYTES,
  timestampedRecordingFileName
} from './recordingPaths.js'

interface RecordingSession {
  stream: WriteStream
  filePath: string
  webContentsId: number
  video: boolean
  bytes: number
}

const sessions = new Map<string, RecordingSession>()

function getRecordingsDirectory(): string {
  return join(app.getPath('music'), 'NextDJ Recordings')
}

function setThrottling(webContentsId: number, throttled: boolean): void {
  const contents = webContents.fromId(webContentsId)

  if (contents && !contents.isDestroyed()) {
    contents.setBackgroundThrottling(throttled)
  }
}

function writeChunk(stream: WriteStream, chunk: Buffer): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    stream.write(chunk, (error) => (error ? rejectPromise(error) : resolvePromise()))
  })
}

function endStream(stream: WriteStream): Promise<void> {
  return new Promise((resolvePromise) => {
    if (stream.destroyed || stream.closed) {
      resolvePromise()
      return
    }

    stream.end(() => resolvePromise())
  })
}

async function finalizeSession(id: string): Promise<RecordingSession | null> {
  const session = sessions.get(id)

  if (!session) {
    return null
  }

  sessions.delete(id)

  if (session.video) {
    setThrottling(session.webContentsId, true)
  }

  await endStream(session.stream)
  return session
}

function finalizeSessionsFor(webContentsId: number): void {
  for (const [id, session] of sessions) {
    if (session.webContentsId === webContentsId) {
      void finalizeSession(id)
    }
  }
}

export function registerRecordingIpc(): void {
  ipcMain.handle('recording:start', async (event, options: RecordingStartOptions) => {
    if (!isAllowedRecordingExtension(options?.extension)) {
      throw new Error('Unsupported recording format.')
    }

    const directory = getRecordingsDirectory()
    await mkdir(directory, { recursive: true })

    const stats = await statfs(directory)
    const freeBytes = stats.bavail * stats.bsize

    if (freeBytes < MIN_RECORDING_FREE_BYTES) {
      throw new Error('Not enough free disk space to record (less than 500 MB available).')
    }

    const id = randomUUID()
    const filePath = join(directory, timestampedRecordingFileName(options.extension))

    sessions.set(id, {
      stream: createWriteStream(filePath),
      filePath,
      webContentsId: event.sender.id,
      video: Boolean(options.video),
      bytes: 0
    })

    if (options.video) {
      // The compositor draws on a timer in the renderer; without this the
      // frame rate collapses when the window is occluded or minimized.
      event.sender.setBackgroundThrottling(false)
    }

    return { id, filePath }
  })

  ipcMain.handle('recording:append-chunk', async (event, id: string, chunk: ArrayBuffer) => {
    const session = sessions.get(id)

    if (!session) {
      throw new Error('Recording session not found.')
    }

    try {
      const buffer = Buffer.from(chunk)
      await writeChunk(session.stream, buffer)
      session.bytes += buffer.byteLength
    } catch (error) {
      await finalizeSession(id)
      event.sender.send('recording:write-error', {
        id,
        message: error instanceof Error ? error.message : 'Could not write the recording.'
      })
    }
  })

  ipcMain.handle('recording:stop', async (_event, id: string) => {
    const session = await finalizeSession(id)

    if (!session) {
      throw new Error('Recording session not found.')
    }

    return { filePath: session.filePath, bytes: session.bytes }
  })

  ipcMain.handle('recording:cancel', async (_event, id: string, deleteFile: boolean) => {
    const session = await finalizeSession(id)

    if (session && deleteFile) {
      await rm(session.filePath, { force: true })
    }
  })

  ipcMain.handle('recording:reveal', (_event, filePath: string) => {
    const directory = getRecordingsDirectory()

    if (!isPathInsideDirectory(filePath, directory)) {
      throw new Error('Invalid recording path.')
    }

    shell.showItemInFolder(filePath)
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('destroyed', () => finalizeSessionsFor(contents.id))
    contents.on('render-process-gone', () => finalizeSessionsFor(contents.id))
  })

  app.on('before-quit', () => {
    for (const id of [...sessions.keys()]) {
      void finalizeSession(id)
    }
  })
}
