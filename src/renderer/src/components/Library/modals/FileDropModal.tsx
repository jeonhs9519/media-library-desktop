import React from 'react'
import Modal from '../../Modal'
import type { Translate } from '../types'

interface Props {
  open: boolean
  dragging: boolean
  notice: string
  title: string
  description: string
  supported: string
  dropHere: string
  dropActive: string
  dropHint: string
  onClose: () => void
  onBrowse: () => void
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: (event: React.DragEvent) => void
  onDrop: (event: React.DragEvent) => void
  tr: Translate
}

export default function FileDropModal({
  open,
  dragging,
  notice,
  title,
  description,
  supported,
  dropHere,
  dropActive,
  dropHint,
  onClose,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
  tr,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      contentWidth={640}
      contentMaxWidth="min(92vw, 760px)"
    >
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {description}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
        {supported}
      </p>

      <div
        className={`hdt-upload-dropzone${dragging ? ' is-dragging' : ''}`}
        onClick={onBrowse}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="hdt-upload-dropzone-title">
          {dragging ? dropActive : dropHere}
        </div>
        <div className="hdt-upload-dropzone-sub">{dropHint}</div>
      </div>

      {notice && (
        <div className="hdt-upload-notice">{notice}</div>
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn-secondary" onClick={onClose}>
          {tr('common.cancel')}
        </button>
      </div>
    </Modal>
  )
}
