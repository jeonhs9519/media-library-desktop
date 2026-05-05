import { useState } from 'react'
import type { ReactNode } from 'react'
import Modal from '../../Modal'
import { CaretBottomIcon, CaretRightIcon } from '../../icons'
import { getContentTypeIcon } from '../mediaLabels'
import type {
  LegacyDatabasePreview,
  LegacyDatabasePreviewItem,
  LegacyDatabasePreviewSetting,
  LegacyDatabasePreviewTag,
  Translate,
} from '../types'

interface Props {
  open: boolean
  preview: LegacyDatabasePreview | null
  importing: boolean
  onClose: () => void
  onApply: () => void
  tr: Translate
}

function getReasonLabel(item: LegacyDatabasePreviewItem, tr: Translate) {
  if (item.disabledReason === 'duplicate') return tr('settings.legacyDb.reason.duplicate')
  if (item.disabledReason === 'invalid_entry') return tr('settings.legacyDb.reason.invalid')
  return tr('settings.legacyDb.reason.ready')
}

type AccordionId = 'settings' | 'tags' | 'items'

export default function LegacyDatabaseImportModal({
  open,
  preview,
  importing,
  onClose,
  onApply,
  tr,
}: Props) {
  const [openPanels, setOpenPanels] = useState<Record<AccordionId, boolean>>({
    settings: true,
    tags: true,
    items: true,
  })
  const stats = preview?.stats
  const importableCount = stats?.importableItemCount ?? 0
  const togglePanel = (id: AccordionId) => {
    setOpenPanels((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr('settings.legacyDb.previewTitle')}
      contentWidth={720}
      contentMaxWidth="calc(100vw - 80px)"
      contentMaxHeight="88vh"
    >
      {!preview ? null : (
        <>
          <div className="legacy-db-preview-summary">
            <div>{tr('settings.legacyDb.previewSummary', {
              source: stats?.sourceItemCount ?? 0,
              importable: importableCount,
              duplicate: stats?.duplicateItemCount ?? 0,
              invalid: stats?.invalidItemCount ?? 0,
            })}</div>
            <div>{tr('settings.legacyDb.previewRelated', {
              tags: stats?.tagCount ?? 0,
              reviews: stats?.reviewCount ?? 0,
              playlists: stats?.playlistCount ?? 0,
              playlistItems: stats?.playlistItemCount ?? 0,
            })}</div>
            {preview.message && <div className="legacy-db-preview-error">{preview.message}</div>}
          </div>

          <div className="legacy-db-accordion-list">
            <AccordionSection
              id="settings"
              title={tr('settings.legacyDb.accordion.settings')}
              count={preview.settings.length}
              open={openPanels.settings}
              onToggle={togglePanel}
            >
              {preview.settings.length ? (
                <div className="legacy-db-data-list">
                  {preview.settings.map((setting) => (
                    <SettingRow key={setting.key} setting={setting} tr={tr} />
                  ))}
                </div>
              ) : (
                <div className="legacy-db-empty">{tr('settings.legacyDb.empty')}</div>
              )}
            </AccordionSection>

            <AccordionSection
              id="tags"
              title={tr('settings.legacyDb.accordion.tags')}
              count={preview.tags.length}
              open={openPanels.tags}
              onToggle={togglePanel}
            >
              <div className="legacy-db-inline-notice">{tr('settings.legacyDb.tagCleanupNotice')}</div>
              {preview.tags.length ? (
                <div className="legacy-db-chip-list">
                  {preview.tags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} tr={tr} />
                  ))}
                </div>
              ) : (
                <div className="legacy-db-empty">{tr('settings.legacyDb.empty')}</div>
              )}
            </AccordionSection>

            <AccordionSection
              id="items"
              title={tr('settings.legacyDb.accordion.items')}
              count={preview.items.length}
              open={openPanels.items}
              onToggle={togglePanel}
            >
              {preview.items.length ? (
                <div className="legacy-db-item-list">
                  {preview.items.map((item) => (
                    <ItemRow key={item.previewId} item={item} tr={tr} />
                  ))}
                </div>
              ) : (
                <div className="legacy-db-empty">{tr('settings.legacyDb.empty')}</div>
              )}
            </AccordionSection>
          </div>

          <div className="legacy-db-preview-actions">
            <button className="btn-secondary" onClick={onClose} disabled={importing}>
              {tr('common.cancel')}
            </button>
            <button className="btn-primary" onClick={onApply} disabled={importing || !preview.ok || importableCount <= 0}>
              {importing ? tr('common.loading') : tr('settings.legacyDb.apply')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function AccordionSection({
  id,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  id: AccordionId
  title: string
  count: number
  open: boolean
  onToggle: (id: AccordionId) => void
  children: ReactNode
}) {
  return (
    <section className="legacy-db-accordion-section">
      <button
        type="button"
        className="legacy-db-accordion-header"
        aria-expanded={open}
        onClick={() => onToggle(id)}
      >
        <span className="legacy-db-accordion-caret" aria-hidden="true">
          {open ? <CaretBottomIcon size={16} /> : <CaretRightIcon size={16} />}
        </span>
        <span className="legacy-db-accordion-title">{title}</span>
        <span className="legacy-db-accordion-count">{count}</span>
      </button>
      {open && <div className="legacy-db-accordion-body">{children}</div>}
    </section>
  )
}

function SettingRow({ setting, tr }: { setting: LegacyDatabasePreviewSetting; tr: Translate }) {
  return (
    <div className={`legacy-db-data-row${setting.exists ? ' is-muted' : ''}`}>
      <div className="legacy-db-data-main">
        <div className="legacy-db-data-title">{setting.key}</div>
        <div className="legacy-db-data-subline" title={setting.value}>{setting.value}</div>
      </div>
      <div className="legacy-db-data-state">
        {setting.exists ? tr('settings.legacyDb.reason.duplicate') : tr('settings.legacyDb.reason.ready')}
      </div>
    </div>
  )
}

function TagChip({ tag, tr }: { tag: LegacyDatabasePreviewTag; tr: Translate }) {
  return (
    <span className={`legacy-db-tag-chip${tag.exists ? ' is-muted' : ''}`} title={tag.name}>
      {tag.name}
      <span>{tag.exists ? tr('settings.legacyDb.reason.duplicate') : tr('settings.legacyDb.reason.ready')}</span>
    </span>
  )
}

function ItemRow({ item, tr }: { item: LegacyDatabasePreviewItem; tr: Translate }) {
  const disabled = Boolean(item.disabledReason)
  const fileLabel = `${item.fileName}${item.fileExtension ? `.${item.fileExtension}` : ''}`
  const tagText = item.tagNames.length ? item.tagNames.join(', ') : tr('detail.unknown')

  return (
    <div className={`legacy-db-item-row${disabled ? ' is-muted' : ''}`} title={item.title}>
      <div className="legacy-db-item-icon" aria-hidden="true">
        {getContentTypeIcon(item.contentType)}
      </div>
      <div className="legacy-db-item-main">
        <div className="legacy-db-data-title">{item.title || tr('modal.hdtImport.untitled')}</div>
        <div className="legacy-db-data-subline" title={`${item.filePath}\\${fileLabel}`}>
          {item.filePath}\\{fileLabel}
        </div>
        <div className="legacy-db-item-meta">
          <span>{tr('modal.hdtImport.field.type')}: {item.contentType}</span>
          <span>{tr('settings.legacyDb.item.progress')}: {Math.round(item.progress * 100)}%</span>
          <span>{tr('settings.legacyDb.item.watched')}: {item.watched ? tr('common.ok') : tr('detail.unknown')}</span>
          <span>{tr('settings.legacyDb.item.thumbnail')}: {item.hasThumbnail ? tr('common.ok') : tr('detail.unknown')}</span>
          <span>{tr('detail.tags')}: {tagText}</span>
          <span>{tr('detail.review')}: {item.hasReview ? `${item.reviewRating ?? ''}` : tr('detail.unknown')}</span>
        </div>
      </div>
      <div className="legacy-db-data-state">{getReasonLabel(item, tr)}</div>
    </div>
  )
}
