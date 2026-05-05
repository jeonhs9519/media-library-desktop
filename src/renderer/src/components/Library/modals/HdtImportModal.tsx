import Modal from '../../Modal'
import { getContentTypeIcon } from '../mediaLabels'
import type { HdtPreviewItem, HdtPreviewStats, Translate } from '../types'

interface Props {
  open: boolean
  applying: boolean
  stats: HdtPreviewStats
  selectedIds: string[]
  groupedItems: Array<{ sourceFile: string; items: HdtPreviewItem[] }>
  onClose: () => void
  onApply: () => void
  onToggleItem: (previewId: string) => void
  onSelectGroup: (previewIds: string[]) => void
  onClearGroup: (previewIds: string[]) => void
  getReasonLabel: (item: HdtPreviewItem) => string
  tr: Translate
}

export default function HdtImportModal({
  open,
  applying,
  stats,
  selectedIds,
  groupedItems,
  onClose,
  onApply,
  onToggleItem,
  onSelectGroup,
  onClearGroup,
  getReasonLabel,
  tr,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr('modal.hdtImport.title')}
      contentMaxHeight="88vh"
      zIndex={1010}
    >
      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
        {tr('modal.hdtImport.summaryDetailed', {
          raw: stats.rawTotal,
          visible: stats.visibleTotal,
          selected: selectedIds.length,
        })}
      </div>

      <div className="hdt-preview-list">
        {groupedItems.map((group) => (
          <section key={group.sourceFile} className="hdt-preview-group">
            {(() => {
              const selectableIds = group.items
                .filter((item) => !item.disabledReason)
                .map((item) => item.previewId)
              const selectedCount = selectableIds.filter((id) => selectedIds.includes(id)).length
              const allSelected = selectableIds.length > 0 && selectedCount === selectableIds.length

              return (
                <div className="hdt-preview-group-header">
                  <span className="hdt-preview-group-title" title={group.sourceFile}>{group.sourceFile}</span>
                  <div className="hdt-preview-group-header-right">
                    <span className="hdt-preview-group-count">{tr('modal.hdtImport.groupCount', { count: group.items.length })}</span>
                    <span className="hdt-preview-group-selected">{tr('modal.hdtImport.groupSelected', { selected: selectedCount, total: selectableIds.length })}</span>
                    <button
                      type="button"
                      className="hdt-preview-group-action"
                      disabled={applying || !selectableIds.length || allSelected}
                      onClick={() => onSelectGroup(selectableIds)}
                    >
                      {tr('modal.hdtImport.groupAction.selectAll')}
                    </button>
                    <button
                      type="button"
                      className="hdt-preview-group-action"
                      disabled={applying || selectedCount === 0}
                      onClick={() => onClearGroup(selectableIds)}
                    >
                      {tr('modal.hdtImport.groupAction.clear')}
                    </button>
                  </div>
                </div>
              )
            })()}

            <div className="hdt-preview-group-items">
              {group.items.map((item) => {
                const disabled = !!item.disabledReason || applying
                const checked = selectedIds.includes(item.previewId)
                const fileLabel = `${item.fileName}${item.fileExtension ? `.${item.fileExtension}` : ''}`
                const cardClassName = [
                  'hdt-preview-card',
                  checked ? 'is-checked' : 'is-unchecked',
                  disabled ? 'is-disabled' : '',
                ].filter(Boolean).join(' ')

                return (
                  <button
                    key={item.previewId}
                    type="button"
                    className={cardClassName}
                    onClick={() => {
                      if (disabled) return
                      onToggleItem(item.previewId)
                    }}
                    title={item.title || tr('modal.hdtImport.untitled')}
                  >
                    <div className="hdt-preview-thumb-wrap">
                      {item.thumbnailBase64 ? (
                        <img
                          className="hdt-preview-thumb"
                          src={`data:image/jpeg;base64,${item.thumbnailBase64}`}
                          alt={item.title || tr('modal.hdtImport.untitled')}
                        />
                      ) : (
                        <div className="hdt-preview-thumb-fallback" aria-hidden="true">
                          <span className="hdt-preview-thumb-fallback-badge">{getContentTypeIcon(item.contentType)}</span>
                        </div>
                      )}
                    </div>

                    <div className="hdt-preview-main">
                      <div className="hdt-preview-title">{item.title || tr('modal.hdtImport.untitled')}</div>
                      <div className="hdt-preview-subline">{tr('modal.hdtImport.field.type')}: {item.contentType}</div>
                      <div className="hdt-preview-subline" title={item.sourceUrl || tr('detail.unknown')}>
                        {tr('modal.hdtImport.field.sourceUrl')}: {item.sourceUrl || tr('detail.unknown')}
                      </div>
                      <div className="hdt-preview-subline" title={item.author || tr('detail.unknown')}>
                        {tr('modal.hdtImport.field.author')}: {item.author || tr('detail.unknown')}
                      </div>
                      <div className="hdt-preview-subline" title={`${item.filePath}\\${fileLabel}`}>
                        {tr('modal.hdtImport.field.targetFile')}: {item.filePath}\\{fileLabel}
                      </div>
                    </div>

                    <div className="hdt-preview-state">{getReasonLabel(item)}</div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn-secondary" onClick={onClose} disabled={applying}>
          {tr('common.cancel')}
        </button>
        <button className="btn-primary" onClick={onApply} disabled={applying || !selectedIds.length}>
          {applying ? tr('common.loading') : tr('modal.hdtImport.apply')}
        </button>
      </div>
    </Modal>
  )
}
