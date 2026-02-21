import React, { useEffect } from 'react'

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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

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
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
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
