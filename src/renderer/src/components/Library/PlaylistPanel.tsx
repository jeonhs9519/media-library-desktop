import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { Item, PlaylistItem } from '../../types'
import ContextMenu, { ContextMenuEntry } from '../ContextMenu'
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
  onRemoveItem: (itemId: number) => void | Promise<void>
  onClear: () => void
  onReorderItems?: (itemIds: number[]) => void
  onOpenDetail?: (itemId: number) => void
  showCollapseButton?: boolean
  viewerMode?: boolean
  currentItemId?: number
  viewerReturnTo?: string
  focusRequest?: number
  focusItemId?: number | null
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

function getFocusableElements() {
  return Array.from(document.querySelectorAll<HTMLElement>(
    'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => {
    const isVisible = element.offsetParent !== null || element === document.activeElement
    return isVisible && element.tabIndex >= 0
  })
}

function focusNextFrom(element: HTMLElement, direction: 1 | -1) {
  const focusableElements = getFocusableElements()
  const currentIndex = focusableElements.indexOf(element)
  const nextElement = focusableElements[currentIndex + direction]
  nextElement?.focus()
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
  onOpenDetail,
  showCollapseButton = true,
  viewerMode = false,
  currentItemId,
  viewerReturnTo = '/',
  focusRequest = 0,
  focusItemId = null,
  tr,
}: Props) {
  const navigate = useNavigate()
  const draggingPlaylistItemIdRef = useRef<number | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const pointerDragRef = useRef<{
    itemId: number
    pointerId: number
    startX: number
    startY: number
    dragging: boolean
  } | null>(null)
  const itemElementRefs = useRef(new Map<number, HTMLDivElement>())
  const itemsContainerRef = useRef<HTMLDivElement | null>(null)
  const pendingFocusIndexRef = useRef<number | null>(null)
  const suppressNextClickRef = useRef(false)
  const dropTargetIndexRef = useRef<number | null>(null)
  const [draggingPlaylistItemId, setDraggingPlaylistItemId] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number; item: Item } | null>(null)
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

  useEffect(() => {
    setActiveIndex((current) => {
      if (items.length === 0) return 0
      return Math.min(current, items.length - 1)
    })
  }, [items.length])

  useEffect(() => {
    if (!focusRequest || collapsed) return

    window.setTimeout(() => {
      if (focusItemId) {
        const targetIndex = items.findIndex((entry) => entry.itemId === focusItemId)
        if (targetIndex >= 0) {
          pendingFocusIndexRef.current = targetIndex
          setActiveIndex(targetIndex)
        }
      }
      itemsContainerRef.current?.focus()
    }, 0)
  }, [collapsed, focusItemId, focusRequest, items])

  const focusPlaylistItem = (index: number) => {
    if (items.length === 0) return

    const nextIndex = Math.min(Math.max(index, 0), items.length - 1)
    setActiveIndex(nextIndex)
    window.setTimeout(() => {
      itemElementRefs.current.get(items[nextIndex].itemId)?.focus()
    }, 0)
  }

  const removePlaylistItem = async (itemId: number, index: number) => {
    setActiveIndex(Math.min(index, Math.max(items.length - 2, 0)))
    await Promise.resolve(onRemoveItem(itemId))
    window.setTimeout(() => {
      itemsContainerRef.current?.focus()
    }, 0)
  }

  const movePlaylistItemByOffset = async (index: number, offset: -1 | 1) => {
    if (!onReorderItems) return

    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= itemIds.length) return

    const nextItemIds = [...itemIds]
    const [movedItemId] = nextItemIds.splice(index, 1)
    nextItemIds.splice(targetIndex, 0, movedItemId)
    setActiveIndex(targetIndex)
    await Promise.resolve(onReorderItems(nextItemIds))
    window.setTimeout(() => {
      itemsContainerRef.current?.focus()
    }, 0)
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
    if (event.altKey && event.key === 'Enter') {
      event.preventDefault()
      onOpenDetail?.(item.id)
      return
    }

    if (event.ctrlKey && event.key === 'ArrowUp') {
      event.preventDefault()
      void movePlaylistItemByOffset(activeIndex, -1)
      return
    }

    if (event.ctrlKey && event.key === 'ArrowDown') {
      event.preventDefault()
      void movePlaylistItemByOffset(activeIndex, 1)
      return
    }

    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (item.fileExists === false) return
    openViewer(item)
  }

  const handlePlaylistItemsFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || items.length === 0) return
    const pendingFocusIndex = pendingFocusIndexRef.current
    pendingFocusIndexRef.current = null
    focusPlaylistItem(pendingFocusIndex ?? activeIndex)
  }

  const focusPlaylistItems = () => {
    window.setTimeout(() => {
      itemsContainerRef.current?.focus()
    }, 0)
  }

  const handlePlaylistItemsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return

    if (event.key === 'Tab') {
      event.preventDefault()
      if (itemsContainerRef.current) {
        focusNextFrom(itemsContainerRef.current, event.shiftKey ? -1 : 1)
      }
      return
    }

    if (event.altKey && event.key === 'Enter') {
      event.preventDefault()
      const item = items[activeIndex]?.item
      if (item) onOpenDetail?.(item.id)
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (event.ctrlKey) {
        event.preventDefault()
        void movePlaylistItemByOffset(activeIndex, event.key === 'ArrowDown' ? 1 : -1)
        return
      }

      event.preventDefault()
      focusPlaylistItem(activeIndex + (event.key === 'ArrowDown' ? 1 : -1))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      focusPlaylistItem(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      focusPlaylistItem(items.length - 1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = items[activeIndex]?.item
      if (!item || item.fileExists === false) return
      openViewer(item)
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      const item = items[activeIndex]?.item
      if (!item || item.id === currentItemId) return
      void removePlaylistItem(item.id, activeIndex)
    }
  }

  const makeContextMenuItems = (item: Item, index: number): ContextMenuEntry[] => [
    {
      key: 'play-from-here',
      label: '여기서부터 재생',
      shortcut: 'Enter / Space',
      disabled: item.fileExists === false,
      onSelect: () => openViewer(item),
    },
    { key: 'separator-play', type: 'separator' },
    {
      key: 'move-up',
      label: '위로 한 칸 이동',
      shortcut: 'Ctrl + ↑',
      disabled: !onReorderItems || index === 0,
      onSelect: () => movePlaylistItemByOffset(index, -1),
    },
    {
      key: 'move-down',
      label: '아래로 한 칸 이동',
      shortcut: 'Ctrl + ↓',
      disabled: !onReorderItems || index >= items.length - 1,
      onSelect: () => movePlaylistItemByOffset(index, 1),
    },
    { key: 'separator-move', type: 'separator' },
    {
      key: 'detail',
      label: '상세정보 확인',
      shortcut: 'Alt + Enter',
      disabled: !onOpenDetail,
      onSelect: () => onOpenDetail?.(item.id),
    },
    {
      key: 'remove',
      label: '목록에서 제거',
      shortcut: 'Delete',
      tone: 'danger',
      disabled: item.id === currentItemId,
      onSelect: () => removePlaylistItem(item.id, index),
    },
  ]

  return (
    <>
      <aside
        ref={panelRef}
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
            ref={itemsContainerRef}
            className="playlist-items"
            tabIndex={items.length ? 0 : -1}
            role="listbox"
            aria-label={tr('playlist.title')}
            onFocus={handlePlaylistItemsFocus}
            onKeyDown={handlePlaylistItemsKeyDown}
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
                    className={`playlist-item-main${onReorderItems ? ' is-reorderable' : ''}${index === activeIndex ? ' is-active' : ''}`}
                    title={item.title}
                    role="option"
                    aria-selected={index === activeIndex}
                    aria-grabbed={item.id === draggingPlaylistItemId ? true : undefined}
                    tabIndex={-1}
                    aria-disabled={item.fileExists === false ? true : undefined}
                    onPointerDown={(event) => startPlaylistPointerDrag(event, item.id)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setActiveIndex(index)
                      setContextMenu({ x: event.clientX, y: event.clientY, index, item })
                    }}
                    onClick={(event) => {
                      if (suppressNextClickRef.current) {
                        event.preventDefault()
                        event.stopPropagation()
                        suppressNextClickRef.current = false
                        return
                      }
                      setActiveIndex(index)
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
                      tabIndex={-1}
                      disabled={item.id === currentItemId}
                      onClick={(event) => {
                        event.stopPropagation()
                        setActiveIndex(index)
                        void removePlaylistItem(item.id, index)
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

      {contextMenu && (
        <ContextMenu
          id="playlist-item-context-menu"
          position={{ x: contextMenu.x, y: contextMenu.y }}
          items={makeContextMenuItems(contextMenu.item, contextMenu.index)}
          onClose={(reason, target) => {
            setContextMenu(null)
            const shouldRestorePlaylistFocus = reason === 'escape'
              || (reason === 'outside' && panelRef.current?.contains(target as Node | null))
            if (shouldRestorePlaylistFocus) focusPlaylistItems()
          }}
          minWidth={260}
        />
      )}
    </>
  )
}
