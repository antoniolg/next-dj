import { app, BrowserWindow, Menu, session } from 'electron'
import { registerRecordingIpc } from './recording.js'
import { createMainWindow } from './window.js'
import { registerYouTubeIpc } from './youtube.js'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

app.whenReady().then(() => {
  if (!isDev) {
    Menu.setApplicationMenu(null)
  }

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture')
  })

  // Recording captures the app's own window content (WebFrameMain), which
  // needs no macOS Screen Recording permission and never picks up
  // overlapping windows.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (request.frame) {
      callback({ video: request.frame })
    } else {
      callback({})
    }
  })

  registerYouTubeIpc()
  registerRecordingIpc()
  createMainWindow({
    dirname: __dirname,
    isDev,
    rendererUrl: process.env.ELECTRON_RENDERER_URL
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({
        dirname: __dirname,
        isDev,
        rendererUrl: process.env.ELECTRON_RENDERER_URL
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
