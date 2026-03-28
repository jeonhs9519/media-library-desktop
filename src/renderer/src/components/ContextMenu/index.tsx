import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

export type ContextMenuItem = {
  key: string
  label: string
  icon?: React.ReactNode
  shortcut?: string
  onSelect: () => void | Promise<void>
  tone?: 'default' | 'accent' | 'danger'
  disabled?: boolean
  checked?: boolean
}

export type ContextMenuSeparator = {
  key: string
  type: 'separator'
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

type ContextMenuProps = {
  id?: string
  position: { x: number; y: number }
  items: ContextMenuEntry[]
  onClose: () => void
  minWidth?: number
}

function isSeparator(item: ContextMenuEntry): item is ContextMenuSeparator {
  return (item as ContextMenuSeparator).type === 'separator'
}

const menuTokens = {
  itemHoverBg: 'var(--context-menu-item-hover-bg, rgba(255,255,255,0.07))',
  itemActiveBg: 'var(--context-menu-item-active-bg, rgba(255,255,255,0.12))',
  itemFocusBg: 'var(--context-menu-item-focus-bg, rgba(255,255,255,0.1))',
  itemFocusRing: 'var(--context-menu-item-focus-ring, rgba(110, 170, 255, 0.62))',
  dangerColor: 'var(--context-menu-item-danger-color, #ff7f8d)',
  disabledColor: 'var(--context-menu-item-disabled-color, rgba(255,255,255,0.38))',
  menuBg: 'var(--context-menu-bg, rgba(30, 34, 40, 0.95))',
  menuBorder: 'var(--context-menu-border, rgba(255,255,255,0.14))',
  menuShadow: 'var(--context-menu-shadow, 0 14px 32px rgba(0,0,0,0.48))',
}

function getTextLength(text: string) {
  return Array.from(text).length
}

function getShortcutMinWidth(items: ContextMenuEntry[]) {
  const maxShortcutLength = items.reduce((max, item) => {
    if (isSeparator(item) || !item.shortcut) return max
    return Math.max(max, getTextLength(item.shortcut))
  }, 0)
  if (maxShortcutLength <= 0) return 56
  return Math.max(56, Math.min(140, maxShortcutLength * 9 + 18))
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5.5 12.5l4.2 4.2L18.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ContextMenu({
  id,
  position,
  items,
  onClose,
  minWidth = 260,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [safePosition, setSafePosition] = useState(position)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const shortcutMinWidth = useMemo(() => getShortcutMinWidth(items), [items])
  const actionableItems = useMemo(
    () => items.filter((item): item is ContextMenuItem => !isSeparator(item) && !item.disabled),
    [items],
  )

  const activateItem = async (key: string | null) => {
    if (!key) return
    const item = items.find((entry) => !isSeparator(entry) && entry.key === key)
    if (!item || item.disabled) return
    await item.onSelect()
    onClose()
  }

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    const margin = 8
    const rect = menu.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - margin
    const maxY = window.innerHeight - rect.height - margin
    const x = Math.max(margin, Math.min(position.x, maxX))
    const y = Math.max(margin, Math.min(position.y, maxY))
    setSafePosition({ x, y })
  }, [position, items])

  useEffect(() => {
    const nextKey = actionableItems[0]?.key || null
    setFocusedKey((prev) => {
      if (prev && actionableItems.some((item) => item.key === prev)) return prev
      return nextKey
    })

    if (nextKey) {
      itemRefs.current[nextKey]?.focus()
      return
    }

    menuRef.current?.focus()
  }, [actionableItems])

  const moveFocus = (direction: 1 | -1) => {
    if (actionableItems.length === 0) return
    const currentIndex = focusedKey
      ? actionableItems.findIndex((item) => item.key === focusedKey)
      : -1
    const baseIndex = currentIndex >= 0 ? currentIndex : direction === 1 ? -1 : 0
    const nextIndex = (baseIndex + direction + actionableItems.length) % actionableItems.length
    const nextKey = actionableItems[nextIndex]?.key || null
    setFocusedKey(nextKey)
    setHoveredKey(nextKey)
    if (nextKey) {
      itemRefs.current[nextKey]?.focus()
    }
  }

  const onMenuKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveFocus(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveFocus(-1)
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      const firstKey = actionableItems[0]?.key || null
      setFocusedKey(firstKey)
      setHoveredKey(firstKey)
      if (firstKey) itemRefs.current[firstKey]?.focus()
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      const lastKey = actionableItems[actionableItems.length - 1]?.key || null
      setFocusedKey(lastKey)
      setHoveredKey(lastKey)
      if (lastKey) itemRefs.current[lastKey]?.focus()
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      await activateItem(focusedKey)
      return
    }
    if (e.key === 'Tab') {
      onClose()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div
      id={id}
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      style={{
        position: 'fixed',
        top: safePosition.y,
        left: safePosition.x,
        background: menuTokens.menuBg,
        border: `1px solid ${menuTokens.menuBorder}`,
        borderRadius: 10,
        boxShadow: menuTokens.menuShadow,
        zIndex: 1000,
        minWidth,
        width: 'max-content',
        maxWidth: 'min(92vw, 460px)',
        padding: '4px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'Segoe UI, Noto Sans KR, system-ui, sans-serif',
        fontSize: 13,
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item) => {
        if (isSeparator(item)) {
          return <div key={item.key} style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
        }

        const baseColor = item.tone === 'danger'
          ? menuTokens.dangerColor
          : item.tone === 'accent'
            ? '#4a9eff'
            : 'var(--text-primary)'
        const resolvedColor = item.disabled ? menuTokens.disabledColor : baseColor
        const isHovered = hoveredKey === item.key
        const isActive = activeKey === item.key
        const isFocused = focusedKey === item.key
        const background = isActive
          ? menuTokens.itemActiveBg
          : isHovered
            ? menuTokens.itemHoverBg
            : isFocused
              ? menuTokens.itemFocusBg
            : 'none'
        const itemIcon = item.icon ?? (item.checked ? <CheckIcon /> : null)
        const itemRole = typeof item.checked === 'boolean' ? 'menuitemcheckbox' : 'menuitem'

        return (
          <button
            key={item.key}
            ref={(el) => {
              itemRefs.current[item.key] = el
            }}
            role={itemRole}
            aria-checked={typeof item.checked === 'boolean' ? item.checked : undefined}
            aria-disabled={item.disabled ? true : undefined}
            tabIndex={-1}
            style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr auto',
              alignItems: 'center',
              columnGap: 12,
              width: '100%',
              textAlign: 'left',
              padding: '7px 10px',
              background,
              border: 'none',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              color: resolvedColor,
              fontSize: 12.5,
              opacity: item.disabled ? 0.72 : 1,
              transition: 'background-color 0.12s ease',
              outline: isFocused ? `1px solid ${menuTokens.itemFocusRing}` : 'none',
              outlineOffset: -1,
              borderRadius: 7,
              fontFamily: 'inherit',
            }}
            onClick={async () => {
              if (item.disabled) return
              await item.onSelect()
              onClose()
            }}
            onMouseEnter={() => {
              setHoveredKey(item.key)
              setFocusedKey(item.key)
            }}
            onMouseLeave={() => {
              setHoveredKey((prev) => (prev === item.key ? null : prev))
              setActiveKey((prev) => (prev === item.key ? null : prev))
            }}
            onMouseDown={() => setActiveKey(item.key)}
            onMouseUp={() => setActiveKey((prev) => (prev === item.key ? null : prev))}
            onFocus={() => setFocusedKey(item.key)}
          >
            <span
              style={{
                width: 20,
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                lineHeight: 1,
                color: resolvedColor,
              }}
            >
              {itemIcon}
            </span>
            <span style={{ whiteSpace: 'nowrap', color: resolvedColor, fontWeight: 500 }}>{item.label}</span>
            <span
              style={{
                minWidth: shortcutMinWidth,
                textAlign: 'right',
                color: 'var(--text-secondary)',
                fontSize: 11.5,
                letterSpacing: 0.15,
                whiteSpace: 'nowrap',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              }}
            >
              {item.shortcut || ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}