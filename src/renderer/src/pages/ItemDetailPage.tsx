import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Item, Tag } from '../types'
import Modal from '../components/Modal'
import StarRating from '../components/StarRating'
import { useI18n } from '../useI18n'

function formatVideoProgress(currentRaw: number, totalRaw: number): string {
  const total = Math.max(0, Math.floor(totalRaw))
  const current = Math.min(total, Math.max(0, Math.floor(currentRaw)))

  if (total < 60) {
    return `00:${current.toString().padStart(2, '0')}/00:${total.toString().padStart(2, '0')}`
  }

  if (total < 3600) {
    const cm = Math.floor(current / 60).toString().padStart(2, '0')
    const cs = (current % 60).toString().padStart(2, '0')
    const tm = Math.floor(total / 60).toString().padStart(2, '0')
    const ts = (total % 60).toString().padStart(2, '0')
    return `${cm}:${cs}/${tm}:${ts}`
  }

  const ch = Math.floor(current / 3600).toString().padStart(2, '0')
  const cm = Math.floor((current % 3600) / 60).toString().padStart(2, '0')
  const cs = (current % 60).toString().padStart(2, '0')
  const th = Math.floor(total / 3600).toString().padStart(2, '0')
  const tm = Math.floor((total % 3600) / 60).toString().padStart(2, '0')
  const ts = (total % 60).toString().padStart(2, '0')
  return `${ch}:${cm}:${cs}/${th}:${tm}:${ts}`
}

function formatProgressDetail(item: any): string {
  const pct = Math.round(item.progress * 100)
  if (!item.totalContent) return `${pct}%`

  if (item.containerType === 'video') {
    const pos = item.lastPositionSeconds ?? 0
    return `${formatVideoProgress(pos, item.totalContent)} (${pct}%)`
  }

  // book / comic: lastPageIndex is 0-based
  const current = (item.lastPageIndex ?? 0) + 1
  const total = Math.round(item.totalContent)
  return `${current}p/${total}p (${pct}%)`
}

function isReservedTagName(name: string, untaggedLabel: string) {
  const normalized = name.trim().toLocaleLowerCase()
  return ['미지정', 'untagged', '未指定', untaggedLabel.toLocaleLowerCase()].includes(normalized)
}

function getDisplayPathSeparator() {
  return /\bWin/i.test(navigator.platform) ? '\\' : '/'
}

function normalizeDisplayPath(input: string) {
  return input.replace(/[\\/]+/g, getDisplayPathSeparator())
}

function buildDisplayItemPath(item: { filePath: string; fileName: string; fileExtension?: string }) {
  const separator = getDisplayPathSeparator()
  const normalizedDir = normalizeDisplayPath(item.filePath).replace(/[\\/]+$/, '')
  const fileLabel = `${item.fileName}${item.fileExtension ? `.${item.fileExtension}` : ''}`
  return `${normalizedDir}${separator}${fileLabel}`
}

interface ItemDetailPageProps {
  itemId: number
  onClose: () => void
  onAddToPlaylist?: (item: Item) => void
}

