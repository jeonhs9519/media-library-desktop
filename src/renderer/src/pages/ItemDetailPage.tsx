import React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Tag } from '../types'
import StarRating from '../components/StarRating'
import ChoiceInput from '../components/ChoiceInput'
import Dropdown from '../components/Dropdown'
import PasteInput from '../components/PasteInput'
import TagSearchInput from '../components/TagSearchInput'
import Tooltip from '../components/Tooltip'
import { PlaylistAddIcon, ShareIcon } from '../components/icons'
import { useI18n } from '../useI18n'
import { getViewerPath } from '../components/Library/mediaLabels'
import type { ItemDetailPageProps } from '../components/ItemDetail/types'
import { useItemDetail } from '../components/ItemDetail/useItemDetail'
import { useItemProfileTransfer } from '../components/ItemDetail/useItemProfileTransfer'
import { buildDisplayItemPath, formatProgressDetail } from '../components/ItemDetail/formatters'
import ItemDetailDialogs from '../components/ItemDetail/ItemDetailDialogs'

export default function ItemDetailPage({ itemId, onClose, onAddToPlaylist, onMoveToProfile, onCopyToProfile }: ItemDetailPageProps) {
  const navigate = useNavigate()
  const { tr } = useI18n()
  const detail = useItemDetail({ itemId, onClose, tr })
  const { item, thumbnail, editing, setEditing, editForm, setEditForm, handleSave, handleDelete,
    usedTags, newTagName, setNewTagName, tagInputError, setTagInputError,
    commitTagName, handleAddTag, handleRemoveTag, setReviewModal, setRelinkModal } = detail
  const { profileMoveTargets, profileMoveTargetsLoading, profileTransferTargetId, setProfileTransferTargetId,
    profileTransferBusy, getProfileTransferOptionLabel, handleProfileMove, handleProfileCopy, canUseProfileTransfer
  } = useItemProfileTransfer({ itemId, item, onClose, onMoveToProfile, onCopyToProfile, tr })

  if (!item) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tr('common.loading')}</div>
  }

  const fullPath = buildDisplayItemPath(item)

  const handleOpenViewer = () => {
    const state = { returnTo: `/items/${itemId}` }
    const viewerPath = getViewerPath(item)
    if (viewerPath) navigate(viewerPath, { state })
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
                  {item.contentType === 'video' ? '🎬' : item.contentType === 'comic' ? '🎨' : item.contentType === 'book' ? '📚' : '📄'}
                </div>
            }
          </div>

          <div style={{ flex: 1 }}>
            {editing ? (
              <PasteInput
                value={editForm.title}
                onChange={value => setEditForm((f) => ({ ...f, title: value }))}
                label={tr('filters.sort.title')}
                pasteLabel={tr('common.paste')}
                pasteErrorLabel={tr('common.pasteFailed')}
                style={{ marginBottom: 8 }}
                inputStyle={{ fontSize: 24 }}
              />
            ) : (
              <h1 style={{ fontSize: 24, marginBottom: 8 }}>{item.title}</h1>
            )}
          </div>
        </div>

        <div className="detail-action-bar">
          <div className="detail-primary-actions">
            <button className="btn-primary" style={{ width: 128 }} onClick={handleOpenViewer} disabled={!getViewerPath(item) || item.fileExists === false}>
              {tr('detail.openViewer')}
            </button>
            {onAddToPlaylist && (
              <button
                className="btn-secondary detail-square-action"
                title={tr('playlist.addToList')}
                aria-label={tr('playlist.addToList')}
                onClick={() => onAddToPlaylist(item)}
                disabled={!getViewerPath(item)}
              >
                <PlaylistAddIcon size={18} />
              </button>
            )}
            <button
              className="btn-secondary detail-square-action"
              title={tr('detail.openExternal')}
              aria-label={tr('detail.openExternal')}
              onClick={() => api.file.openExternal(fullPath)}
            >
              <ShareIcon size={18} />
            </button>
          </div>
          <div className="detail-edit-actions">
            <button className="btn-secondary" onClick={() => setEditing(!editing)}>
              {editing ? tr('common.cancel') : tr('common.edit')}
            </button>
            {editing && <button className="btn-primary" onClick={handleSave}>{tr('common.save')}</button>}
            <button className="btn-danger" onClick={handleDelete}>{tr('common.delete')}</button>
          </div>
        </div>
      </div>

      <div className="detail-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>

        <div className="tooltip-container" data-tooltip-boundary="content-box" style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{tr('detail.metadata')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12, rowGap: 12 }}>
            <div className="detail-type-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, gridColumn: '1 / -1' }}>
              <Field label={tr('detail.contentType')}>
                {editing
                  ? (
                      <Dropdown
                        value={editForm.contentType}
                        options={[
                          { value: 'book', label: tr('filters.type.book') },
                          { value: 'comic', label: tr('filters.type.comic') },
                          { value: 'video', label: tr('filters.type.video') },
                          { value: 'other', label: tr('filters.type.other') },
                        ]}
                        onChange={(nextValue) => setEditForm((f) => ({ ...f, contentType: nextValue as typeof editForm.contentType }))}
                        ariaLabel={tr('detail.contentType')}
                      />
                    )
                  : tr(`filters.type.${item.contentType}`)
                }
              </Field>
              <Field label={tr('detail.fileType')}>
                {editing
                  ? <input readOnly aria-label={tr('detail.fileType')} value={tr(`files.type.${item.containerType}`)} style={{ width: '100%', height: 35 }} />
                  : tr(`files.type.${item.containerType}`)
                }
              </Field>
              <Field label={
                <span className="detail-language-label">
                  {tr('detail.language')}
                  {editing && item.language !== 'unspecified' && (
                    <Tooltip content={tr('detail.languageUnspecifiedLocked')}>
                      <button type="button" className="detail-language-help-button" aria-label={tr('detail.language')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
                          <path d="M12 16h.01" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                </span>
              }>
                {editing
                  ? (
                      <Dropdown
                        value={editForm.language}
                        options={[
                          { value: 'unspecified', label: tr('filters.language.unspecified'), disabled: item.language !== 'unspecified' },
                          { value: 'none', label: tr('filters.language.none') },
                          { value: 'ko', label: tr('filters.language.ko') },
                          { value: 'ja', label: tr('filters.language.ja') },
                          { value: 'en', label: tr('filters.language.en') },
                          { value: 'zh', label: tr('filters.language.zh') },
                          { value: 'other', label: tr('filters.language.other') },
                        ]}
                        onChange={(nextValue) => setEditForm((f) => ({ ...f, language: nextValue }))}
                        ariaLabel={tr('detail.language')}
                      />
                    )
                  : tr(`filters.language.${item.language || 'unspecified'}`)
                }
              </Field>
            </div>
            <Field label={tr('detail.author')} style={{ gridColumn: '1 / -1' }}>
              {editing
                ? <PasteInput value={editForm.author} onChange={value => setEditForm((f) => ({ ...f, author: value }))} label={tr('detail.author')} pasteLabel={tr('common.paste')} pasteErrorLabel={tr('common.pasteFailed')} />
                : (item.author || '—')
              }
            </Field>
            <Field label={tr('detail.progress')}>{formatProgressDetail(item)}</Field>
            <Field label={tr('detail.watched')}>
              {editing
                ? (
                    <ChoiceInput
                      className="detail-choice"
                      type="checkbox"
                      checked={editForm.watched}
                      onChange={e => setEditForm((f) => ({ ...f, watched: e.target.checked }))}
                    >
                      <span>{tr('detail.watched')}</span>
                    </ChoiceInput>
                  )
                : (item.watched ? '✓' : '✗')
              }
            </Field>
            <Field label={tr('detail.sourceUrl')} style={{ gridColumn: '1 / -1' }}>
              {editing
                ? <PasteInput value={editForm.sourceUrl} onChange={value => setEditForm((f) => ({ ...f, sourceUrl: value }))} label={tr('detail.sourceUrl')} pasteLabel={tr('common.paste')} pasteErrorLabel={tr('common.pasteFailed')} />
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
                onChange={e => setEditForm((f) => ({ ...f, memo: e.target.value }))}
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
            <TagSearchInput
              value={newTagName}
              options={usedTags.filter((tag) => !(item.tags || []).some((itemTag: Tag) => itemTag.id === tag.id))}
              onChange={setNewTagName}
              onClearError={() => {
                if (tagInputError) setTagInputError('')
              }}
              onCommit={(tagName) => {
                void commitTagName(tagName)
              }}
              placeholder={tr('detail.addTagPlaceholder')}
              ariaLabel={tr('detail.addTagPlaceholder')}
            />
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
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{tr('detail.profileTransfer')}</h2>
          <div className="detail-profile-transfer">
            <Dropdown
              value={profileTransferTargetId?.toString() ?? ''}
              options={profileMoveTargets.length === 0
                ? [{
                    value: '',
                    label: profileMoveTargetsLoading ? tr('common.loading') : tr('detail.profileTransferNoTargets'),
                    disabled: true,
                  }]
                : profileMoveTargets.map((target) => ({
                    value: target.id.toString(),
                    label: getProfileTransferOptionLabel(target),
                    disabled: target.disabled,
                  }))}
              onChange={(nextValue) => setProfileTransferTargetId(Number(nextValue))}
              disabled={profileMoveTargetsLoading || profileTransferBusy || profileMoveTargets.length === 0}
              ariaLabel={tr('detail.profileTransfer')}
            />
            <div className="detail-profile-transfer-actions">
              <button
                className="btn-secondary"
                onClick={handleProfileMove}
                disabled={!canUseProfileTransfer || profileTransferBusy || !onMoveToProfile}
              >
                {tr('detail.profileMove')}
              </button>
              <button
                className="btn-secondary"
                onClick={handleProfileCopy}
                disabled={!canUseProfileTransfer || profileTransferBusy || !onCopyToProfile}
              >
                {tr('detail.profileCopy')}
              </button>
            </div>
          </div>
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

      <ItemDetailDialogs detail={detail} tr={tr} />
    </div>
  )
}

function Field({ label, children, style }: { label: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ lineHeight: '24px', ...style }}>
      <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}
