import React from 'react'
import Modal from '../Modal'
import StarRating from '../StarRating'
import type { Translate } from '../../i18n'
import type { useItemDetail } from './useItemDetail'

export default function ItemDetailDialogs({
  detail,
  tr,
}: {
  detail: ReturnType<typeof useItemDetail>
  tr: Translate
}) {
  const {
    reviewModal,
    setReviewModal,
    reviewForm,
    setReviewForm,
    handleReviewSave,
    relinkModal,
    setRelinkModal,
    handleRelink,
    relinkDuplicate,
    setRelinkDuplicate,
    relinkErrorOpen,
    setRelinkErrorOpen,
    relinkErrorMessage,
    setRelinkErrorMessage,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deleteBusy,
    handleDeleteConfirm,
  } = detail
  return (
    <>
      <Modal
        open={reviewModal}
        onClose={() => setReviewModal(false)}
        title={tr('detail.editReview')}
      >
        <div style={{ marginBottom: 16 }}>
          <StarRating
            value={reviewForm.rating}
            onChange={(v) => setReviewForm((f) => ({ ...f, rating: v }))}
          />
        </div>
        <textarea
          value={reviewForm.comment}
          onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
          placeholder={tr('detail.commentPlaceholder')}
          style={{ width: '100%', minHeight: 100, marginBottom: 16 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setReviewModal(false)}>
            {tr('common.cancel')}
          </button>
          <button className="btn-primary" onClick={handleReviewSave}>
            {tr('common.save')}
          </button>
        </div>
      </Modal>

      <Modal open={relinkModal} onClose={() => setRelinkModal(false)} title={tr('detail.relink')}>
        <p style={{ marginBottom: 16 }}>{tr('detail.relinkDescription')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setRelinkModal(false)}>
            {tr('common.cancel')}
          </button>
          <button className="btn-primary" onClick={handleRelink}>
            {tr('detail.browse')}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!relinkDuplicate}
        onClose={() => setRelinkDuplicate(null)}
        title={tr('detail.relinkDuplicateTitle')}
      >
        <p style={{ marginBottom: 8 }}>{tr('detail.relinkDuplicateMessage')}</p>
        {relinkDuplicate?.duplicateTitle && (
          <p style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            {tr('detail.relinkDuplicateItem')}: {relinkDuplicate.duplicateTitle}
          </p>
        )}
        {relinkDuplicate?.targetPath && (
          <p
            style={{
              marginBottom: 8,
              fontSize: 13,
              color: 'var(--text-secondary)',
              wordBreak: 'break-all',
            }}
          >
            {tr('detail.relinkDuplicateTarget')}: {relinkDuplicate.targetPath}
          </p>
        )}
        {relinkDuplicate?.duplicatePath && (
          <p
            style={{
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--text-secondary)',
              wordBreak: 'break-all',
            }}
          >
            {tr('detail.relinkDuplicateExisting')}: {relinkDuplicate.duplicatePath}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => setRelinkDuplicate(null)}>
            {tr('common.ok')}
          </button>
        </div>
      </Modal>

      <Modal
        open={relinkErrorOpen}
        onClose={() => setRelinkErrorOpen(false)}
        title={tr('detail.relinkErrorTitle')}
      >
        <p style={{ marginBottom: 16 }}>{tr('detail.relinkErrorMessage')}</p>
        {relinkErrorMessage && (
          <pre
            style={{
              marginBottom: 16,
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {relinkErrorMessage}
          </pre>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            onClick={() => {
              setRelinkErrorOpen(false)
              setRelinkErrorMessage('')
            }}
          >
            {tr('common.ok')}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          if (!deleteBusy) setDeleteConfirmOpen(false)
        }}
        title={tr('common.delete')}
      >
        <p style={{ marginBottom: 8 }}>{tr('detail.confirmDelete')}</p>
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
          {tr('detail.deleteWarning')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={deleteBusy}
          >
            {tr('common.cancel')}
          </button>
          <button className="btn-danger" onClick={handleDeleteConfirm} disabled={deleteBusy}>
            {deleteBusy ? tr('common.loading') : tr('common.delete')}
          </button>
        </div>
      </Modal>
    </>
  )
}