export default function ItemDetailPage({ itemId, onClose, onAddToPlaylist }: ItemDetailPageProps) {
  const navigate = useNavigate()
  const [item, setItem] = useState<any>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [reviewModal, setReviewModal] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' })
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [isTagComposing, setIsTagComposing] = useState(false)
  const [tagInputError, setTagInputError] = useState('')
  const [relinkModal, setRelinkModal] = useState(false)
  const [relinkDuplicate, setRelinkDuplicate] = useState<{
    targetPath: string
    duplicatePath: string
    duplicateTitle?: string
  } | null>(null)
  const [relinkErrorOpen, setRelinkErrorOpen] = useState(false)
  const [relinkErrorMessage, setRelinkErrorMessage] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const { tr } = useI18n()

  useEffect(() => {
    const load = async () => {
      const data = await api.items.getById(itemId)
      setItem(data)
      setEditForm({
        title: data?.title || '',
        contentType: data?.contentType || 'other',
        language: data?.language || '',
        author: data?.author || '',
        memo: data?.memo || '',
        sourceUrl: data?.sourceUrl || '',
        watched: data?.watched === 1,
      })
      if (data?.review) {
        setReviewForm({ rating: data.review.rating, comment: data.review.comment || '' })
      }
      const thumb = await api.thumbnail.get(itemId)
      if (thumb) setThumbnail(`data:image/jpeg;base64,${thumb}`)
    }
    load()
    api.tags.getAll().then(setAllTags)
  }, [itemId])

  if (!item) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tr('common.loading')}</div>
  }

  const fullPath = buildDisplayItemPath(item)

  const handleSave = async () => {
    await api.items.update(itemId, {
      ...editForm,
      watched: editForm.watched ? 1 : 0,
    })
    setEditing(false)
    const data = await api.items.getById(itemId)
    setItem(data)
  }

  const handleDelete = () => {
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteBusy(true)
    try {
      await api.items.delete(itemId)
      setDeleteConfirmOpen(false)
      onClose()
    } catch (error) {
      console.error('Failed to delete item:', error)
      setDeleteBusy(false)
    }
  }

  const handleRelink = async () => {
    try {
      const paths = await api.file.openDialog()
      if (paths.length > 0) {
        const result = await api.items.relink(itemId, paths[0])

        if (result?.ok === false && result?.reason === 'duplicate') {
          const dup = result.duplicate
          const duplicatePath = dup
            ? buildDisplayItemPath(dup)
            : ''

          setRelinkDuplicate({
            targetPath: result.targetPath || paths[0],
            duplicatePath,
            duplicateTitle: dup?.title,
          })
        } else if (result?.ok === false) {
          setRelinkErrorMessage(String(result?.message || ''))
          setRelinkErrorOpen(true)
        } else {
          const data = await api.items.getById(itemId)
          setItem(data)
        }
      }
    } catch (error: any) {
      setRelinkErrorMessage(String(error?.message || ''))
      setRelinkErrorOpen(true)
    } finally {
      setRelinkModal(false)
    }
  }

  const handleOpenViewer = () => {
    const state = { returnTo: `/items/${itemId}` }
    if (item.containerType === 'pdf') navigate(`/view/pdf/${itemId}`, { state })
    else if (item.containerType === 'zip') navigate(`/view/cbz/${itemId}`, { state })
    else if (item.containerType === 'video') navigate(`/view/video/${itemId}`, { state })
  }

  const handleAddTag = async () => {
    const trimmed = newTagName.trim()
    if (!trimmed) return
    if (isReservedTagName(trimmed, tr('filters.untagged'))) {
      setTagInputError(tr('detail.invalidTagNameShort'))
      window.setTimeout(() => setTagInputError(''), 2600)
      return
    }

    let tag = allTags.find(t => t.name === trimmed)

    if (!tag) {
      try {
        tag = await api.tags.create(trimmed)
        setAllTags(prev => [...prev, tag!])
      } catch {
        const refreshedTags = await api.tags.getAll()
        setAllTags(refreshedTags)
        tag = refreshedTags.find((t: Tag) => t.name === trimmed)
      }
    }

    if (!tag) return

    await api.tags.assignToItem(itemId, tag.id)
    setNewTagName('')
    const data = await api.items.getById(itemId)
    setItem(data)
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isTagComposing) {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleRemoveTag = async (tagId: number) => {
    await api.tags.removeFromItem(itemId, tagId)
    const data = await api.items.getById(itemId)
    setItem(data)
  }

  const handleReviewSave = async () => {
    await api.reviews.upsert(itemId, reviewForm.rating, reviewForm.comment)
    setReviewModal(false)
    const data = await api.items.getById(itemId)
    setItem(data)
  }

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          <div style={{
            width: 128, height: 128, background: 'var(--bg-card)', borderRadius: 8,
            overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)',
            filter: item.fileExists === false ? 'grayscale(100%)' : 'none',
          }}>
            {thumbnail
              ? <img src={thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.title} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 48 }}>
                  {item.contentType === 'video' ? '🎬' : item.contentType === 'comic' ? '🎨' : '📚'}
                </div>
            }
          </div>

          <div style={{ flex: 1 }}>
            {editing ? (
              <input value={editForm.title} onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                style={{ fontSize: 24, width: '100%', marginBottom: 8 }} />
            ) : (
              <h1 style={{ fontSize: 24, marginBottom: 8 }}>{item.title}</h1>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-primary" style={{ width: 128 }} onClick={handleOpenViewer} disabled={item.fileExists === false}>
              {tr('detail.openViewer')}
            </button>
            {onAddToPlaylist && (
              <button
                className="btn-secondary"
                style={{ width: 128 }}
                onClick={() => onAddToPlaylist(item)}
                disabled={item.contentType === 'other'}
              >
                {tr('playlist.addToList')}
              </button>
            )}
            <button className="btn-secondary" style={{ width: 128 }} onClick={() => api.file.openExternal(fullPath)}>
              {tr('detail.openExternal')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn-secondary" onClick={() => setEditing(!editing)}>
              {editing ? tr('common.cancel') : tr('common.edit')}
            </button>
            {editing && <button className="btn-primary" onClick={handleSave}>{tr('common.save')}</button>}
            <button className="btn-danger" onClick={handleDelete}>{tr('common.delete')}</button>
          </div>
        </div>
      </div>

      <div className="detail-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{tr('detail.metadata')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12, rowGap: 12 }}>
            <Field label={tr('detail.contentType')}>
              {editing
                ? <select value={editForm.contentType} onChange={e => setEditForm((f: any) => ({ ...f, contentType: e.target.value }))}>
                    <option value="book">{tr('filters.type.book')}</option>
                    <option value="comic">{tr('filters.type.comic')}</option>
                    <option value="video">{tr('filters.type.video')}</option>
                    <option value="other">{tr('filters.type.other')}</option>
                  </select>
                : tr(`filters.type.${item.contentType}`)
              }
            </Field>
            <Field label={tr('detail.language')}>
              {editing
                ? <select value={editForm.language} onChange={e => setEditForm((f: any) => ({ ...f, language: e.target.value }))}>
                    <option value="">{tr('detail.unknown')}</option>
                    <option value="ko">{tr('filters.language.ko')}</option>
                    <option value="ja">{tr('filters.language.ja')}</option>
                    <option value="en">{tr('filters.language.en')}</option>
                    <option value="zh">{tr('filters.language.zh')}</option>
                    <option value="other">{tr('filters.language.other')}</option>
                  </select>
                : (item.language ? tr(`filters.language.${item.language}`) : tr('detail.unknown'))
              }
            </Field>
            <Field label={tr('detail.author')} style={{ gridColumn: '1 / -1' }}>
              {editing
                ? <input value={editForm.author} onChange={e => setEditForm((f: any) => ({ ...f, author: e.target.value }))} style={{ width: '100%' }} />
                : (item.author || '—')
              }
            </Field>
            <Field label={tr('detail.progress')}>{formatProgressDetail(item)}</Field>
            <Field label={tr('detail.watched')}>
              {editing
                ? <input type="checkbox" checked={editForm.watched} onChange={e => setEditForm((f: any) => ({ ...f, watched: e.target.checked }))} />
                : (item.watched ? '✓' : '✗')
              }
            </Field>
            <Field label={tr('detail.sourceUrl')} style={{ gridColumn: '1 / -1' }}>
              {editing
                ? <input value={editForm.sourceUrl} onChange={e => setEditForm((f: any) => ({ ...f, sourceUrl: e.target.value }))} style={{ width: '100%' }} />
                : (item.sourceUrl
                    ? (
                        <a
                          href={item.sourceUrl}
                          style={{ color: 'var(--accent)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={item.sourceUrl}
                          onClick={(e) => {
                            e.preventDefault()
                            void api.file.openExternal(item.sourceUrl as string)
                          }}
                        >
                          {item.sourceUrl}
                        </a>
                      )
                    : '—')
              }
            </Field>
          </div>
          {editing && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>{tr('detail.memo')}</label>
              <textarea
                value={editForm.memo}
                onChange={e => setEditForm((f: any) => ({ ...f, memo: e.target.value }))}
                style={{ width: '100%', minHeight: 80 }}
              />
            </div>
          )}
          {!editing && item.memo && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>{tr('detail.memo')}</div>
              <div>{item.memo}</div>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{tr('detail.tags')}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {(item.tags || []).map((tag: Tag) => (
              <span key={tag.id} style={{
                background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 16, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {tag.name}
                <span onClick={() => handleRemoveTag(tag.id)} style={{ cursor: 'pointer', color: 'var(--accent)' }}>×</span>
              </span>
            ))}
          </div>
          <div className={`detail-tag-input-row${tagInputError ? ' has-error' : ''}`}>
            <input
              value={newTagName}
              onChange={e => {
                setNewTagName(e.target.value)
                if (tagInputError) setTagInputError('')
              }}
              onKeyDown={handleTagInputKeyDown}
              onCompositionStart={() => setIsTagComposing(true)}
              onCompositionEnd={() => setIsTagComposing(false)}
              placeholder={tr('detail.addTagPlaceholder')}
              list="all-tags"
            />
            <datalist id="all-tags">
              {allTags.map(t => <option key={t.id} value={t.name} />)}
            </datalist>
            <button className="btn-secondary" onClick={handleAddTag}>{tr('detail.add')}</button>
            <span
              className="detail-tag-input-error"
              title={tagInputError || tr('detail.invalidTagName')}
              aria-live="polite"
            >
              {tagInputError}
            </span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16 }}>{tr('detail.review')}</h2>
            <button className="btn-secondary" onClick={() => setReviewModal(true)}>
              {item.review ? tr('detail.editReview') : tr('detail.addReview')}
            </button>
          </div>
          {item.review ? (
            <div>
              <StarRating value={item.review.rating} readonly />
              {item.review.comment && <p style={{ marginTop: 8 }}>{item.review.comment}</p>}
            </div>
          ) : (
            <p style={{ color: '#a0a0b0' }}>{tr('detail.noReview')}</p>
          )}
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16 }}>{tr('detail.file')}</h2>
            <button
              className="btn-secondary"
              disabled={item.fileExists === false}
              onClick={() => api.file.showInFolder(fullPath)}
            >
              {tr('viewer.video.showInFolder')}
            </button>
          </div>
          <div style={{ fontSize: 13, color: item.fileExists === false ? '#b94a57' : 'var(--text-secondary)', marginBottom: 8, wordBreak: 'break-all' }}>
            {fullPath} {item.fileExists === false && `(${tr('detail.fileMissing')})`}
          </div>
          {editing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => setRelinkModal(true)}>{tr('detail.relink')}</button>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: '#a0a0b0' }}>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 4 }}>
              <li>{tr('detail.infoAdded')}: {new Date(item.createdAt).toLocaleString()}</li>
              <li>{tr('detail.infoUpdated')}: {new Date(item.updatedAt).toLocaleString()}</li>
              {item.fileModifiedAt && <li>{tr('detail.fileModified')}: {new Date(item.fileModifiedAt).toLocaleString()}</li>}
            </ul>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" style={{ width: '33%', minWidth: 140, paddingTop: 8, paddingBottom: 8 }} onClick={onClose}>{tr('common.close')}</button>
      </div>

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title={tr('detail.editReview')}>
        <div style={{ marginBottom: 16 }}>
          <StarRating value={reviewForm.rating} onChange={v => setReviewForm(f => ({ ...f, rating: v }))} />
        </div>
        <textarea
          value={reviewForm.comment}
          onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
          placeholder={tr('detail.commentPlaceholder')}
          style={{ width: '100%', minHeight: 100, marginBottom: 16 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setReviewModal(false)}>{tr('common.cancel')}</button>
          <button className="btn-primary" onClick={handleReviewSave}>{tr('common.save')}</button>
        </div>
      </Modal>

      <Modal open={relinkModal} onClose={() => setRelinkModal(false)} title={tr('detail.relink')}>
        <p style={{ marginBottom: 16 }}>{tr('detail.relinkDescription')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setRelinkModal(false)}>{tr('common.cancel')}</button>
          <button className="btn-primary" onClick={handleRelink}>{tr('detail.browse')}</button>
        </div>
      </Modal>

      <Modal open={!!relinkDuplicate} onClose={() => setRelinkDuplicate(null)} title={tr('detail.relinkDuplicateTitle')}>
        <p style={{ marginBottom: 8 }}>{tr('detail.relinkDuplicateMessage')}</p>
        {relinkDuplicate?.duplicateTitle && (
          <p style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            {tr('detail.relinkDuplicateItem')}: {relinkDuplicate.duplicateTitle}
          </p>
        )}
        {relinkDuplicate?.targetPath && (
          <p style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
            {tr('detail.relinkDuplicateTarget')}: {relinkDuplicate.targetPath}
          </p>
        )}
        {relinkDuplicate?.duplicatePath && (
          <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
            {tr('detail.relinkDuplicateExisting')}: {relinkDuplicate.duplicatePath}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => setRelinkDuplicate(null)}>{tr('common.ok')}</button>
        </div>
      </Modal>

      <Modal open={relinkErrorOpen} onClose={() => setRelinkErrorOpen(false)} title={tr('detail.relinkErrorTitle')}>
        <p style={{ marginBottom: 16 }}>{tr('detail.relinkErrorMessage')}</p>
        {relinkErrorMessage && (
          <pre style={{ marginBottom: 16, padding: 10, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {relinkErrorMessage}
          </pre>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => {
            setRelinkErrorOpen(false)
            setRelinkErrorMessage('')
          }}>{tr('common.ok')}</button>
        </div>
      </Modal>

      <Modal open={deleteConfirmOpen} onClose={() => { if (!deleteBusy) setDeleteConfirmOpen(false) }} title={tr('common.delete')}>
        <p style={{ marginBottom: 8 }}>{tr('detail.confirmDelete')}</p>
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>{tr('detail.deleteWarning')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteBusy}>
            {tr('common.cancel')}
          </button>
          <button className="btn-danger" onClick={handleDeleteConfirm} disabled={deleteBusy}>
            {deleteBusy ? tr('common.loading') : tr('common.delete')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ lineHeight: '24px', ...style }}>
      <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}
