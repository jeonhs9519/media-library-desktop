import Modal from '../../Modal'
import type { Translate } from '../types'

interface Props {
  fileName?: string
  onClose: () => void
  tr: Translate
}

export default function DuplicateFileModal({ fileName = '', onClose, tr }: Props) {
  return (
    <Modal open={!!fileName} onClose={onClose} title={tr('modal.duplicate.title')}>
      <p>{tr('modal.duplicate.message', { fileName })}</p>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={onClose}>{tr('common.ok')}</button>
      </div>
    </Modal>
  )
}
