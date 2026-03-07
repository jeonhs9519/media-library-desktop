import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Item } from '../types'
import Modal from '../components/Modal'
import type { LanguageSetting } from '../i18n/index'
import { useI18n } from '../useI18n'
import ItemDetailPage from './ItemDetailPage'
import { api } from '../api'

const CARD_SIZE = 160
const THUMB_SIZE = 128

function getContentTypeIcon(ct: string) {
  switch (ct) {
    case 'book': return 'BOOK'
    case 'comic': return 'COMIC'
    case 'video': return 'VIDEO'
    default: return 'FILE'
  }
}

function getLanguageFlag(lang: string) {
  switch (lang) {
    case 'ko': return 'KO'
    case 'ja': return 'JA'
    case 'en': return 'EN'
    case 'zh': return 'ZH'
    default: return ''
  }
}

interface CardProps {
  item: Item & { fileExists?: boolean }
  thumbnailUrl?: string
  onClick: () => void
}

type HdtPreviewItem = {
  previewId: string
  sourceFile: string
  title: string
  sourceUrl?: string
  author?: string
  filePath: string
  fileName: string
  fileExtension: string
  contentType: 'comic' | 'video'
  duplicate: boolean
  hasThumbnail: boolean
  thumbnailBase64?: string
  disabledReason?: 'missing_title' | 'missing_path' | 'invalid_entry' | 'duplicate'
}

type HdtPreviewStats = {
  rawTotal: number
  visibleTotal: number
  selectableTotal: number
}

