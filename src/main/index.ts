import { app, BrowserWindow, session, protocol, net } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'
import { createDatabase, runMigrations } from './db/migrate'
import { registerItemsIPC } from './ipc/items'
import { registerTagsIPC } from './ipc/tags'
import { registerReviewsIPC } from './ipc/reviews'
import { registerSettingsIPC } from './ipc/settings'
import { registerFilesIPC } from './ipc/files'
import { registerPdfIPC } from './ipc/pdf'
import { registerCbzIPC } from './ipc/cbz'
import { registerVideoIPC } from './ipc/video'
import { registerThumbnailsIPC } from './ipc/thumbnails'

const isDev = !app.isPackaged

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
])

function getDbPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'media-library.db')
}

function getMigrationsPath() {
  if (isDev) {
    return path.join(process.cwd(), 'src/main/db/migrations')
  }
  return path.join(process.resourcesPath, 'migrations')
}

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    title: 'Media Library',
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file: local-media:"]
      }
    })
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  protocol.handle('local-media', async (request) => {
    const url = new URL(request.url)
    const encodedPath = url.searchParams.get('path')

    if (!encodedPath) {
      return new Response('Missing path', { status: 400 })
    }

    const normalizedPath = path.normalize(decodeURIComponent(encodedPath))

    if (!fs.existsSync(normalizedPath)) {
      return new Response('File not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(normalizedPath).toString(), {
      method: request.method,
      headers: request.headers,
    })
  })

  const dbPath = getDbPath()
  const migrationsPath = getMigrationsPath()

  const { db } = createDatabase(dbPath)

  try {
    runMigrations(db, migrationsPath)
  } catch (e) {
    console.error('Migration error (may be OK on first run):', e)
  }

  registerItemsIPC(db)
  registerTagsIPC(db)
  registerReviewsIPC(db)
  registerSettingsIPC(db)
  registerFilesIPC()
  registerPdfIPC()
  registerCbzIPC()
  registerVideoIPC()
  registerThumbnailsIPC(db)

  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
