import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import ItemDetailPage from './pages/ItemDetailPage'
import PdfViewerPage from './pages/PdfViewerPage'
import CbzViewerPage from './pages/CbzViewerPage'
import VideoPlayerPage from './pages/VideoPlayerPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/items/:id" element={<ItemDetailPage />} />
        <Route path="/view/pdf/:id" element={<PdfViewerPage />} />
        <Route path="/view/cbz/:id" element={<CbzViewerPage />} />
        <Route path="/view/video/:id" element={<VideoPlayerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  )
}
