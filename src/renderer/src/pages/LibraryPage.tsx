import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Item } from '../types'
import Modal from '../components/Modal'
import type { LanguageSetting } from '../i18n/index'
import { useI18n } from '../useI18n'
import ItemDetailPage from './ItemDetailPage'

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
          background: 'var(--bg-card)',
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          margin: '0 auto',
          filter: missing ? 'grayscale(100%)' : 'none',
          border: '1px solid var(--border)',
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
            justifyContent: 'center', background: 'rgba(185, 74, 87, 0.32)', fontSize: 32,
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
        fontSize: 13,
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
          height: 2, background: 'var(--border)', borderRadius: 1, marginTop: 4,
          width: CARD_SIZE,
        }}>
          <div style={{ height: '100%', width: `${item.progress * 100}%`, background: 'var(--accent)', borderRadius: 1 }} />
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
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
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [fileModifiedPolicy, setFileModifiedPolicy] = useState('once')
  const [loading, setLoading] = useState(false)
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const perPage = 100
  const { tr, languageSetting, changeLanguageSetting } = useI18n()

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

  useEffect(() => {
    window.api.settings.get('fileModifiedAt.updatePolicy').then((v: string | undefined) => {
      if (v) setFileModifiedPolicy(v)
    })
  }, [])

  useEffect(() => {
    if (!id) {
      setDetailItemId(null)
      return
    }
    const parsed = parseInt(id)
    setDetailItemId(Number.isNaN(parsed) ? null : parsed)
  }, [id])

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

  const handleChangeFileModifiedPolicy = async (value: string) => {
    setFileModifiedPolicy(value)
    await window.api.settings.set('fileModifiedAt.updatePolicy', value)
  }

  const handleChangeLanguageSetting = async (value: LanguageSetting) => {
    await changeLanguageSetting(value)
  }

  const handleOpenDetail = (itemId: number) => {
    navigate(`/items/${itemId}`)
  }

  const handleCloseDetail = async () => {
    setDetailItemId(null)
    navigate('/')
    await loadItems()
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        style={{
          height: 32,
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0 12px',
          paddingRight: 150,
          WebkitAppRegion: 'drag' as any,
        } as any}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.2 }}>{tr('app.title')}</span>
      </div>

      <div style={{
        background: 'var(--bg-secondary)', padding: '12px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap', fontSize: 14,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0, justifyContent: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 320px', width: 320, minWidth: 320 }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={tr('filters.searchPlaceholder')}
              style={{ width: '100%', maxWidth: 320 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
            <select value={contentType} onChange={e => { setContentType(e.target.value); setPage(1) }}>
              <option value="">{tr('filters.allTypes')}</option>
              <option value="book">{tr('filters.type.book')}</option>
              <option value="comic">{tr('filters.type.comic')}</option>
              <option value="video">{tr('filters.type.video')}</option>
              <option value="other">{tr('filters.type.other')}</option>
            </select>

            <select value={language} onChange={e => { setLanguage(e.target.value); setPage(1) }}>
              <option value="">{tr('filters.allLanguages')}</option>
              <option value="ko">{tr('filters.language.ko')}</option>
              <option value="ja">{tr('filters.language.ja')}</option>
              <option value="en">{tr('filters.language.en')}</option>
              <option value="zh">{tr('filters.language.zh')}</option>
              <option value="other">{tr('filters.language.other')}</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={watched === true}
                onChange={e => setWatched(e.target.checked ? true : undefined)}
              />
              {tr('filters.watched')}
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="createdAt">{tr('filters.sort.createdAt')}</option>
              <option value="updatedAt">{tr('filters.sort.updatedAt')}</option>
              <option value="title">{tr('filters.sort.title')}</option>
              <option value="fileModifiedAt">{tr('filters.sort.fileModifiedAt')}</option>
            </select>

            <button
              className="btn-secondary"
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              style={{ padding: '6px 10px' }}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flex: '0 0 auto' }}>
          <button className="btn-primary" onClick={handleAddFile}>{tr('actions.addFile')}</button>
          <button className="btn-secondary" title={tr('app.reload')} onClick={() => window.api.app.reload()} style={{ padding: '6px 10px' }}>↻</button>
          <button className="btn-secondary" title={tr('actions.settings')} onClick={() => setSettingsModalOpen(true)} style={{ padding: '6px 10px' }}>⚙</button>
        </div>
      </div>

      <div style={{ padding: '8px 16px', fontSize: 12, color: '#a0a0b0', flexShrink: 0 }}>
        {tr('library.items', { count: total })} {loading && tr('library.loading')}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              thumbnailUrl={thumbnails[item.id]}
              onClick={() => handleOpenDetail(item.id)}
            />
          ))}
        </div>

        {total > perPage && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: 16 }}>
            <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{tr('library.prev')}</button>
            <span style={{ alignSelf: 'center' }}>{tr('library.page', { page, total: Math.ceil(total / perPage) })}</span>
            <button className="btn-secondary" disabled={page * perPage >= total} onClick={() => setPage(p => p + 1)}>{tr('library.next')}</button>
          </div>
        )}
      </div>

      <Modal open={!!duplicateModal} onClose={() => setDuplicateModal(null)} title={tr('modal.duplicate.title')}>
        <p>{tr('modal.duplicate.message', { fileName: duplicateModal?.fileName ?? '' })}</p>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => setDuplicateModal(null)}>{tr('common.ok')}</button>
        </div>
      </Modal>

      <Modal
        open={detailItemId !== null}
        onClose={handleCloseDetail}
        contentWidth={600}
        contentHeight="calc(100vh - 100px)"
        contentMaxWidth="calc(100vw - 80px)"
        contentPadding={0}
      >
        {detailItemId !== null && <ItemDetailPage itemId={detailItemId} onClose={handleCloseDetail} />}
      </Modal>

      <Modal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <h3 style={{ fontSize: 18, margin: 0 }}>{tr('settings.title')}</h3>
            <button className="btn-secondary" title={tr('app.devTools')} onClick={() => window.api.app.toggleDevTools()} style={{ padding: '6px 10px' }}>🛠</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2%' }}>
            <div style={{ flex: '2 1 0', minWidth: 120 }}>
              <h3 style={{ fontSize: 14, margin: 0 }}>{tr('settings.zoom.title')}</h3>
            </div>
            <div style={{ flex: '3 1 0', minWidth: 160, width: '100%', display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <button className="btn-secondary" title={tr('app.zoomOut')} style={{ padding: '6px 10px', flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => window.api.app.zoomOut()}>－</button>
              <button className="btn-secondary" title={tr('app.zoomReset')} style={{ padding: '6px 10px', flex: '1 1 auto', minWidth: 0, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => window.api.app.zoomReset()}>100%</button>
              <button className="btn-secondary" title={tr('app.zoomIn')} style={{ padding: '6px 10px', flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => window.api.app.zoomIn()}>＋</button>
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, paddingLeft: '2%', paddingRight: '2%', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: '2 1 0', minWidth: 120 }}>
                <h3 style={{ fontSize: 14, margin: 0 }}>{tr('settings.language.title')}</h3>
              </div>
              <div style={{ flex: '3 1 0', minWidth: 160 }}>
                <select
                  value={languageSetting}
                  onChange={e => handleChangeLanguageSetting(e.target.value as LanguageSetting)}
                  style={{ width: '100%' }}
                >
                  <option value="system">{tr('settings.language.system')}</option>
                  <option value="en">{tr('settings.language.en')}</option>
                  <option value="ko">{tr('settings.language.ko')}</option>
                  <option value="ja">{tr('settings.language.ja')}</option>
                  <option value="zh">{tr('settings.language.zh')}</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, paddingLeft: '2%', paddingRight: '2%', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 4 }}>{tr('settings.filePolicy.title')}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 12 }}>
              {tr('settings.filePolicy.help')}
            </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              value="once"
              checked={fileModifiedPolicy === 'once'}
              onChange={() => handleChangeFileModifiedPolicy('once')}
            />
            <div>
              <div style={{ fontSize: 14 }}>{tr('settings.filePolicy.once')}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{tr('settings.filePolicy.onceHelp')}</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              value="always"
              checked={fileModifiedPolicy === 'always'}
              onChange={() => handleChangeFileModifiedPolicy('always')}
            />
            <div>
              <div style={{ fontSize: 14 }}>{tr('settings.filePolicy.always')}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{tr('settings.filePolicy.alwaysHelp')}</div>
            </div>
          </label>
          </div>
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" style={{ width: '33%', minWidth: 140, paddingTop: 8, paddingBottom: 8 }} onClick={() => setSettingsModalOpen(false)}>{tr('common.close')}</button>
        </div>
      </Modal>
    </div>
  )
}
