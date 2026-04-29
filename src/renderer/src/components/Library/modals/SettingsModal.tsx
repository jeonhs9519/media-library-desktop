import type { LanguageSetting } from '../../../i18n/index'
import { api } from '../../../api'
import Modal from '../../Modal'
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
  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>{tr('settings.title')}</h3>
          <button className="btn-secondary" title={tr('app.devTools')} onClick={() => api.app.toggleDevTools()} style={{ padding: '6px 10px' }}>DEV</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2%' }}>
          <div style={{ flex: '2 1 0', minWidth: 120 }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>{tr('settings.zoom.title')}</h3>
          </div>
          <div style={{ flex: '3 1 0', minWidth: 160, width: '100%', display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <button className="btn-secondary" title={tr('app.zoomOut')} style={{ padding: '6px 10px', flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => api.app.zoomOut()}>-</button>
            <button className="btn-secondary" title={tr('app.zoomReset')} style={{ padding: '6px 10px', flex: '1 1 auto', minWidth: 0, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => api.app.zoomReset()}>100%</button>
            <button className="btn-secondary" title={tr('app.zoomIn')} style={{ padding: '6px 10px', flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => api.app.zoomIn()}>+</button>
          </div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, paddingLeft: '2%', paddingRight: '2%', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: '2 1 0', minWidth: 120 }}>
              <h3 style={{ fontSize: 14, margin: 0 }}>{tr('settings.language.title')}</h3>
            </div>
            <div style={{ flex: '3 1 0', minWidth: 160 }}>
              <select
                value={languageSetting}
                onChange={e => onChangeLanguageSetting(e.target.value as LanguageSetting)}
                style={{ width: '100%' }}
              >
                <option value="system">{tr('settings.language.system')}</option>
                <option value="en">{tr('settings.language.en')}</option>
                <option value="ko">{tr('settings.language.ko')}</option>
                <option value="ja">{tr('settings.language.ja')}</option>
                <option value="zh">{tr('settings.language.zh')}</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, paddingLeft: '2%', paddingRight: '2%', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>{tr('settings.filePolicy.title')}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 12 }}>
            {tr('settings.filePolicy.help')}
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              value="once"
              checked={fileModifiedPolicy === 'once'}
              onChange={() => onChangeFileModifiedPolicy('once')}
            />
            <div>
              <div style={{ fontSize: 14 }}>{tr('settings.filePolicy.once')}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{tr('settings.filePolicy.onceHelp')}</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              value="always"
              checked={fileModifiedPolicy === 'always'}
              onChange={() => onChangeFileModifiedPolicy('always')}
            />
            <div>
              <div style={{ fontSize: 14 }}>{tr('settings.filePolicy.always')}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{tr('settings.filePolicy.alwaysHelp')}</div>
            </div>
          </label>
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, paddingLeft: '2%', paddingRight: '2%', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, marginBottom: 4 }}>{tr('settings.bulkRelink.title')}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 12 }}>
            {tr('settings.bulkRelink.help')}
          </p>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                value={bulkFromFolder}
                readOnly
                placeholder={tr('settings.bulkRelink.fromPlaceholder')}
              />
              <button className="btn-secondary" onClick={onPickBulkFromFolder}>
                {tr('settings.bulkRelink.pickBefore')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                value={bulkToFolder}
                readOnly
                placeholder={tr('settings.bulkRelink.toPlaceholder')}
              />
              <button className="btn-secondary" onClick={onPickBulkToFolder}>
                {tr('settings.bulkRelink.pickAfter')}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            {bulkCounting
              ? tr('settings.bulkRelink.matchCountLoading')
              : tr('settings.bulkRelink.matchCount', { count: bulkMatchCount })}
          </div>

          {bulkRelinkNotice && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>
              {bulkRelinkNotice}
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              disabled={!bulkFromFolder || !bulkToFolder || bulkMatchCount <= 0 || bulkRelinking}
              onClick={onOpenBulkRelinkConfirm}
            >
              {tr('settings.bulkRelink.apply')}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" style={{ width: '33%', minWidth: 140, paddingTop: 8, paddingBottom: 8 }} onClick={onClose}>{tr('common.close')}</button>
      </div>
    </Modal>
  )
}
