import { app, BrowserWindow, session, protocol, ipcMain, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'
import { performance } from 'perf_hooks'
import { createDatabase, ensureRuntimeSchema, runMigrations } from './db/migrate'
import { registerItemsIPC } from './ipc/items'
import { registerTagsIPC } from './ipc/tags'
import { registerReviewsIPC } from './ipc/reviews'
import { registerSettingsIPC } from './ipc/settings'
import { registerPlaylistsIPC } from './ipc/playlists'
import { registerFilesIPC } from './ipc/files'
import { registerPdfIPC } from './ipc/pdf'
import { registerCbzIPC } from './ipc/cbz'
import { registerVideoIPC } from './ipc/video'
import { registerThumbnailsIPC } from './ipc/thumbnails'
import { cleanupUnusedTags } from './services/tagMaintenance'

const isDev = !app.isPackaged
const isWindows = process.platform === 'win32'
const shouldAutoOpenDevTools = process.env['OPEN_DEVTOOLS'] === '1'
const defaultUserDataPath = app.getPath('userData')

function getPortableAppDataRoot() {
  if (isDev) {
    return path.join(process.cwd(), '.data')
  }

  const portableExecutableDir = process.env['PORTABLE_EXECUTABLE_DIR']
  if (portableExecutableDir) {
    return path.join(portableExecutableDir, '.data')
  }

  return path.join(path.dirname(process.execPath), '.data')
}

function configurePortableAppPaths() {
  const appDataRoot = getPortableAppDataRoot()
  const userDataPath = path.join(appDataRoot, 'user-data')
  const sessionDataPath = path.join(appDataRoot, 'session-data')
  const logsPath = path.join(appDataRoot, 'logs')
  const crashDumpsPath = path.join(appDataRoot, 'crash-dumps')

  for (const targetPath of [appDataRoot, userDataPath, sessionDataPath, logsPath, crashDumpsPath]) {
    fs.mkdirSync(targetPath, { recursive: true })
  }

  app.setPath('userData', userDataPath)
  app.setPath('sessionData', sessionDataPath)
  app.setPath('logs', logsPath)
  app.setPath('crashDumps', crashDumpsPath)
}

configurePortableAppPaths()

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
  const legacyDbPath = path.join(defaultUserDataPath, 'media-library.db')

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

function getVideoContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.avi') return 'video/x-msvideo'
  if (ext === '.mkv') return 'video/x-matroska'
  return 'application/octet-stream'
}

let mainWindow: BrowserWindow | null = null

type StartupStatus = {
  ready: boolean
  phase: string
  label: string
  detail?: string
  startedAt: number
  updatedAt: number
  completedAt?: number
  interactiveAt?: number
  elapsedMs?: number
  steps: Array<{
    phase: string
    label: string
    status: 'pending' | 'running' | 'done' | 'error'
    durationMs?: number
    detail?: string
  }>
  error?: string
}

const startupStartedAt = performance.now()
const startupStatus: StartupStatus = {
  ready: false,
  phase: 'boot',
  label: 'Starting app',
  startedAt: startupStartedAt,
  updatedAt: startupStartedAt,
  steps: [],
}

function sendStartupStatus() {
  mainWindow?.webContents.send('startup:status', startupStatus)
}

function setStartupPhase(phase: string, label: string, detail?: string) {
  const now = performance.now()
  startupStatus.phase = phase
  startupStatus.label = label
  startupStatus.detail = detail
  startupStatus.updatedAt = now
  startupStatus.elapsedMs = now - startupStatus.startedAt

  const existing = startupStatus.steps.find(step => step.phase === phase)
  if (existing) {
    existing.status = 'running'
    existing.label = label
    existing.detail = detail
  } else {
    startupStatus.steps.push({ phase, label, detail, status: 'running' })
  }

  console.log(`[startup] ${phase} start${detail ? ` - ${detail}` : ''}`)
  sendStartupStatus()
}

function completeStartupPhase(phase: string, durationMs: number, detail?: string) {
  const now = performance.now()
  const existing = startupStatus.steps.find(step => step.phase === phase)
  if (existing) {
    existing.status = 'done'
    existing.durationMs = durationMs
    if (detail) existing.detail = detail
  }

  startupStatus.updatedAt = now
  startupStatus.elapsedMs = now - startupStatus.startedAt
  console.log(`[startup] ${phase} done ${durationMs.toFixed(1)}ms${detail ? ` - ${detail}` : ''}`)
  sendStartupStatus()
}

async function measureStartupPhase<T>(phase: string, label: string, task: () => T | Promise<T>, detail?: string): Promise<T> {
  setStartupPhase(phase, label, detail)
  const started = performance.now()
  try {
    const result = await task()
    completeStartupPhase(phase, performance.now() - started)
    return result
  } catch (error) {
    const durationMs = performance.now() - started
    const existing = startupStatus.steps.find(step => step.phase === phase)
    if (existing) {
      existing.status = 'error'
      existing.durationMs = durationMs
      existing.detail = String((error as Error)?.message || error)
    }
    startupStatus.error = String((error as Error)?.message || error)
    startupStatus.updatedAt = performance.now()
    startupStatus.elapsedMs = startupStatus.updatedAt - startupStatus.startedAt
    console.error(`[startup] ${phase} failed ${durationMs.toFixed(1)}ms`, error)
    sendStartupStatus()
    throw error
  }
}

