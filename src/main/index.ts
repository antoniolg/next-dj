import { app, BrowserWindow, Menu, session } from 'electron'
import { configureSessionSecurity } from './appSecurity.js'
import { appendRendererPerfFlag, readRemoteDebuggingPort } from './performanceFlags.js'
import { registerRecordingIpc } from './recording.js'
import { createMainWindow } from './window.js'
import { registerYouTubeIpc } from './youtube.js'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const remoteDebuggingPort = readRemoteDebuggingPort()

if (remoteDebuggingPort) {
  app.commandLine.appendSwitch('remote-debugging-port', String(remoteDebuggingPort))
}

app.whenReady().then(() => {
  if (!isDev) {
    Menu.setApplicationMenu(null)
  }

  configureSessionSecurity(session.defaultSession)

  registerYouTubeIpc()
  registerRecordingIpc()
  createMainWindow({
    dirname: __dirname,
    isDev,
    rendererUrl: appendRendererPerfFlag(process.env.ELECTRON_RENDERER_URL)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({
        dirname: __dirname,
        isDev,
        rendererUrl: appendRendererPerfFlag(process.env.ELECTRON_RENDERER_URL)
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
