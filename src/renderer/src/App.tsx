import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import PdfViewerPage from './pages/PdfViewerPage'
import CbzViewerPage from './pages/CbzViewerPage'
import VideoPlayerPage from './pages/VideoPlayerPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/items/:id" element={<LibraryPage />} />
        <Route path="/view/pdf/:id" element={<PdfViewerPage />} />
        <Route path="/view/cbz/:id" element={<CbzViewerPage />} />
        <Route path="/view/video/:id" element={<VideoPlayerPage />} />
      </Routes>
    </HashRouter>
  )
}
