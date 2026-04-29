import React, { forwardRef } from 'react'
import { Item } from '../../types'
import { getContentTypeIcon, getLanguageBadge } from './mediaLabels'

const CARD_SIZE = 160
const THUMB_SIZE = 128

const TYPE_GLYPH_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  padding: 0,
  border: '1px solid #fff',
  borderRadius: 4,
  background: 'rgba(10, 16, 32, 0.45)',
  color: '#f5f8ff',
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: '0.02em',
}

const LANGUAGE_GLYPH_STYLE: React.CSSProperties = {
  ...TYPE_GLYPH_STYLE,
  width: 40,
}

interface Props {
  item: Item & { fileExists?: boolean }
  thumbnailUrl?: string
  onOpenDetail: () => void
  onContextMenu: (event: React.MouseEvent) => void
  active?: boolean
  tabIndex?: number
}

function formatVideoDuration(secondsRaw: number): string {
  const seconds = Math.max(0, Math.floor(secondsRaw))
  if (seconds < 60) return `00:${seconds.toString().padStart(2, '0')}`

  const ss = (seconds % 60).toString().padStart(2, '0')
  const totalMinutes = Math.floor(seconds / 60)
  if (seconds < 3600) {
    return `${totalMinutes.toString().padStart(2, '0')}:${ss}`
  }

  const hh = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const mm = (totalMinutes % 60).toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatVideoProgress(currentRaw: number, totalRaw: number): string {
  const total = Math.max(0, Math.floor(totalRaw))
  const current = Math.min(total, Math.max(0, Math.floor(currentRaw)))

  if (total < 60) {
    return `00:${current.toString().padStart(2, '0')}/00:${total.toString().padStart(2, '0')}`
  }

  if (total < 3600) {
    const currentMinutes = Math.floor(current / 60).toString().padStart(2, '0')
    const currentSeconds = (current % 60).toString().padStart(2, '0')
    const totalMinutes = Math.floor(total / 60).toString().padStart(2, '0')
    const totalSeconds = (total % 60).toString().padStart(2, '0')
    return `${currentMinutes}:${currentSeconds}/${totalMinutes}:${totalSeconds}`
  }

  const currentHours = Math.floor(current / 3600).toString().padStart(2, '0')
  const currentMinutes = Math.floor((current % 3600) / 60).toString().padStart(2, '0')
  const currentSeconds = (current % 60).toString().padStart(2, '0')
  const totalHours = Math.floor(total / 3600).toString().padStart(2, '0')
  const totalMinutes = Math.floor((total % 3600) / 60).toString().padStart(2, '0')
  const totalSeconds = (total % 60).toString().padStart(2, '0')
  return `${currentHours}:${currentMinutes}:${currentSeconds}/${totalHours}:${totalMinutes}:${totalSeconds}`
}

const LibraryItemCard = forwardRef<HTMLButtonElement, Props>(function LibraryItemCard({
  item,
  thumbnailUrl,
  onOpenDetail,
  onContextMenu,
  active = false,
  tabIndex = -1,
}, ref) {
  const missing = item.fileExists === false
  const languageBadge = getLanguageBadge(item.language)

  const contentInfo = item.totalContent
    ? item.contentType === 'video'
      ? formatVideoDuration(item.totalContent)
      : item.contentType === 'book' || item.contentType === 'comic'
        ? `${Math.round(item.totalContent)}p`
        : ''
    : ''
  const progressInfo = item.totalContent
    ? item.contentType === 'video'
      ? formatVideoProgress(item.progress * item.totalContent, item.totalContent)
      : `${Math.round(item.progress * item.totalContent)}/${Math.round(item.totalContent)}p`
    : ''

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail()
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`library-card${active ? ' is-active' : ''}`}
      tabIndex={tabIndex}
      onClick={onOpenDetail}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      title={item.title}
      style={{
        width: CARD_SIZE,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={TYPE_GLYPH_STYLE}>{getContentTypeIcon(item.contentType)}</span>
          </div>
        )}
        {missing && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(185, 74, 87, 0.32)', fontSize: 32,
          }}>X</div>
        )}
        <div style={{ position: 'absolute', top: 2, left: 2, right: 2, display: 'flex', gap: 4, justifyContent: 'space-between' }}>
          <span style={TYPE_GLYPH_STYLE}>{getContentTypeIcon(item.contentType)}</span>
          {languageBadge ? <span style={LANGUAGE_GLYPH_STYLE}>{languageBadge}</span> : null}
        </div>
        {contentInfo && (
          <div style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 11, color: '#e0e0e0', background: 'rgba(10, 16, 32, 0.45)', padding: '2px 6px', borderRadius: 3 }}>
            {progressInfo || contentInfo}
          </div>
        )}
      </div>
      <div className="library-card-title">{item.title}</div>
      {item.progress > 0 && (
        <div className="library-card-progress">
          <div style={{ height: '100%', width: `${item.progress * 100}%`, background: 'var(--accent)', borderRadius: 1 }} />
        </div>
      )}
    </button>
  )
})

export default LibraryItemCard
