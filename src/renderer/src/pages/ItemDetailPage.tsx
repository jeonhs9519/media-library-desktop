import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tag } from '../types'
import Modal from '../components/Modal'
import StarRating from '../components/StarRating'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<any>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [reviewModal, setReviewModal] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' })
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [relinkModal, setRelinkModal] = useState(false)

  const itemId = parseInt(id!)

  useEffect(() => {
    const load = async () => {
      const data = await window.api.items.getById(itemId)
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
      const thumb = await window.api.thumbnail.get(itemId)
      if (thumb) setThumbnail(`data:image/jpeg;base64,${thumb}`)
    }
    load()
    window.api.tags.getAll().then(setAllTags)
  }, [itemId])

  if (!item) return <div style={{ padding: 24 }}>Loading...</div>

  const fullPath = item.filePath + '/' + item.fileName + (item.fileExtension ? '.' + item.fileExtension : '')

  const handleSave = async () => {
    await window.api.items.update(itemId, {
      ...editForm,
      watched: editForm.watched ? 1 : 0,
    })
    setEditing(false)
    const data = await window.api.items.getById(itemId)
    setItem(data)
  }

  const handleDelete = async () => {
    if (confirm('Delete this item?')) {
      await window.api.items.delete(itemId)
      navigate('/')
    }
  }

  const handleRelink = async () => {
    const paths = await window.api.file.openDialog()
    if (paths.length > 0) {
      await window.api.items.relink(itemId, paths[0])
      const data = await window.api.items.getById(itemId)
      setItem(data)
    }
    setRelinkModal(false)
  }

  const handleOpenViewer = () => {
    if (item.containerType === 'pdf') navigate(`/view/pdf/${itemId}`)
    else if (item.containerType === 'zip') navigate(`/view/cbz/${itemId}`)
    else if (item.containerType === 'video') navigate(`/view/video/${itemId}`)
  }

  const handleAddTag = async () => {
    if (!newTagName.trim()) return
    let tag = allTags.find(t => t.name === newTagName.trim())
    if (!tag) {
      tag = await window.api.tags.create(newTagName.trim())
      setAllTags(prev => [...prev, tag!])
    }
    await window.api.tags.assignToItem(itemId, tag.id)
    setNewTagName('')
    const data = await window.api.items.getById(itemId)
    setItem(data)
  }

  const handleRemoveTag = async (tagId: number) => {
    await window.api.tags.removeFromItem(itemId, tagId)
    const data = await window.api.items.getById(itemId)
    setItem(data)
  }

  const handleReviewSave = async () => {
    await window.api.reviews.upsert(itemId, reviewForm.rating, reviewForm.comment)
    setReviewModal(false)
    const data = await window.api.items.getById(itemId)
    setItem(data)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <button className="btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Back</button>

      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div style={{
          width: 128, height: 128, background: '#0f3460', borderRadius: 8,
          overflow: 'hidden', flexShrink: 0, border: '1px solid #2a2a4a',
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={handleOpenViewer} disabled={item.fileExists === false}>
              Open Viewer
            </button>
            <button className="btn-secondary" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
            {editing && <button className="btn-primary" onClick={handleSave}>Save</button>}
            <button className="btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        </div>
      </div>

      <div style={{ background: '#16213e', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12, fontSize: 16 }}>Metadata</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Content Type">
            {editing
              ? <select value={editForm.contentType} onChange={e => setEditForm((f: any) => ({ ...f, contentType: e.target.value }))}>
                  <option value="book">Book</option>
                  <option value="comic">Comic</option>
                  <option value="video">Video</option>
                  <option value="other">Other</option>
                </select>
              : item.contentType
            }
          </Field>
          <Field label="Language">
            {editing
              ? <select value={editForm.language} onChange={e => setEditForm((f: any) => ({ ...f, language: e.target.value }))}>
                  <option value="">Unknown</option>
                  <option value="ko">Korean</option>
                  <option value="ja">Japanese</option>
                  <option value="en">English</option>
                  <option value="zh">Chinese</option>
                  <option value="other">Other</option>
                </select>
              : (item.language || 'Unknown')
            }
          </Field>
          <Field label="Author">
            {editing
              ? <input value={editForm.author} onChange={e => setEditForm((f: any) => ({ ...f, author: e.target.value }))} />
              : (item.author || '—')
            }
          </Field>
          <Field label="Watched">
            {editing
              ? <input type="checkbox" checked={editForm.watched} onChange={e => setEditForm((f: any) => ({ ...f, watched: e.target.checked }))} />
              : (item.watched ? '✓' : '✗')
            }
          </Field>
          <Field label="Progress">{Math.round(item.progress * 100)}%</Field>
          <Field label="Source URL">
            {editing
              ? <input value={editForm.sourceUrl} onChange={e => setEditForm((f: any) => ({ ...f, sourceUrl: e.target.value }))} style={{ width: '100%' }} />
              : (item.sourceUrl ? <a href={item.sourceUrl} style={{ color: '#e94560' }}>{item.sourceUrl}</a> : '—')
            }
          </Field>
        </div>
        {editing && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>Memo</label>
            <textarea
              value={editForm.memo}
              onChange={e => setEditForm((f: any) => ({ ...f, memo: e.target.value }))}
              style={{ width: '100%', minHeight: 80 }}
            />
          </div>
        )}
        {!editing && item.memo && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>Memo</div>
            <div>{item.memo}</div>
          </div>
        )}
      </div>

      <div style={{ background: '#16213e', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12, fontSize: 16 }}>File</h2>
        <div style={{ fontSize: 13, color: item.fileExists === false ? '#e94560' : '#a0a0b0', marginBottom: 8, wordBreak: 'break-all' }}>
          {fullPath} {item.fileExists === false && '(FILE MISSING)'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setRelinkModal(true)}>Relink File</button>
          <button className="btn-secondary" onClick={() => window.api.file.openExternal(fullPath)}>
            Open External
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#a0a0b0' }}>
          Added: {new Date(item.createdAt).toLocaleString()} |
          Updated: {new Date(item.updatedAt).toLocaleString()}
          {item.fileModifiedAt && ` | File Modified: ${new Date(item.fileModifiedAt).toLocaleString()}`}
        </div>
      </div>

      <div style={{ background: '#16213e', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12, fontSize: 16 }}>Tags</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {(item.tags || []).map((tag: Tag) => (
            <span key={tag.id} style={{
              background: '#0f3460', padding: '4px 10px', borderRadius: 16, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {tag.name}
              <span onClick={() => handleRemoveTag(tag.id)} style={{ cursor: 'pointer', color: '#e94560' }}>×</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
            placeholder="Add tag..."
            list="all-tags"
          />
          <datalist id="all-tags">
            {allTags.map(t => <option key={t.id} value={t.name} />)}
          </datalist>
          <button className="btn-secondary" onClick={handleAddTag}>Add</button>
        </div>
      </div>

      <div style={{ background: '#16213e', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16 }}>Review</h2>
          <button className="btn-secondary" onClick={() => setReviewModal(true)}>
            {item.review ? 'Edit Review' : 'Add Review'}
          </button>
        </div>
        {item.review ? (
          <div>
            <StarRating value={item.review.rating} readonly />
            {item.review.comment && <p style={{ marginTop: 8 }}>{item.review.comment}</p>}
          </div>
        ) : (
          <p style={{ color: '#a0a0b0' }}>No review yet</p>
        )}
      </div>

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Edit Review">
        <div style={{ marginBottom: 16 }}>
          <StarRating value={reviewForm.rating} onChange={v => setReviewForm(f => ({ ...f, rating: v }))} />
        </div>
        <textarea
          value={reviewForm.comment}
          onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
          placeholder="Comment..."
          style={{ width: '100%', minHeight: 100, marginBottom: 16 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setReviewModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleReviewSave}>Save</button>
        </div>
      </Modal>

      <Modal open={relinkModal} onClose={() => setRelinkModal(false)} title="Relink File">
        <p style={{ marginBottom: 16 }}>Select the new location for this file.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setRelinkModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleRelink}>Browse...</button>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}
