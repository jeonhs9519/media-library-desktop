import { useEffect, useState } from 'react'
import type { LanguageSetting } from '../../../i18n/index'
import { api } from '../../../api'
import Modal from '../../Modal'
import { CodeIcon, MinusSquareIcon, PlusSquareIcon } from '../../icons'
import type { Translate } from '../types'

interface Props {
  open: boolean
  languageSetting: LanguageSetting
  fileModifiedPolicy: string
  bulkFromFolder: string
  bulkToFolder: string
  bulkMatchCount: number
  bulkCounting: boolean
  bulkRelinking: boolean
  bulkRelinkNotice: string
  onClose: () => void
  onChangeLanguageSetting: (value: LanguageSetting) => void
  onChangeFileModifiedPolicy: (value: string) => void
  onPickBulkFromFolder: () => void
  onPickBulkToFolder: () => void
  onOpenBulkRelinkConfirm: () => void
  tr: Translate
}

export default function SettingsModal({
  open,
  languageSetting,
  fileModifiedPolicy,
  bulkFromFolder,
  bulkToFolder,
  bulkMatchCount,
  bulkCounting,
  bulkRelinking,
  bulkRelinkNotice,
  onClose,
  onChangeLanguageSetting,
  onChangeFileModifiedPolicy,
  onPickBulkFromFolder,
  onPickBulkToFolder,
  onOpenBulkRelinkConfirm,
  tr,
}: Props) {
  const [zoomFactor, setZoomFactor] = useState(1)

  useEffect(() => {
    if (!open) return
    void api.app.getZoomFactor().then((value: number) => setZoomFactor(value || 1))
  }, [open])

  const zoomPercent = `${Math.round(zoomFactor * 100)}%`

  const handleZoomOut = async () => {
    const next = await api.app.zoomOut()
    setZoomFactor(next || 1)
  }

  const handleZoomIn = async () => {
    const next = await api.app.zoomIn()
    setZoomFactor(next || 1)
  }

  const handleZoomReset = async () => {
    const next = await api.app.zoomReset()
    setZoomFactor(next || 1)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      contentWidth={600}
      contentHeight="calc(100vh - 100px)"
      contentMaxWidth="calc(100vw - 80px)"
      contentPadding={0}
    >
      <div className="settings-dialog">
        <div className="settings-header">
          <h2>{tr('settings.title')}</h2>
          <button
            className="btn-secondary library-icon-button"
            title={tr('app.devTools')}
            aria-label={tr('app.devTools')}
            onClick={() => api.app.toggleDevTools()}
          >
            <CodeIcon />
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3>{tr('settings.display.title')}</h3>

            <div className="settings-row">
              <div className="settings-row-label">
                <h4>{tr('settings.zoom.title')}</h4>
              </div>
              <div className="settings-row-control settings-zoom-control">
                <button className="btn-secondary settings-zoom-icon-button" title={tr('app.zoomOut')} aria-label={tr('app.zoomOut')} onClick={handleZoomOut}>
                  <MinusSquareIcon />
                </button>
                <button className="btn-secondary settings-zoom-reset-button" title={tr('app.zoomReset')} onClick={handleZoomReset}>
                  {zoomPercent} → 100%
                </button>
                <button className="btn-secondary settings-zoom-icon-button" title={tr('app.zoomIn')} aria-label={tr('app.zoomIn')} onClick={handleZoomIn}>
                  <PlusSquareIcon />
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-label">
                <h4>{tr('settings.language.title')}</h4>
              </div>
              <div className="settings-row-control">
                <select
                  value={languageSetting}
                  onChange={e => onChangeLanguageSetting(e.target.value as LanguageSetting)}
                >
                  <option value="system">{tr('settings.language.system')}</option>
                  <option value="en">{tr('settings.language.en')}</option>
                  <option value="ko">{tr('settings.language.ko')}</option>
                  <option value="ja">{tr('settings.language.ja')}</option>
                  <option value="zh">{tr('settings.language.zh')}</option>
                </select>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3>{tr('settings.filePolicy.title')}</h3>
            <p className="settings-section-help">{tr('settings.filePolicy.help')}</p>

            <label className="settings-radio">
              <input
                type="radio"
                value="once"
                checked={fileModifiedPolicy === 'once'}
                onChange={() => onChangeFileModifiedPolicy('once')}
              />
              <div>
                <div>{tr('settings.filePolicy.once')}</div>
                <p>{tr('settings.filePolicy.onceHelp')}</p>
              </div>
            </label>

            <label className="settings-radio">
              <input
                type="radio"
                value="always"
                checked={fileModifiedPolicy === 'always'}
                onChange={() => onChangeFileModifiedPolicy('always')}
              />
              <div>
                <div>{tr('settings.filePolicy.always')}</div>
                <p>{tr('settings.filePolicy.alwaysHelp')}</p>
              </div>
            </label>
          </section>

          <section className="settings-section">
            <h3>{tr('settings.bulkRelink.title')}</h3>
            <p className="settings-section-help">{tr('settings.bulkRelink.help')}</p>

            <div className="settings-folder-grid">
              <input
                value={bulkFromFolder}
                readOnly
                placeholder={tr('settings.bulkRelink.fromPlaceholder')}
              />
              <button className="btn-secondary" onClick={onPickBulkFromFolder}>
                {tr('settings.bulkRelink.pickBefore')}
              </button>

              <input
                value={bulkToFolder}
                readOnly
                placeholder={tr('settings.bulkRelink.toPlaceholder')}
              />
              <button className="btn-secondary" onClick={onPickBulkToFolder}>
                {tr('settings.bulkRelink.pickAfter')}
              </button>
            </div>

            <div className="settings-meta">
              {bulkCounting
                ? tr('settings.bulkRelink.matchCountLoading')
                : tr('settings.bulkRelink.matchCount', { count: bulkMatchCount })}
            </div>

            {bulkRelinkNotice && (
              <div className="settings-notice">{bulkRelinkNotice}</div>
            )}

            <div className="settings-section-actions">
              <button
                className="btn-primary"
                disabled={!bulkFromFolder || !bulkToFolder || bulkMatchCount <= 0 || bulkRelinking}
                onClick={onOpenBulkRelinkConfirm}
              >
                {tr('settings.bulkRelink.apply')}
              </button>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button className="btn-primary" onClick={onClose}>{tr('common.close')}</button>
        </div>
      </div>
    </Modal>
  )
}
