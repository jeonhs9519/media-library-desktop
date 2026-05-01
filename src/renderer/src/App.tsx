import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import { api } from './api'
import { loadCbzViewerPage, loadPdfViewerPage, loadVideoPlayerPage } from './routes/viewerPages'

const PdfViewerPage = lazy(loadPdfViewerPage)
const CbzViewerPage = lazy(loadCbzViewerPage)
const VideoPlayerPage = lazy(loadVideoPlayerPage)

type StartupStep = {
  phase: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  durationMs?: number
  detail?: string
}

type StartupStatus = {
  ready: boolean
  phase: string
  label: string
  detail?: string
  elapsedMs?: number
  steps: StartupStep[]
  error?: string
}

const STARTUP_LABELS: Record<string, string> = {
  boot: '앱을 시작하는 중',
  'window:create': '창을 여는 중',
  'paths:legacy-db': '기존 라이브러리 데이터를 확인하는 중',
  'db:open': '라이브러리 데이터베이스를 여는 중',
  'db:migrate': '데이터베이스 구조를 확인하는 중',
  'db:runtime-schema': '런타임 스키마를 점검하는 중',
  'ipc:register': '앱 기능을 준비하는 중',
  ready: '준비 완료',
}

function getStartupLabel(status?: Pick<StartupStatus, 'phase' | 'label'>) {
  if (!status) return STARTUP_LABELS.boot
  return STARTUP_LABELS[status.phase] || status.label || STARTUP_LABELS.boot
}

function formatDuration(ms?: number) {
  if (typeof ms !== 'number') return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StartupGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<StartupStatus | null>(null)

  useEffect(() => {
    let mounted = true

    api.startup.getStatus().then((nextStatus: StartupStatus) => {
      if (mounted) setStatus(nextStatus)
    }).catch((error: unknown) => {
      if (!mounted) return
      setStatus({
        ready: false,
        phase: 'error',
        label: 'Startup failed',
        steps: [],
        error: String((error as Error)?.message || error),
      })
    })

    const removeStatusListener = api.startup.onStatus((nextStatus: StartupStatus) => {
      setStatus(nextStatus)
    })
    const removeReadyListener = api.startup.onReady((nextStatus: StartupStatus) => {
      setStatus(nextStatus)
    })

    return () => {
      mounted = false
      removeStatusListener()
      removeReadyListener()
    }
  }, [])

  const visibleSteps = useMemo(() => status?.steps || [], [status?.steps])

  if (status?.ready) {
    return <>{children}</>
  }

  return (
    <main className="startup-screen">
      <section className="startup-panel" aria-live="polite">
        <div className="startup-kicker">Media Library</div>
        <h1 className="startup-title">{getStartupLabel(status || undefined)}</h1>
        <div className="startup-progress" aria-hidden="true">
          <div className="startup-progress-bar" />
        </div>
        <div className="startup-meta">
          <span>{formatDuration(status?.elapsedMs) || '0ms'}</span>
          {status?.detail ? <span title={status.detail}>{status.detail}</span> : null}
        </div>

        {status?.error ? (
          <pre className="startup-error">{status.error}</pre>
        ) : (
          <ol className="startup-steps">
            {visibleSteps.map((step) => (
              <li key={step.phase} className={`startup-step is-${step.status}`}>
                <span className="startup-step-dot" />
                <span className="startup-step-label">{getStartupLabel(step)}</span>
                <span className="startup-step-duration">{formatDuration(step.durationMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}

function RouteFallback() {
  return (
    <main className="startup-screen">
      <section className="startup-panel" aria-live="polite">
        <div className="startup-kicker">Media Library</div>
        <h1 className="startup-title">{STARTUP_LABELS.boot}</h1>
        <div className="startup-progress" aria-hidden="true">
          <div className="startup-progress-bar" />
        </div>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <StartupGate>
      <HashRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/items/:id" element={<LibraryPage />} />
            <Route path="/view/pdf/:id" element={<PdfViewerPage />} />
            <Route path="/view/cbz/:id" element={<CbzViewerPage />} />
            <Route path="/view/video/:id" element={<VideoPlayerPage />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </StartupGate>
  )
}
