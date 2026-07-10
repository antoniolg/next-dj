import { app, BrowserWindow, Menu, session } from 'electron'
import { configureSessionSecurity } from './appSecurity.js'
import { registerAppUpdateIpc } from './appUpdate.js'
import {
  appendRendererPerfFlag,
  isRendererPerfEnabled,
  readPerfUserDataDir,
  readRemoteDebuggingPort
} from './performanceFlags.js'
import { registerPlaylistImportIpc } from './playlistImport.js'
import { registerRecordingIpc } from './recording.js'
import { createMainWindow } from './window.js'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const remoteDebuggingPort = readRemoteDebuggingPort()
const perfUserDataDir = readPerfUserDataDir()
const rendererPerformanceEnabled = isRendererPerfEnabled()

if (perfUserDataDir) {
  app.setPath('userData', perfUserDataDir)
}

if (remoteDebuggingPort) {
  app.commandLine.appendSwitch('remote-debugging-port', String(remoteDebuggingPort))
}

app.whenReady().then(() => {
  if (!isDev) {
    Menu.setApplicationMenu(null)
  }

  configureSessionSecurity(session.defaultSession)

  registerAppUpdateIpc()
  registerPlaylistImportIpc()
  registerRecordingIpc()
  createMainWindow({
    dirname: __dirname,
    enablePerformanceTracing: rendererPerformanceEnabled,
    isDev,
    rendererUrl: appendRendererPerfFlag(process.env.ELECTRON_RENDERER_URL)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({
        dirname: __dirname,
        enablePerformanceTracing: rendererPerformanceEnabled,
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
