import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Item } from '../../types'
import { api } from '../../api'
import ContextMenu, { ContextMenuEntry } from '../ContextMenu'
import { CaretLeftIcon, CaretRightIcon } from '../icons'
import LibraryItemCard from './LibraryItemCard'
import { getViewerPath } from './mediaLabels'
import type { Translate } from './types'

interface Props {
  items: Item[]
  thumbnails: Record<number, string>
  total: number
  loading: boolean
  filterSummary: string
  page: number
  perPage: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  onOpenDetail: (itemId: number) => void
  focusRequest?: number
  tr: Translate
}

function getFullPath(item: Item) {
  const separator = item.filePath.includes('/') ? '/' : '\\'
  return `${item.filePath}${separator}${item.fileName}.${item.fileExtension}`
}

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end'

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const windowSize = 9
  const halfWindow = Math.floor(windowSize / 2)
  let start = Math.max(1, currentPage - halfWindow)
  let end = Math.min(totalPages, start + windowSize - 1)

  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1)
  }

  const pages: PaginationItem[] = []

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('ellipsis-start')
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber)
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis-end')
    pages.push(totalPages)
  }

  return pages
}

export default function LibraryGrid({
  items,
  thumbnails,
  total,
  loading,
  filterSummary,
  page,
  perPage,
  setPage,
  onOpenDetail,
  focusRequest = 0,
  tr,
}: Props) {
  const navigate = useNavigate()
  const gridRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Item } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages])

  useEffect(() => {
    setActiveIndex((current) => Math.min(Math.max(current, 0), Math.max(items.length - 1, 0)))
  }, [items.length])

  useEffect(() => {
    if (!focusRequest) return
    window.setTimeout(() => {
      if (items.length > 0) {
        focusCard(activeIndex)
      } else {
        gridRef.current?.focus()
      }
    }, 0)
  }, [focusRequest])

  useEffect(() => {
    if (!contextMenu) return

    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)

    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
    }
  }, [contextMenu])

  const contextMenuItems = useMemo<ContextMenuEntry[]>(() => {
    if (!contextMenu) return []
    const item = contextMenu.item
    const fullPath = getFullPath(item)
    const viewerPath = getViewerPath(item)

    return [
      {
        key: 'detail',
        label: tr('library.context.detail'),
        shortcut: 'Enter',
        onSelect: () => onOpenDetail(item.id),
      },
      {
        key: 'viewer',
        label: tr('detail.openViewer'),
        disabled: !viewerPath || item.fileExists === false,
        onSelect: () => {
          if (viewerPath) navigate(viewerPath)
        },
      },
      { key: 'separator-open', type: 'separator' },
      {
        key: 'external',
        label: tr('detail.openExternal'),
        disabled: item.fileExists === false,
        onSelect: () => api.file.openExternal(fullPath),
      },
      {
        key: 'source-url',
        label: tr('library.context.openSourceUrl'),
        disabled: !item.sourceUrl,
        onSelect: () => {
          if (item.sourceUrl) return api.file.openExternal(item.sourceUrl)
        },
      },
      {
        key: 'show-folder',
        label: tr('viewer.video.showInFolder'),
        disabled: item.fileExists === false,
        onSelect: () => api.file.showInFolder(fullPath),
      },
    ]
  }, [contextMenu, navigate, onOpenDetail, tr])

  const getColumnCount = () => {
    const grid = gridRef.current
    if (!grid) return 1

    const styles = window.getComputedStyle(grid)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '16') || 16
    const cardWidth = cardRefs.current.find(Boolean)?.offsetWidth || 160
    return Math.max(1, Math.floor((grid.clientWidth + gap) / (cardWidth + gap)))
  }

  const focusCard = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), items.length - 1)
    setActiveIndex(nextIndex)
    cardRefs.current[nextIndex]?.focus()
  }

  const focusPreviousBeforeGrid = () => {
    const grid = gridRef.current
    if (!grid) return

    const focusableElements = Array.from(document.querySelectorAll<HTMLElement>([
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(','))).filter((element) => (
      element.offsetParent !== null
      && !element.contains(grid)
      && !grid.contains(element)
    ))

    const gridIndex = focusableElements.findIndex((element) => element === grid)
    const previous = gridIndex > 0
      ? focusableElements[gridIndex - 1]
      : focusableElements.filter((element) => {
          const position = element.compareDocumentPosition(grid)
          return Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)
        }).at(-1)

    previous?.focus()
  }

  const handleGridFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || items.length === 0) return
    window.setTimeout(() => focusCard(activeIndex), 0)
  }

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      if (event.shiftKey && event.target !== event.currentTarget) {
        event.preventDefault()
        focusPreviousBeforeGrid()
      }
      return
    }

    if (items.length === 0) return

    const columns = getColumnCount()
    const keyMoves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
    }

    if (event.key in keyMoves) {
      event.preventDefault()
      focusCard(activeIndex + keyMoves[event.key])
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      focusCard(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      focusCard(items.length - 1)
      return
    }
  }

  return (
    <>
      <div className="library-active-filters" title={filterSummary}>
        {filterSummary.split(' / ').map((part) => (
          <span key={part} className="library-active-filter-item">{part}</span>
        ))}
      </div>

      <div className="library-count-row">
        {tr('library.items', { count: total })} {loading && tr('library.loading')}
      </div>

      <div className="library-list-scroll">
        <div
          ref={gridRef}
          className="library-grid"
          role="grid"
          tabIndex={items.length ? 0 : -1}
          aria-label={tr('library.items', { count: total })}
          onFocus={handleGridFocus}
          onKeyDown={handleGridKeyDown}
          onContextMenu={(event) => event.preventDefault()}
        >
          {items.map((item, index) => (
            <LibraryItemCard
              key={item.id}
              ref={(element) => {
                cardRefs.current[index] = element
              }}
              item={item}
              thumbnailUrl={thumbnails[item.id]}
              active={index === activeIndex}
              tabIndex={-1}
              onOpenDetail={() => {
                setActiveIndex(index)
                onOpenDetail(item.id)
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setActiveIndex(index)
                setContextMenu({ x: event.clientX, y: event.clientY, item })
              }}
            />
          ))}
        </div>
      </div>

      <div className="library-pagination">
        <button
          className="btn-secondary library-pagination-edge"
          title={tr('library.prev')}
          aria-label={tr('library.prev')}
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
        >
          <CaretLeftIcon />
        </button>
        <div className="library-pagination-pages" aria-label={tr('library.page', { page, total: totalPages })}>
          {paginationItems.map((item) => (
            typeof item === 'number' ? (
              <button
                key={item}
                className={`btn-secondary library-page-button${item === page ? ' is-current' : ''}`}
                disabled={item === page}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="library-pagination-ellipsis" aria-hidden="true">...</span>
            )
          ))}
        </div>
        <button
          className="btn-secondary library-pagination-edge"
          title={tr('library.next')}
          aria-label={tr('library.next')}
          disabled={page >= totalPages}
          onClick={() => setPage(p => p + 1)}
        >
          <CaretRightIcon />
        </button>
      </div>

      {contextMenu && (
        <ContextMenu
          id="library-card-context-menu"
          position={{ x: contextMenu.x, y: contextMenu.y }}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
