import React, { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LibraryLayout from './routes/LibraryLayout'
import { loadCbzViewerPage, loadPdfViewerPage, loadVideoPlayerPage } from './routes/viewerPages'
import StartupGate, { RouteFallback } from './components/Startup/StartupGate'
import ProfileGate from './components/Profile/ProfileGate'

const PdfViewerPage = lazy(loadPdfViewerPage)
const CbzViewerPage = lazy(loadCbzViewerPage)
const VideoPlayerPage = lazy(loadVideoPlayerPage)

export default function App() {
  return (
    <StartupGate>
      <ProfileGate>
        <HashRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<LibraryLayout fallback={<RouteFallback />} />}>
                <Route path="/" element={<></>} />
                <Route path="/items/:id" element={<></>} />
                <Route path="/view/pdf/:id" element={<PdfViewerPage />} />
                <Route path="/view/cbz/:id" element={<CbzViewerPage />} />
                <Route path="/view/video/:id" element={<VideoPlayerPage />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </ProfileGate>
    </StartupGate>
  )
}
