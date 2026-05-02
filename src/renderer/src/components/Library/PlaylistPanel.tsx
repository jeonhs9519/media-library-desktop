import { useRef, useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { Item, PlaylistItem } from '../../types'
import { CaretLeftIcon, CaretRightIcon, CloseXIcon } from '../icons'
import { getContentTypeIcon, getViewerPath } from './mediaLabels'
import type { Translate } from './types'

const LIBRARY_ITEM_DRAG_TYPE = 'application/x-media-library-item-id'
const DRAG_START_THRESHOLD = 4

type Props = {
  items: PlaylistItem[]
  thumbnails: Record<number, string>
  collapsed: boolean
  position: 'left' | 'right'
  onToggleCollapsed: () => void
  onDropItem: (itemId: number, position?: number) => void
  onRemoveItem: (itemId: number) => void
  onClear: () => void
  onReorderItems?: (itemIds: number[]) => void
  showCollapseButton?: boolean
  viewerMode?: boolean
  currentItemId?: number
  viewerReturnTo?: string
  tr: Translate
}

function hasDragType(event: React.DragEvent, type: string) {
  return Array.from(event.dataTransfer.types || []).includes(type)
}

function canAcceptDrag(event: React.DragEvent) {
  return hasDragType(event, LIBRARY_ITEM_DRAG_TYPE)
}

function moveItemIds(itemIds: number[], sourceItemId: number, targetIndex: number) {
  const sourceIndex = itemIds.indexOf(sourceItemId)
  if (sourceIndex < 0) return itemIds

  const nextItemIds = [...itemIds]
  const [movedItemId] = nextItemIds.splice(sourceIndex, 1)
  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  nextItemIds.splice(Math.min(Math.max(adjustedTargetIndex, 0), nextItemIds.length), 0, movedItemId)
  return nextItemIds
}

function isNoopMove(itemIds: number[], sourceItemId: number, targetIndex: number) {
  const sourceIndex = itemIds.indexOf(sourceItemId)
  return sourceIndex < 0 || targetIndex === sourceIndex || targetIndex === sourceIndex + 1
}

export default function PlaylistPanel({
  items,
  thumbnails,
  collapsed,
  position,
  onToggleCollapsed,
  onDropItem,
  onRemoveItem,
  onClear,
  onReorderItems,
  showCollapseButton = true,
  viewerMode = false,
  currentItemId,
  viewerReturnTo = '/',
  tr,
}: Props) {
  const navigate = useNavigate()
  const draggingPlaylistItemIdRef = useRef<number | null>(null)
  const pointerDragRef = useRef<{
    itemId: number
    pointerId: number
    startX: number
    startY: number
    dragging: boolean
  } | null>(null)
  const itemElementRefs = useRef(new Map<number, HTMLDivElement>())
  const suppressNextClickRef = useRef(false)
  const dropTargetIndexRef = useRef<number | null>(null)
  const [draggingPlaylistItemId, setDraggingPlaylistItemId] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const itemIds = items.map((entry) => entry.itemId)
  const collapseIcon = position === 'right'
    ? collapsed ? <CaretLeftIcon /> : <CaretRightIcon />
    : collapsed ? <CaretRightIcon /> : <CaretLeftIcon />

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const targetIndex = dropTargetIndexRef.current ?? dropTargetIndex ?? items.length
    setDropTargetIndex(null)
    dropTargetIndexRef.current = null
    const rawItemId = event.dataTransfer.getData(LIBRARY_ITEM_DRAG_TYPE)
    const itemId = Number(rawItemId)
    if (Number.isInteger(itemId) && itemId > 0) onDropItem(itemId, targetIndex)
  }

  const getPointerDropIndex = (clientY: number) => {
    for (let index = 0; index < items.length; index += 1) {
      const element = itemElementRefs.current.get(items[index].itemId)
      if (!element) continue
      const rect = element.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return index
    }
    return items.length
  }

  const renderDropIndicator = (index: number) => (
    dropTargetIndex === index && !(
      draggingPlaylistItemId !== null
      && isNoopMove(itemIds, draggingPlaylistItemId, index)
    ) ? (
      <div
        className="playlist-drop-indicator"
        role="presentation"
        onDragOver={(event) => {
          if (!canAcceptDrag(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          updateDropTarget(index)
        }}
      >
        이곳으로 이동
      </div>
    ) : null
  )

  const resetPlaylistDragState = () => {
    draggingPlaylistItemIdRef.current = null
    pointerDragRef.current = null
    dropTargetIndexRef.current = null
    setDraggingPlaylistItemId(null)
    setDropTargetIndex(null)
  }

  const updateDropTarget = (index: number) => {
    const sourceItemId = draggingPlaylistItemIdRef.current
    if (sourceItemId !== null && isNoopMove(itemIds, sourceItemId, index)) {
      dropTargetIndexRef.current = null
      setDropTargetIndex(null)
      return
    }

    dropTargetIndexRef.current = index
    setDropTargetIndex(index)
  }

  const cleanupPointerDragListeners = (
    handlePointerMove: (event: PointerEvent) => void,
    handlePointerUp: (event: PointerEvent) => void,
  ) => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)
  }

  const startPlaylistPointerDrag = (event: React.PointerEvent<HTMLDivElement>, itemId: number) => {
    if (!onReorderItems || event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return

    pointerDragRef.current = {
      itemId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    }

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const drag = pointerDragRef.current
      if (!drag || drag.pointerId !== pointerEvent.pointerId) return

      const distance = Math.hypot(pointerEvent.clientX - drag.startX, pointerEvent.clientY - drag.startY)
      if (!drag.dragging && distance < DRAG_START_THRESHOLD) return

      if (!drag.dragging) {
        drag.dragging = true
        draggingPlaylistItemIdRef.current = drag.itemId
        setDraggingPlaylistItemId(drag.itemId)
        suppressNextClickRef.current = true
      }

      pointerEvent.preventDefault()
      updateDropTarget(getPointerDropIndex(pointerEvent.clientY))
    }

    const handlePointerUp = (pointerEvent: PointerEvent) => {
      const drag = pointerDragRef.current
      cleanupPointerDragListeners(handlePointerMove, handlePointerUp)
      pointerDragRef.current = null

      if (!drag || drag.pointerId !== pointerEvent.pointerId) {
        resetPlaylistDragState()
        return
      }

      if (drag.dragging) {
        const nextDropTargetIndex = getPointerDropIndex(pointerEvent.clientY)
        onReorderItems(moveItemIds(itemIds, drag.itemId, nextDropTargetIndex))
      }

      resetPlaylistDragState()
      window.setTimeout(() => {
        suppressNextClickRef.current = false
      }, 0)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const openViewer = (item: Item) => {
    const path = getViewerPath(item)
    if (path) navigate(path, { state: { returnTo: viewerReturnTo } })
  }

  const handleItemKeyDown = (event: React.KeyboardEvent, item: Item) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (item.fileExists === false) return
    openViewer(item)
  }

  return (
    <aside
      className={`playlist-panel${collapsed ? ' is-collapsed' : ''}`}
      aria-label={tr('playlist.title')}
      onDragOver={(event) => {
        if (!canAcceptDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        updateDropTarget(getPointerDropIndex(event.clientY))
      }}
      onDragLeave={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const isInsidePanel = event.clientX >= rect.left
          && event.clientX <= rect.right
          && event.clientY >= rect.top
          && event.clientY <= rect.bottom
        if (isInsidePanel) return
        dropTargetIndexRef.current = null
        setDropTargetIndex(null)
      }}
      onDrop={handleDrop}
    >
      {showCollapseButton && (
        <button
          className="btn-secondary playlist-collapse-button"
          title={collapsed ? tr('playlist.expand') : tr('playlist.collapse')}
          aria-label={collapsed ? tr('playlist.expand') : tr('playlist.collapse')}
          onClick={onToggleCollapsed}
        >
          {collapseIcon}
        </button>
      )}

      {!collapsed && (
        <>
          {!viewerMode && (
            <div className="playlist-header">
              <div>
                <h2>{tr('playlist.title')}</h2>
                <p>{tr('playlist.count', { count: items.length })}</p>
              </div>
              <button className="btn-secondary playlist-clear-button" disabled={items.length === 0} onClick={onClear}>
                {tr('playlist.clear')}
              </button>
            </div>
          )}

          <div
            className="playlist-items"
          >
            {items.length === 0 ? (
              dropTargetIndex === 0 ? renderDropIndicator(0) : <div className="playlist-empty">{tr('playlist.empty')}</div>
            ) : (
              <>
              {items.map(({ item }, index) => {
                const thumbnailUrl = thumbnails[item.id] || (item.thumbnailBase64 ? `data:image/jpeg;base64,${item.thumbnailBase64}` : '')

                return (
                <div
                  className={`playlist-item${item.id === currentItemId ? ' is-current' : ''}${item.id === draggingPlaylistItemId ? ' is-dragging' : ''}`}
                  key={item.id}
                >
                  {renderDropIndicator(index)}
                  <div
                    ref={(element) => {
                      if (element) {
                        itemElementRefs.current.set(item.id, element)
                      } else {
                        itemElementRefs.current.delete(item.id)
                      }
                    }}
                    className={`playlist-item-main${onReorderItems ? ' is-reorderable' : ''}`}
                    title={item.title}
                    role="button"
                    aria-grabbed={item.id === draggingPlaylistItemId ? true : undefined}
                    tabIndex={item.fileExists === false ? -1 : 0}
                    aria-disabled={item.fileExists === false ? true : undefined}
                    onPointerDown={(event) => startPlaylistPointerDrag(event, item.id)}
                    onClick={(event) => {
                      if (suppressNextClickRef.current) {
                        event.preventDefault()
                        event.stopPropagation()
                        suppressNextClickRef.current = false
                        return
                      }
                      if (item.fileExists === false) return
                      openViewer(item)
                    }}
                    onKeyDown={(event) => handleItemKeyDown(event, item)}
                  >
                    <span className="playlist-item-index">{index + 1}</span>
                    <span className="playlist-item-thumb">
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="" />
                      ) : (
                        <span>{getContentTypeIcon(item.contentType)}</span>
                      )}
                    </span>
                    <span className="playlist-item-text">
                      <span>{item.title}</span>
                      <span>{tr(`filters.type.${item.contentType}`)}</span>
                    </span>
                    <button
                      className="btn-secondary playlist-remove-button"
                      title={tr('playlist.remove')}
                      aria-label={tr('playlist.remove')}
                      disabled={item.id === currentItemId}
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveItem(item.id)
                      }}
                    >
                      <CloseXIcon size={14} />
                    </button>
                  </div>
                </div>
              )})}
              {renderDropIndicator(items.length)}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
