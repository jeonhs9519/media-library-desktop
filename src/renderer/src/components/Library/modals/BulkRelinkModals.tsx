import Modal from '../../Modal'
import type { BulkRelinkConflict, BulkRelinkFailedTarget, Translate } from '../types'

export function BulkRelinkConfirmModal({
  open,
  relinking,
  fromFolder,
  toFolder,
  matchCount,
  onClose,
  onApply,
  tr,
}: {
  open: boolean
  relinking: boolean
  fromFolder: string
  toFolder: string
  matchCount: number
  onClose: () => void
  onApply: () => void
  tr: Translate
}) {
  return (
    <Modal open={open} onClose={onClose} title={tr('settings.bulkRelink.confirmTitle')}>
      <p style={{ marginTop: 0, marginBottom: 12 }}>{tr('settings.bulkRelink.confirmMessage')}</p>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {tr('settings.bulkRelink.confirmBefore')}: {fromFolder}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {tr('settings.bulkRelink.confirmAfter')}: {toFolder}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
        {tr('settings.bulkRelink.matchCount', { count: matchCount })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn-secondary" disabled={relinking} onClick={onClose}>
          {tr('common.cancel')}
        </button>
        <button className="btn-primary" disabled={relinking} onClick={onApply}>
          {relinking ? tr('common.loading') : tr('settings.bulkRelink.confirmApply')}
        </button>
      </div>
    </Modal>
  )
}

export function BulkRelinkConflictModal({
  conflict,
  onClose,
  tr,
}: {
  conflict: BulkRelinkConflict | null
  onClose: () => void
  tr: Translate
}) {
  return (
    <Modal open={!!conflict} onClose={onClose} title={tr('settings.bulkRelink.conflictTitle')}>
      <p style={{ marginTop: 0, marginBottom: 10 }}>{tr('settings.bulkRelink.conflictMessage')}</p>
      {conflict?.movingTitle && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {tr('settings.bulkRelink.conflictMovingItem')}: {conflict.movingTitle}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, wordBreak: 'break-all' }}>
        {tr('settings.bulkRelink.conflictMovingPath')}: {conflict?.movingPath}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, wordBreak: 'break-all' }}>
        {tr('settings.bulkRelink.conflictTargetPath')}: {conflict?.targetPath}
      </div>
      {conflict?.existingTitle && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {tr('settings.bulkRelink.conflictExistingItem')}: {conflict.existingTitle}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, wordBreak: 'break-all' }}>
        {tr('settings.bulkRelink.conflictExistingPath')}: {conflict?.existingPath}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={onClose}>{tr('common.ok')}</button>
      </div>
    </Modal>
  )
}

export function BulkRelinkErrorModal({
  open,
  errorMessage,
  failedTarget,
  onClose,
  tr,
}: {
  open: boolean
  errorMessage: string
  failedTarget: BulkRelinkFailedTarget | null
  onClose: () => void
  tr: Translate
}) {
  return (
    <Modal open={open} onClose={onClose} title={tr('settings.bulkRelink.errorTitle')}>
      <p style={{ marginTop: 0, marginBottom: 16 }}>{tr('settings.bulkRelink.errorMessage')}</p>
      {failedTarget?.movingTitle && (
        <div style={{ marginTop: 0, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          {tr('settings.bulkRelink.errorFailedItem')}: {failedTarget.movingTitle}
        </div>
      )}
      {failedTarget?.movingPath && (
        <div style={{ marginTop: 0, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
          {tr('settings.bulkRelink.errorCurrentPath')}: {failedTarget.movingPath}
        </div>
      )}
      {failedTarget?.targetPath && (
        <div style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
          {tr('settings.bulkRelink.errorTargetPath')}: {failedTarget.targetPath}
        </div>
      )}
      {errorMessage && (
        <pre style={{ marginTop: 0, marginBottom: 16, padding: 10, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {errorMessage}
        </pre>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={onClose}>{tr('common.ok')}</button>
      </div>
    </Modal>
  )
}
