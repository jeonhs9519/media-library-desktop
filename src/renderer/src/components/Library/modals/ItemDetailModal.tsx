import Modal from '../../Modal'
import ItemDetailPage from '../../../pages/ItemDetailPage'
import type { Item } from '../../../types'

interface Props {
  itemId: number | null
  onClose: () => void
  onAddToPlaylist: (item: Item) => void
}

export default function ItemDetailModal({ itemId, onClose, onAddToPlaylist }: Props) {
  return (
    <Modal
      open={itemId !== null}
      onClose={onClose}
      contentWidth={600}
      contentHeight="calc(100vh - 100px)"
      contentMaxWidth="calc(100vw - 80px)"
      contentPadding={0}
    >
      {itemId !== null && <ItemDetailPage itemId={itemId} onClose={onClose} onAddToPlaylist={onAddToPlaylist} />}
    </Modal>
  )
}