type HdtPreviewResponse = {
  items: HdtPreviewItem[]
  stats: HdtPreviewStats
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
          }}>X</div>
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
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false)
  const [fileUploadDragging, setFileUploadDragging] = useState(false)
  const [fileUploadNotice, setFileUploadNotice] = useState('')
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [fileModifiedPolicy, setFileModifiedPolicy] = useState('once')
  const [hdtUploadModalOpen, setHdtUploadModalOpen] = useState(false)
  const [hdtUploadDragging, setHdtUploadDragging] = useState(false)
  const [hdtUploadNotice, setHdtUploadNotice] = useState('')
  const [hdtModalOpen, setHdtModalOpen] = useState(false)
  const [hdtPreviewItems, setHdtPreviewItems] = useState<HdtPreviewItem[]>([])
  const [hdtPreviewStats, setHdtPreviewStats] = useState<HdtPreviewStats>({ rawTotal: 0, visibleTotal: 0, selectableTotal: 0 })
  const [hdtSelectedIds, setHdtSelectedIds] = useState<string[]>([])
  const [hdtApplying, setHdtApplying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const perPage = 100
  const { tr, languageSetting, changeLanguageSetting } = useI18n()

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.items.getAll({
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
          const thumb = await api.thumbnail.get(item.id)
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
    api.settings.get('fileModifiedAt.updatePolicy').then((v: string | undefined) => {
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

  useEffect(() => {
    if (!hdtUploadModalOpen) return

    const allowFileDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    window.addEventListener('dragenter', allowFileDrop)
    window.addEventListener('dragover', allowFileDrop)
    window.addEventListener('drop', allowFileDrop)

    return () => {
      window.removeEventListener('dragenter', allowFileDrop)
      window.removeEventListener('dragover', allowFileDrop)
      window.removeEventListener('drop', allowFileDrop)
    }
  }, [hdtUploadModalOpen])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    if (fileUploadModalOpen || hdtUploadModalOpen || hdtModalOpen) return
    const paths = getDroppedFilePaths(Array.from(e.dataTransfer.files))

    for (const filePath of paths) {
      await addFile(filePath)
    }
  }, [fileUploadModalOpen, hdtUploadModalOpen, hdtModalOpen])

  const getDroppedFilePaths = (files: File[]) => files
    .map((file) => {
      const directPath = (file as any).path as string | undefined
      if (directPath) return directPath
      const resolvedPath = api.file.getPathForFile(file as any)
      return resolvedPath || undefined
    })
    .filter((p): p is string => Boolean(p))

  const addFile = async (filePath: string) => {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    const dir = filePath.substring(0, lastSlash)
    const baseName = filePath.substring(lastSlash + 1)
    const lastDot = baseName.lastIndexOf('.')
    const fileName = lastDot > 0 ? baseName.substring(0, lastDot) : baseName
    const fileExtension = lastDot > 0 ? baseName.substring(lastDot + 1) : ''

    const exists = await api.items.checkExists(dir, fileName, fileExtension)
    if (exists) {
      setDuplicateModal({ fileName: baseName })
      return
    }

    const stat = await api.file.readStat(filePath)
    await api.items.add({
      filePath: dir,
      fileName,
      fileExtension,
      fileModifiedAt: stat?.mtime,
    })
    await loadItems()
  }

  const beginFileAdd = async (paths: string[]) => {
    if (!paths.length) {
      setFileUploadNotice(tr('modal.fileUpload.noFilesAdded'))
      return
    }

    setFileUploadNotice('')
    for (const p of paths) {
      await addFile(p)
    }
    setFileUploadDragging(false)
    setFileUploadNotice('')
    setFileUploadModalOpen(false)
  }

  const handleOpenFileUploadModal = () => {
    setFileUploadNotice('')
    setFileUploadDragging(false)
    setFileUploadModalOpen(true)
  }

  const handleBrowseFiles = async () => {
    const paths = await api.file.openDialog()
    await beginFileAdd(paths)
  }

  const handleFileUploadDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFileUploadDragging(false)

    const hasFiles = Array.from(e.dataTransfer.types || []).includes('Files')
    if (!hasFiles) {
      setFileUploadNotice(tr('modal.fileUpload.invalidSelection'))
      return
    }

    const paths = getDroppedFilePaths(Array.from(e.dataTransfer.files))
    if (!paths.length) {
      setFileUploadNotice(tr('modal.fileUpload.dropBlocked'))
      return
    }

    await beginFileAdd(paths)
  }

  const handleFileUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    if (!fileUploadDragging) setFileUploadDragging(true)
  }

  const handleFileUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFileUploadDragging(false)
  }

  const beginHdtPreview = async (paths: string[]) => {
    if (!paths.length) return

    const hdtPaths = paths.filter((p) => p.toLowerCase().endsWith('.hdt'))
    if (!hdtPaths.length) {
      setHdtUploadNotice(tr('modal.hdtUpload.invalidSelection'))
      return
    }

    setHdtUploadNotice('')
    const previewResult = await api.items.importHdtPreview(hdtPaths) as HdtPreviewItem[] | HdtPreviewResponse
    const previewItems = Array.isArray(previewResult) ? previewResult : previewResult.items
    const stats = Array.isArray(previewResult)
      ? {
          rawTotal: previewItems.length,
          visibleTotal: previewItems.length,
          selectableTotal: previewItems.filter((item: HdtPreviewItem) => !item.disabledReason).length,
        }
      : previewResult.stats

    if (!previewItems.length) {
      setHdtUploadNotice(tr('modal.hdtUpload.noPreview'))
      return
    }

    const selectableIds = previewItems
      .filter((item: HdtPreviewItem) => !item.disabledReason)
      .map((item: HdtPreviewItem) => item.previewId)

    setHdtPreviewItems(previewItems)
    setHdtPreviewStats(stats)
    setHdtSelectedIds(selectableIds)
    setHdtUploadDragging(false)
    setHdtUploadNotice('')
    setHdtUploadModalOpen(false)
    setHdtModalOpen(true)
  }

  const handleOpenHdtUploadModal = () => {
    setHdtUploadNotice('')
    setHdtUploadDragging(false)
    setHdtUploadModalOpen(true)
  }

  const handleBrowseHdtFiles = async () => {
    const paths = await api.file.openDialog([
      { name: 'HDT Files', extensions: ['hdt'] },
      { name: 'All Files', extensions: ['*'] },
    ])
    await beginHdtPreview(paths)
  }

  const handleHdtUploadDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setHdtUploadDragging(false)

    const hasFiles = Array.from(e.dataTransfer.types || []).includes('Files')
    if (!hasFiles) {
      setHdtUploadNotice(tr('modal.hdtUpload.invalidSelection'))
      return
    }

    const files = Array.from(e.dataTransfer.files)
    const paths = files
      .map((file) => {
        const directPath = (file as any).path as string | undefined
        if (directPath) return directPath
        const resolvedPath = api.file.getPathForFile(file as any)
        return resolvedPath || undefined
      })
      .filter((p): p is string => Boolean(p))

    if (!paths.length) {
      setHdtUploadNotice(tr('modal.hdtUpload.dropBlocked'))
      return
    }

    await beginHdtPreview(paths)
  }

  const handleHdtUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    if (!hdtUploadDragging) setHdtUploadDragging(true)
  }

  const handleHdtUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setHdtUploadDragging(false)
  }

  const handleToggleHdtItem = (previewId: string) => {
    setHdtSelectedIds((prev) => (
      prev.includes(previewId)
        ? prev.filter((id) => id !== previewId)
        : [...prev, previewId]
    ))
  }

  const handleApplyHdt = async () => {
    if (!hdtSelectedIds.length) {
      setHdtModalOpen(false)
      setHdtPreviewItems([])
      setHdtPreviewStats({ rawTotal: 0, visibleTotal: 0, selectableTotal: 0 })
      return
    }

    setHdtApplying(true)
    try {
      await api.items.importHdtApply(hdtSelectedIds)
      setHdtModalOpen(false)
      setHdtPreviewItems([])
      setHdtPreviewStats({ rawTotal: 0, visibleTotal: 0, selectableTotal: 0 })
      setHdtSelectedIds([])
      await loadItems()
    } finally {
      setHdtApplying(false)
    }
  }

  const getHdtReasonLabel = (item: HdtPreviewItem) => {
    if (item.disabledReason === 'duplicate') return tr('modal.hdtImport.reason.duplicate')
    if (item.disabledReason === 'missing_title') return tr('modal.hdtImport.reason.missingTitle')
    if (item.disabledReason === 'missing_path') return tr('modal.hdtImport.reason.missingPath')
    if (item.disabledReason === 'invalid_entry') return tr('modal.hdtImport.reason.invalidEntry')
    return tr('modal.hdtImport.reason.ready')
  }

  const groupedHdtPreviewItems = useMemo(() => {
    const groups = new Map<string, HdtPreviewItem[]>()
    for (const item of hdtPreviewItems) {
      const current = groups.get(item.sourceFile) ?? []
      current.push(item)
      groups.set(item.sourceFile, current)
    }
    return Array.from(groups.entries()).map(([sourceFile, items]) => ({ sourceFile, items }))
  }, [hdtPreviewItems])

  const handleSelectHdtGroup = (previewIds: string[]) => {
    if (hdtApplying || !previewIds.length) return
    setHdtSelectedIds((prev) => Array.from(new Set([...prev, ...previewIds])))
  }

  const handleClearHdtGroup = (previewIds: string[]) => {
    if (hdtApplying || !previewIds.length) return
    const idSet = new Set(previewIds)
    setHdtSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
  }

  const handleChangeFileModifiedPolicy = async (value: string) => {
    setFileModifiedPolicy(value)
    await api.settings.set('fileModifiedAt.updatePolicy', value)
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
              {sortDir === 'asc' ? 'up' : 'down'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flex: '0 0 auto' }}>
          <button className="btn-primary" onClick={handleOpenFileUploadModal}>{tr('actions.addFile')}</button>
          <button className="btn-secondary" onClick={handleOpenHdtUploadModal}>{tr('actions.importHdt')}</button>
          <button className="btn-secondary" title={tr('app.reload')} onClick={() => api.app.reload()} style={{ padding: '6px 10px' }}>R</button>
          <button className="btn-secondary" title={tr('actions.settings')} onClick={() => setSettingsModalOpen(true)} style={{ padding: '6px 10px' }}>S</button>
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
        open={fileUploadModalOpen}
        onClose={() => {
          setFileUploadModalOpen(false)
          setFileUploadDragging(false)
          setFileUploadNotice('')
        }}
        title={tr('modal.fileUpload.title')}
        contentWidth={640}
        contentMaxWidth="min(92vw, 760px)"
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {tr('modal.fileUpload.description')}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          {tr('modal.fileUpload.supported')}
        </p>

        <div
          className={`hdt-upload-dropzone${fileUploadDragging ? ' is-dragging' : ''}`}
          onClick={handleBrowseFiles}
          onDragEnter={handleFileUploadDragOver}
          onDragOver={handleFileUploadDragOver}
          onDragLeave={handleFileUploadDragLeave}
          onDrop={handleFileUploadDrop}
        >
          <div className="hdt-upload-dropzone-title">
            {fileUploadDragging ? tr('modal.fileUpload.dropActive') : tr('modal.fileUpload.dropHere')}
          </div>
          <div className="hdt-upload-dropzone-sub">{tr('modal.fileUpload.dropHint')}</div>
        </div>

        {fileUploadNotice && (
          <div className="hdt-upload-notice">{fileUploadNotice}</div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => {
              setFileUploadModalOpen(false)
              setFileUploadDragging(false)
              setFileUploadNotice('')
            }}
          >
            {tr('common.cancel')}
          </button>
        </div>
      </Modal>

      <Modal
        open={hdtUploadModalOpen}
        onClose={() => {
          setHdtUploadModalOpen(false)
          setHdtUploadDragging(false)
          setHdtUploadNotice('')
        }}
        title={tr('modal.hdtUpload.title')}
        contentWidth={640}
        contentMaxWidth="min(92vw, 760px)"
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {tr('modal.hdtUpload.description')}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          {tr('modal.hdtUpload.supported')}
        </p>

        <div
          className={`hdt-upload-dropzone${hdtUploadDragging ? ' is-dragging' : ''}`}
          onClick={handleBrowseHdtFiles}
          onDragEnter={handleHdtUploadDragOver}
          onDragOver={handleHdtUploadDragOver}
          onDragLeave={handleHdtUploadDragLeave}
          onDrop={handleHdtUploadDrop}
        >
          <div className="hdt-upload-dropzone-title">
            {hdtUploadDragging ? tr('modal.hdtUpload.dropActive') : tr('modal.hdtUpload.dropHere')}
          </div>
          <div className="hdt-upload-dropzone-sub">{tr('modal.hdtUpload.dropHint')}</div>
        </div>

        {hdtUploadNotice && (
          <div className="hdt-upload-notice">{hdtUploadNotice}</div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => {
              setHdtUploadModalOpen(false)
              setHdtUploadDragging(false)
              setHdtUploadNotice('')
            }}
          >
            {tr('common.cancel')}
          </button>
        </div>
      </Modal>

      <Modal
        open={hdtModalOpen}
        onClose={() => {
          if (hdtApplying) return
          setHdtModalOpen(false)
          setHdtPreviewItems([])
          setHdtPreviewStats({ rawTotal: 0, visibleTotal: 0, selectableTotal: 0 })
          setHdtSelectedIds([])
        }}
        title={tr('modal.hdtImport.title')}
        contentMaxHeight="88vh"
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
          {tr('modal.hdtImport.summaryDetailed', {
            raw: hdtPreviewStats.rawTotal,
            visible: hdtPreviewStats.visibleTotal,
            selected: hdtSelectedIds.length,
          })}
        </div>

        <div className="hdt-preview-list">
          {groupedHdtPreviewItems.map((group) => (
            <section key={group.sourceFile} className="hdt-preview-group">
              {(() => {
                const selectableIds = group.items
                  .filter((item) => !item.disabledReason)
                  .map((item) => item.previewId)
                const selectedCount = selectableIds.filter((id) => hdtSelectedIds.includes(id)).length
                const allSelected = selectableIds.length > 0 && selectedCount === selectableIds.length

                return (
              <div className="hdt-preview-group-header">
                <span className="hdt-preview-group-title" title={group.sourceFile}>{group.sourceFile}</span>
                <div className="hdt-preview-group-header-right">
                  <span className="hdt-preview-group-count">{tr('modal.hdtImport.groupCount', { count: group.items.length })}</span>
                  <span className="hdt-preview-group-selected">{tr('modal.hdtImport.groupSelected', { selected: selectedCount, total: selectableIds.length })}</span>
                  <button
                    type="button"
                    className="hdt-preview-group-action"
                    disabled={hdtApplying || !selectableIds.length || allSelected}
                    onClick={() => handleSelectHdtGroup(selectableIds)}
                  >
                    {tr('modal.hdtImport.groupAction.selectAll')}
                  </button>
                  <button
                    type="button"
                    className="hdt-preview-group-action"
                    disabled={hdtApplying || selectedCount === 0}
                    onClick={() => handleClearHdtGroup(selectableIds)}
                  >
                    {tr('modal.hdtImport.groupAction.clear')}
                  </button>
                </div>
              </div>
                )
              })()}

              <div className="hdt-preview-group-items">
                {group.items.map((item) => {
                  const disabled = !!item.disabledReason || hdtApplying
                  const checked = hdtSelectedIds.includes(item.previewId)
                  const fileLabel = `${item.fileName}${item.fileExtension ? `.${item.fileExtension}` : ''}`
                  const cardClassName = [
                    'hdt-preview-card',
                    checked ? 'is-checked' : 'is-unchecked',
                    disabled ? 'is-disabled' : '',
                  ].filter(Boolean).join(' ')

                  return (
                    <button
                      key={item.previewId}
                      type="button"
                      className={cardClassName}
                      onClick={() => {
                        if (disabled) return
                        handleToggleHdtItem(item.previewId)
                      }}
                      title={item.title || tr('modal.hdtImport.untitled')}
                    >
                      <div className="hdt-preview-thumb-wrap">
                        {item.thumbnailBase64 ? (
                          <img
                            className="hdt-preview-thumb"
                            src={`data:image/jpeg;base64,${item.thumbnailBase64}`}
                            alt={item.title || tr('modal.hdtImport.untitled')}
                          />
                        ) : (
                          <div className="hdt-preview-thumb-fallback" aria-hidden="true">{getContentTypeIcon(item.contentType)}</div>
                        )}
                      </div>

                      <div className="hdt-preview-main">
                        <div className="hdt-preview-title">{item.title || tr('modal.hdtImport.untitled')}</div>
                        <div className="hdt-preview-subline">{tr('modal.hdtImport.field.type')}: {item.contentType}</div>
                        <div className="hdt-preview-subline" title={item.sourceUrl || tr('detail.unknown')}>
                          {tr('modal.hdtImport.field.sourceUrl')}: {item.sourceUrl || tr('detail.unknown')}
                        </div>
                        <div className="hdt-preview-subline" title={item.author || tr('detail.unknown')}>
                          {tr('modal.hdtImport.field.author')}: {item.author || tr('detail.unknown')}
                        </div>
                        <div className="hdt-preview-subline" title={`${item.filePath}\\${fileLabel}`}>
                          {tr('modal.hdtImport.field.targetFile')}: {item.filePath}\\{fileLabel}
                        </div>
                      </div>

                      <div className="hdt-preview-state">{getHdtReasonLabel(item)}</div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => {
              if (hdtApplying) return
              setHdtModalOpen(false)
              setHdtPreviewItems([])
              setHdtPreviewStats({ rawTotal: 0, visibleTotal: 0, selectableTotal: 0 })
              setHdtSelectedIds([])
            }}
            disabled={hdtApplying}
          >
            {tr('common.cancel')}
          </button>
          <button className="btn-primary" onClick={handleApplyHdt} disabled={hdtApplying || !hdtSelectedIds.length}>
            {hdtApplying ? tr('common.loading') : tr('modal.hdtImport.apply')}
          </button>
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
            <button className="btn-secondary" title={tr('app.devTools')} onClick={() => api.app.toggleDevTools()} style={{ padding: '6px 10px' }}>DEV</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2%' }}>
            <div style={{ flex: '2 1 0', minWidth: 120 }}>
              <h3 style={{ fontSize: 14, margin: 0 }}>{tr('settings.zoom.title')}</h3>
            </div>
            <div style={{ flex: '3 1 0', minWidth: 160, width: '100%', display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <button className="btn-secondary" title={tr('app.zoomOut')} style={{ padding: '6px 10px', flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => api.app.zoomOut()}>-</button>
              <button className="btn-secondary" title={tr('app.zoomReset')} style={{ padding: '6px 10px', flex: '1 1 auto', minWidth: 0, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => api.app.zoomReset()}>100%</button>
              <button className="btn-secondary" title={tr('app.zoomIn')} style={{ padding: '6px 10px', flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => api.app.zoomIn()}>+</button>
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

