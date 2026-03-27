import { app, BrowserWindow, session, protocol, net, ipcMain } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'
import { createDatabase, ensureRuntimeSchema, runMigrations } from './db/migrate'
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
const isWindows = process.platform === 'win32'
const shouldAutoOpenDevTools = process.env['OPEN_DEVTOOLS'] === '1'

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

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
  if (isDev) {
    return path.join(process.cwd(), 'media-library.db')
  }

  const portableExecutableDir = process.env['PORTABLE_EXECUTABLE_DIR']
  if (portableExecutableDir) {
    return path.join(portableExecutableDir, 'media-library.db')
  }

  const executableDir = path.dirname(process.execPath)
  return path.join(executableDir, 'media-library.db')
}

function migrateLegacyDbIfNeeded(dbPath: string) {
  const legacyDbPath = path.join(app.getPath('userData'), 'media-library.db')

  if (path.resolve(legacyDbPath) === path.resolve(dbPath)) {
    return
  }

  if (fs.existsSync(dbPath) || !fs.existsSync(legacyDbPath)) {
    return
  }

  fs.copyFileSync(legacyDbPath, dbPath)

  for (const suffix of ['-wal', '-shm']) {
    const source = `${legacyDbPath}${suffix}`
    const target = `${dbPath}${suffix}`
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, target)
    }
  }
}

function getMigrationsPath() {
  if (isDev) {
    return path.join(process.cwd(), 'src/main/db/migrations')
  }
  return path.join(process.resourcesPath, 'migrations')
}

let mainWindow: BrowserWindow | null = null

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in main process:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in main process:', reason)
})

async function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    title: 'Media Library',
    ...(isWindows
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#e6e9ef',
            height: 34,
          },
        }
      : {}),
  })

  if (isWindows) {
    mainWindow.setMenuBarVisibility(false)
  }

  mainWindow.once('ready-to-show', () => {
    console.log('[main] window ready-to-show')
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.center()
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('show', () => {
    console.log('[main] window shown')
  })

  mainWindow.on('closed', () => {
    console.log('[main] window closed')
    mainWindow = null
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load:', { errorCode, errorDescription, validatedURL })
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details)
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
    if (shouldAutoOpenDevTools) {
      mainWindow.webContents.openDevTools()
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
})

app.whenReady().then(async () => {
  try {
  ipcMain.handle('app:reload', async () => {
    mainWindow?.webContents.reloadIgnoringCache()
  })

  ipcMain.handle('app:toggleDevTools', async () => {
    if (!mainWindow) return
    mainWindow.webContents.toggleDevTools()
  })

  ipcMain.handle('app:zoomIn', async () => {
    if (!mainWindow) return
    const current = mainWindow.webContents.getZoomFactor()
    mainWindow.webContents.setZoomFactor(Math.min(3, current + 0.1))
  })

  ipcMain.handle('app:zoomOut', async () => {
    if (!mainWindow) return
    const current = mainWindow.webContents.getZoomFactor()
    mainWindow.webContents.setZoomFactor(Math.max(0.5, current - 0.1))
  })

  ipcMain.handle('app:zoomReset', async () => {
    mainWindow?.webContents.setZoomFactor(1)
  })

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

  console.log(`[main] DB path: ${dbPath} (mode=${isDev ? 'dev' : 'packaged'})`)

  migrateLegacyDbIfNeeded(dbPath)

  const { db, sqlite } = createDatabase(dbPath)

  try {
    runMigrations(db, migrationsPath)
  } catch (e) {
    console.error('Migration error (may be OK on first run):', e)
  }

  ensureRuntimeSchema(sqlite)

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
  } catch (error) {
    console.error('Startup failed in app.whenReady:', error)
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  console.log('[main] window-all-closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