function markStartupReady() {
  const now = performance.now()
  startupStatus.ready = true
  startupStatus.phase = 'ready'
  startupStatus.label = 'Ready'
  startupStatus.detail = undefined
  startupStatus.updatedAt = now
  startupStatus.completedAt = now
  startupStatus.elapsedMs = now - startupStatus.startedAt
  console.log(`[startup] ready ${startupStatus.elapsedMs.toFixed(1)}ms`)
  sendStartupStatus()
  mainWindow?.webContents.send('startup:ready', startupStatus)
}

function registerStartupIPC() {
  ipcMain.handle('startup:getStatus', async () => startupStatus)
  ipcMain.handle('startup:markLibraryReady', async () => {
    if (startupStatus.interactiveAt) return startupStatus

    const now = performance.now()
    startupStatus.interactiveAt = now
    startupStatus.updatedAt = now
    console.log(`[startup] library:list-ready ${(now - startupStatus.startedAt).toFixed(1)}ms`)
    return startupStatus
  })
}

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

  mainWindow.center()
  mainWindow.show()
  mainWindow.focus()
  console.log(`[startup] window:shown-early ${(performance.now() - startupStartedAt).toFixed(1)}ms`)

  mainWindow.once('ready-to-show', () => {
    console.log(`[startup] window:ready-to-show ${(performance.now() - startupStartedAt).toFixed(1)}ms`)
    if (!mainWindow) return
    if (!mainWindow.isVisible()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.center()
      mainWindow.show()
      mainWindow.focus()
    }
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

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`[startup] window:did-finish-load ${(performance.now() - startupStartedAt).toFixed(1)}ms`)
    sendStartupStatus()
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
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
    if (shouldAutoOpenDevTools) {
      mainWindow.webContents.openDevTools()
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
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
  registerStartupIPC()

  ipcMain.handle('app:reload', async () => {
    mainWindow?.webContents.reloadIgnoringCache()
  })

  ipcMain.handle('app:toggleDevTools', async () => {
    if (!mainWindow) return
    mainWindow.webContents.toggleDevTools()
  })

  ipcMain.handle('app:zoomIn', async () => {
    if (!mainWindow) return 1
    const current = mainWindow.webContents.getZoomFactor()
    const next = Math.min(3, current + 0.1)
    mainWindow.webContents.setZoomFactor(next)
    return next
  })

  ipcMain.handle('app:zoomOut', async () => {
    if (!mainWindow) return 1
    const current = mainWindow.webContents.getZoomFactor()
    const next = Math.max(0.5, current - 0.1)
    mainWindow.webContents.setZoomFactor(next)
    return next
  })

  ipcMain.handle('app:zoomReset', async () => {
    mainWindow?.webContents.setZoomFactor(1)
    return 1
  })

  ipcMain.handle('app:getZoomFactor', async () => {
    return mainWindow?.webContents.getZoomFactor() ?? 1
  })

  ipcMain.handle('app:isCursorInsideWindow', async () => {
    if (!mainWindow) return true
    const point = screen.getCursorScreenPoint()
    const bounds = mainWindow.getBounds()
    return (
      point.x >= bounds.x
      && point.x < bounds.x + bounds.width
      && point.y >= bounds.y
      && point.y < bounds.y + bounds.height
    )
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

    const stat = fs.statSync(normalizedPath)
    const totalSize = stat.size
    const contentType = getVideoContentType(normalizedPath)
    const range = request.headers.get('range')

    if (!range) {
      const fullStream = fs.createReadStream(normalizedPath)
      return new Response(Readable.toWeb(fullStream) as ReadableStream, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
        },
      })
    }

    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
    if (!match) {
      return new Response('Invalid Range', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalSize}`,
        },
      })
    }

    let start = match[1] ? Number.parseInt(match[1], 10) : 0
    let end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalSize) {
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalSize}`,
        },
      })
    }

    end = Math.min(end, totalSize - 1)
    const chunkSize = end - start + 1
    const stream = fs.createReadStream(normalizedPath, { start, end })

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(chunkSize),
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      },
    })
  })

  await measureStartupPhase('window:create', 'Opening window', async () => {
    await createWindow()
  })

  const dbPath = getDbPath()
  const migrationsPath = getMigrationsPath()

  console.log(`[main] DB path: ${dbPath} (mode=${isDev ? 'dev' : 'packaged'})`)

  await measureStartupPhase('paths:legacy-db', 'Checking existing library data', () => {
    migrateLegacyDbIfNeeded(dbPath)
  }, dbPath)

  const { db, sqlite } = await measureStartupPhase('db:open', 'Opening library database', () => {
    return createDatabase(dbPath)
  })

  await measureStartupPhase('db:migrate', 'Checking database schema', () => {
    try {
      runMigrations(db, migrationsPath)
    } catch (e) {
      console.error('Migration error (may be OK on first run):', e)
    }
  }, migrationsPath)

  await measureStartupPhase('db:runtime-schema', 'Verifying runtime schema', () => {
    ensureRuntimeSchema(sqlite)
  })

  await measureStartupPhase('db:cleanup-tags', 'Cleaning unused tags', () => {
    const result = cleanupUnusedTags(db)
    if (result.deleted > 0) {
      console.log(`[main] Removed ${result.deleted} unused tag(s)`)
    }
  })

  await measureStartupPhase('ipc:register', 'Preparing app features', () => {
    registerItemsIPC(db)
    registerTagsIPC(db)
    registerReviewsIPC(db)
    registerSettingsIPC(db)
    registerPlaylistsIPC(db)
    registerFilesIPC()
    registerPdfIPC()
    registerCbzIPC()
    registerVideoIPC()
    registerThumbnailsIPC(db)
  })

  markStartupReady()

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
