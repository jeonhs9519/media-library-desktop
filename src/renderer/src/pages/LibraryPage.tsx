import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Item } from '../types'
import Modal from '../components/Modal'

const CARD_SIZE = 160
const THUMB_SIZE = 128

function getContentTypeIcon(ct: string) {
  switch (ct) {
    case 'book': return '📚'
    case 'comic': return '🎨'
    case 'video': return '🎬'
    default: return '📄'
  }
}

function getLanguageFlag(lang: string) {
  switch (lang) {
    case 'ko': return '🇰🇷'
    case 'ja': return '🇯🇵'
    case 'en': return '🇺🇸'
    case 'zh': return '🇨🇳'
    default: return ''
  }
}

interface CardProps {
  item: Item & { fileExists?: boolean }
  thumbnailUrl?: string
  onClick: () => void
}

function ItemCard({ item, thumbnailUrl, onClick }: CardProps) {
  const missing = item.fileExists === false

  return (
    <div
      onClick={onClick}
      style={{
        width: CARD_SIZE,
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          background: '#0f3460',
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          margin: '0 auto',
          filter: missing ? 'grayscale(100%)' : 'none',
          border: '1px solid #2a2a4a',
        }}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.title} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 40 }}>
            {getContentTypeIcon(item.contentType)}
          </div>
        )}
        {missing && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(255,0,0,0.3)', fontSize: 32,
          }}>✗</div>
        )}
        <div style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 16 }}>
          {getContentTypeIcon(item.contentType)}
        </div>
        <div style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 14 }}>
          {getLanguageFlag(item.language)}
        </div>
      </div>
      <div style={{
        marginTop: 6,
        fontSize: 12,
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: CARD_SIZE,
        color: '#e0e0e0',
      }}>
        {item.title}
      </div>
      {item.progress > 0 && (
        <div style={{
          height: 2, background: '#2a2a4a', borderRadius: 1, marginTop: 4,
          width: CARD_SIZE,
        }}>
          <div style={{ height: '100%', width: `${item.progress * 100}%`, background: '#e94560', borderRadius: 1 }} />
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [contentType, setContentType] = useState('')
  const [language, setLanguage] = useState('')
  const [watched, setWatched] = useState<boolean | undefined>(undefined)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const loadedThumbnailIds = useRef<Set<number>>(new Set())
  const [duplicateModal, setDuplicateModal] = useState<{ fileName: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const perPage = 100

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.items.getAll({
        search: search || undefined,
        contentType: contentType || undefined,
        language: language || undefined,
        watched,
        sortBy,
        sortDir,
        page,
        perPage,
      })
      setItems(result.items)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [search, contentType, language, watched, sortBy, sortDir, page])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    const loadThumbnails = async () => {
      for (const item of items) {
        if (!loadedThumbnailIds.current.has(item.id)) {
          loadedThumbnailIds.current.add(item.id)
          const thumb = await window.api.thumbnail.get(item.id)
          if (thumb) {
            setThumbnails(prev => ({ ...prev, [item.id]: `data:image/jpeg;base64,${thumb}` }))
          }
        }
      }
    }
    loadThumbnails()
  }, [items])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      await addFile((file as any).path)
    }
  }, [])

  const addFile = async (filePath: string) => {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    const dir = filePath.substring(0, lastSlash)
    const baseName = filePath.substring(lastSlash + 1)
    const lastDot = baseName.lastIndexOf('.')
    const fileName = lastDot > 0 ? baseName.substring(0, lastDot) : baseName
    const fileExtension = lastDot > 0 ? baseName.substring(lastDot + 1) : ''

    const exists = await window.api.items.checkExists(dir, fileName, fileExtension)
    if (exists) {
      setDuplicateModal({ fileName: baseName })
      return
    }

    const stat = await window.api.file.readStat(filePath)
    await window.api.items.add({
      filePath: dir,
      fileName,
      fileExtension,
      fileModifiedAt: stat?.mtime,
    })
    await loadItems()
  }

  const handleAddFile = async () => {
    const paths = await window.api.file.openDialog()
    for (const p of paths) {
      await addFile(p)
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div style={{
        background: '#16213e', padding: '12px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderBottom: '1px solid #2a2a4a', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 20, fontWeight: 'bold', color: '#e94560' }}>📚 Media Library</span>

        <input
          ref={searchRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search (Ctrl+F)"
          style={{ flex: 1, maxWidth: 300 }}
        />

        <select value={contentType} onChange={e => { setContentType(e.target.value); setPage(1) }}>
          <option value="">All Types</option>
          <option value="book">Book</option>
          <option value="comic">Comic</option>
          <option value="video">Video</option>
          <option value="other">Other</option>
        </select>

        <select value={language} onChange={e => { setLanguage(e.target.value); setPage(1) }}>
          <option value="">All Languages</option>
          <option value="ko">Korean</option>
          <option value="ja">Japanese</option>
          <option value="en">English</option>
          <option value="zh">Chinese</option>
          <option value="other">Other</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={watched === true}
            onChange={e => setWatched(e.target.checked ? true : undefined)}
          />
          Watched
        </label>

        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="createdAt">Date Added</option>
          <option value="updatedAt">Date Updated</option>
          <option value="title">Title</option>
          <option value="fileModifiedAt">File Date</option>
        </select>

        <button
          className="btn-secondary"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          style={{ padding: '6px 10px' }}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>

        <button className="btn-primary" onClick={handleAddFile}>+ Add File</button>
        <button className="btn-secondary" onClick={() => navigate('/settings')} style={{ padding: '6px 10px' }}>⚙</button>
      </div>

      <div style={{ padding: '8px 16px', fontSize: 12, color: '#a0a0b0', flexShrink: 0 }}>
        {total} items {loading && '(loading...)'}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              thumbnailUrl={thumbnails[item.id]}
              onClick={() => navigate(`/items/${item.id}`)}
            />
          ))}
        </div>

        {total > perPage && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: 16 }}>
            <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ alignSelf: 'center' }}>Page {page} of {Math.ceil(total / perPage)}</span>
            <button className="btn-secondary" disabled={page * perPage >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      <Modal open={!!duplicateModal} onClose={() => setDuplicateModal(null)} title="Duplicate File">
        <p>"{duplicateModal?.fileName}" is already in your library.</p>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => setDuplicateModal(null)}>OK</button>
        </div>
      </Modal>
    </div>
  )
}
