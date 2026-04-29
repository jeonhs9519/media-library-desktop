import React, { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  contentWidth?: number | string
  contentHeight?: number | string
  contentMaxWidth?: number | string
  contentMaxHeight?: number | string
  contentPadding?: number | string
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  contentWidth,
  contentHeight,
  contentMaxWidth,
  contentMaxHeight,
  contentPadding,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return

    const previousActiveElement = document.activeElement as HTMLElement | null
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    const focusFirstElement = () => {
      const content = contentRef.current
      const firstFocusable = content?.querySelector<HTMLElement>(focusableSelector)
      ;(firstFocusable || content)?.focus()
    }

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const content = contentRef.current
      if (!content) return

      const focusableElements = Array.from(content.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.offsetParent !== null || element === document.activeElement)

      if (!focusableElements.length) {
        event.preventDefault()
        content.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.setTimeout(focusFirstElement, 0)
    document.addEventListener('keydown', handleTabKey)

    return () => {
      document.removeEventListener('keydown', handleTabKey)
      previousActiveElement?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: contentPadding ?? 24,
          minWidth: contentWidth ? undefined : 400,
          width: contentWidth,
          height: contentHeight,
          maxWidth: contentMaxWidth ?? '90vw',
          maxHeight: contentMaxHeight ?? '90vh',
          overflow: 'auto',
        }}
      >
        {title && (
          <h2 style={{ marginBottom: 16, fontSize: 18 }}>{title}</h2>
        )}
        {children}
      </div>
    </div>
  )
}
