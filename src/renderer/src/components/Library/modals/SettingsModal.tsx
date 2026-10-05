import { useEffect, useRef, useState } from 'react'
import type { LanguageSetting } from '../../../i18n/index'
import type { ProfileStatus } from '../../../types/profile'
import { api } from '../../../api'
import Modal from '../../Modal'
import ChoiceInput from '../../ChoiceInput'
import Dropdown from '../../Dropdown'
import PathPickerInput from '../../PathPickerInput'
import { CodeIcon, MinusSquareIcon, PlusSquareIcon } from '../../icons'
import type { TagUsageCount, Translate } from '../types'
import TagRenameSection from './TagRenameSection'

interface Props {
  tagUsageCounts: TagUsageCount[]
  onTagRenamed: (removedId: number | null, id: number) => Promise<void>
  open: boolean
  languageSetting: LanguageSetting
  fileModifiedPolicy: string
  playlistPosition: 'left' | 'right'
  bulkFromFolder: string
  bulkToFolder: string
  bulkMatchCount: number
  bulkCounting: boolean
  bulkRelinking: boolean
  bulkRelinkNotice: string
  legacyDbPath: string
  legacyDbNotice: string
  legacyDbPreviewing: boolean
  hdtFilePaths: string[]
  hdtNotice: string
  hdtPreviewing: boolean
  profileStatus: Pick<ProfileStatus, 'currentProfileId' | 'profiles'> | null
  profileNameDraft: string
  profileNotice: { message: string; tone: 'success' | 'error' } | null
  profileToastClosing: boolean
  profileNameErrorActive: boolean
  profileNameFocusSignal: number
  profileBusy: boolean
  onClose: () => void
  onChangeProfileNameDraft: (value: string) => void
  onRenameProfile: () => void
  onOpenProfileSelection: () => void
  onChangeLanguageSetting: (value: LanguageSetting) => void
  onChangeFileModifiedPolicy: (value: string) => void
  onChangePlaylistPosition: (value: 'left' | 'right') => void
  onPickBulkFromFolder: () => void
  onPickBulkToFolder: () => void
  onOpenBulkRelinkConfirm: () => void
  onSelectLegacyDbFile: (file: File | null) => void
  onPreviewLegacyDbImport: () => void
  onSelectHdtFiles: (files: File[]) => void
  onPreviewHdtImport: () => void
  tr: Translate
}

export default function SettingsModal({
  tagUsageCounts,
  onTagRenamed,
  open,
  languageSetting,
  fileModifiedPolicy,
  playlistPosition,
  bulkFromFolder,
  bulkToFolder,
  bulkMatchCount,
  bulkCounting,
  bulkRelinking,
  bulkRelinkNotice,
  legacyDbPath,
  legacyDbNotice,
  legacyDbPreviewing,
  hdtFilePaths,
  hdtNotice,
  hdtPreviewing,
  profileStatus,
  profileNameDraft,
  profileNotice,
  profileToastClosing,
  profileNameErrorActive,
  profileNameFocusSignal,
  profileBusy,
  onClose,
  onChangeProfileNameDraft,
  onRenameProfile,
  onOpenProfileSelection,
  onChangeLanguageSetting,
  onChangeFileModifiedPolicy,
  onChangePlaylistPosition,
  onPickBulkFromFolder,
  onPickBulkToFolder,
  onOpenBulkRelinkConfirm,
  onSelectLegacyDbFile,
  onPreviewLegacyDbImport,
  onSelectHdtFiles,
  onPreviewHdtImport,
  tr,
}: Props) {
  const [zoomFactor, setZoomFactor] = useState(1)
  const [activeCategory, setActiveCategory] = useState<'profile' | 'basic' | 'data'>('basic')
  const legacyDbFileInputRef = useRef<HTMLInputElement>(null)
  const hdtFileInputRef = useRef<HTMLInputElement>(null)
  const profileNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    void api.app.getZoomFactor().then((value: number) => setZoomFactor(value || 1))
  }, [open])

  useEffect(() => {
    if (!open) setActiveCategory('basic')
  }, [open])

  useEffect(() => {
    if (!open || !profileNameFocusSignal) return
    profileNameInputRef.current?.focus()
    profileNameInputRef.current?.select()
  }, [open, profileNameFocusSignal])

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

  const handleOpenLegacyDbFileDialog = () => {
    onSelectLegacyDbFile(null)
    if (legacyDbFileInputRef.current) {
      legacyDbFileInputRef.current.value = ''
      legacyDbFileInputRef.current.click()
    }
  }

  const legacyDbFileName = legacyDbPath
    ? legacyDbPath.split(/[\\/]/).filter(Boolean).pop() ?? legacyDbPath
    : ''
  const hdtFileLabel = hdtFilePaths.length === 0
    ? ''
    : hdtFilePaths.length === 1
      ? hdtFilePaths[0].split(/[\\/]/).filter(Boolean).pop() ?? hdtFilePaths[0]
      : tr('settings.hdtImport.selectedCount', { count: hdtFilePaths.length })
  const canRenameProfile = Boolean(profileStatus?.currentProfileId && profileStatus.currentProfileId > 3)

  const handleOpenHdtFileDialog = () => {
    onSelectHdtFiles([])
    if (hdtFileInputRef.current) {
      hdtFileInputRef.current.value = ''
      hdtFileInputRef.current.click()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      contentWidth={720}
      contentHeight="min(860px, calc(100vh - 32px))"
      contentMaxWidth="calc(100vw - 32px)"
      contentMaxHeight="calc(100vh - 32px)"
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

        <div className="settings-layout">
          <nav className="settings-tabs" aria-label={tr('settings.navigation')}>
            {(['basic', 'data', 'profile'] as const).map((category) => (
              <button
                key={category}
                type="button"
                className={`settings-tab-button${activeCategory === category ? ' is-active' : ''}`}
                aria-current={activeCategory === category ? 'page' : undefined}
                onClick={() => setActiveCategory(category)}
              >
                {tr(`settings.category.${category}`)}
              </button>
            ))}
          </nav>

          <div className="settings-body">
          <section className="settings-section" hidden={activeCategory !== 'profile'}>
            <h3>{tr('settings.profile.title')}</h3>
            <p className="settings-section-help">{tr('settings.profile.help')}</p>
            {!canRenameProfile ? (
              <p className="settings-section-help settings-profile-guest-help">
                ※ {tr('settings.profile.guestRenameUnavailable')}
              </p>
            ) : null}

            <div className="settings-row">
              <div className="settings-row-label">
                <h4>{tr('settings.profile.currentName')}</h4>
              </div>
              <div className="settings-row-control settings-inline-action settings-profile-field">
                <input
                  ref={profileNameInputRef}
                  className={profileNameErrorActive ? 'is-error-highlight' : ''}
                  value={profileNameDraft}
                  maxLength={16}
                  disabled={profileBusy || !canRenameProfile}
                  onChange={(event) => onChangeProfileNameDraft(event.target.value)}
                />
                <button
                  className="btn-secondary"
                  disabled={profileBusy || !canRenameProfile || !profileNameDraft.trim()}
                  onClick={onRenameProfile}
                >
                  {tr('settings.profile.rename')}
                </button>
                {profileNotice ? (
                  <div
                    className={`settings-profile-toast is-${profileNotice.tone}${profileToastClosing ? ' is-closing' : ''}`}
                    aria-live="polite"
                  >
                    {profileNotice.message}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="settings-section" hidden={activeCategory !== 'basic'}>
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
                <Dropdown
                  value={languageSetting}
                  options={[
                    { value: 'system', label: tr('settings.language.system') },
                    { value: 'en', label: tr('settings.language.en') },
                    { value: 'ko', label: tr('settings.language.ko') },
                    { value: 'ja', label: tr('settings.language.ja') },
                    { value: 'zh', label: tr('settings.language.zh') },
                  ]}
                  onChange={(nextValue) => onChangeLanguageSetting(nextValue as LanguageSetting)}
                  ariaLabel={tr('settings.language.title')}
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-label">
                <h4>{tr('settings.playlistPosition.title')}</h4>
              </div>
              <div className="settings-row-control">
                <Dropdown
                  value={playlistPosition}
                  options={[
                    { value: 'right', label: tr('settings.playlistPosition.right') },
                    { value: 'left', label: tr('settings.playlistPosition.left') },
                  ]}
                  onChange={(nextValue) => onChangePlaylistPosition(nextValue as 'left' | 'right')}
                  ariaLabel={tr('settings.playlistPosition.title')}
                />
              </div>
            </div>
          </section>

          <section className="settings-section" hidden={activeCategory !== 'basic'}>
            <h3>{tr('settings.filePolicy.title')}</h3>
            <p className="settings-section-help">{tr('settings.filePolicy.help')}</p>

            <ChoiceInput
              className="settings-radio"
              type="radio"
              value="once"
              checked={fileModifiedPolicy === 'once'}
              onChange={() => onChangeFileModifiedPolicy('once')}
            >
              <div>
                <div>{tr('settings.filePolicy.once')}</div>
                <p>{tr('settings.filePolicy.onceHelp')}</p>
              </div>
            </ChoiceInput>

            <ChoiceInput
              className="settings-radio"
              type="radio"
              value="always"
              checked={fileModifiedPolicy === 'always'}
              onChange={() => onChangeFileModifiedPolicy('always')}
            >
              <div>
                <div>{tr('settings.filePolicy.always')}</div>
                <p>{tr('settings.filePolicy.alwaysHelp')}</p>
              </div>
            </ChoiceInput>
          </section>

          {open ? <TagRenameSection tags={tagUsageCounts} profileId={profileStatus?.currentProfileId ?? null} onRenamed={onTagRenamed} tr={tr} hidden={activeCategory !== 'data'} /> : null}
          <section className="settings-section" hidden={activeCategory !== 'data'}>
            <h3>{tr('settings.bulkRelink.title')}</h3>
            <p className="settings-section-help">{tr('settings.bulkRelink.help')}</p>

            <div className="settings-folder-grid">
              <PathPickerInput
                value={bulkFromFolder}
                placeholder={tr('settings.bulkRelink.fromPlaceholder')}
                browseLabel={tr('settings.bulkRelink.pickBefore')}
                onBrowse={onPickBulkFromFolder}
              />

              <PathPickerInput
                value={bulkToFolder}
                placeholder={tr('settings.bulkRelink.toPlaceholder')}
                browseLabel={tr('settings.bulkRelink.pickAfter')}
                onBrowse={onPickBulkToFolder}
              />
            </div>

            {bulkRelinkNotice && (
              <div className="settings-notice">{bulkRelinkNotice}</div>
            )}

            <div className="settings-section-actions">
              <div className="settings-meta settings-section-action-meta">
                {bulkCounting
                  ? tr('settings.bulkRelink.matchCountLoading')
                  : tr('settings.bulkRelink.matchCount', { count: bulkMatchCount })}
              </div>
              <button
                className="btn-primary"
                disabled={!bulkFromFolder || !bulkToFolder || bulkMatchCount <= 0 || bulkRelinking}
                onClick={onOpenBulkRelinkConfirm}
              >
                {tr('settings.bulkRelink.apply')}
              </button>
            </div>
          </section>

          <section className="settings-section" hidden={activeCategory !== 'data'}>
            <h3>{tr('settings.hdtImport.title')}</h3>
            <p className="settings-section-help">{tr('settings.hdtImport.help')}</p>

            <div className="settings-folder-grid">
              <PathPickerInput
                value={hdtFileLabel}
                placeholder={tr('settings.hdtImport.placeholder')}
                browseLabel={tr('modal.hdtUpload.browse')}
                onBrowse={handleOpenHdtFileDialog}
              />
              <input
                ref={hdtFileInputRef}
                className="settings-hidden-file-input"
                type="file"
                accept=".hdt"
                multiple
                onChange={(event) => onSelectHdtFiles(Array.from(event.target.files ?? []))}
              />
            </div>

            {hdtFilePaths.length > 0 && (
              <div className="settings-meta" title={hdtFilePaths.join('\n')}>{hdtFilePaths.join(', ')}</div>
            )}

            {hdtNotice && (
              <div className="settings-notice">{hdtNotice}</div>
            )}
            <div className="settings-section-actions settings-import-actions">
              <div className="settings-section-action-spacer" aria-hidden="true" />
              <button
                className="btn-primary"
                disabled={!hdtFilePaths.length || hdtPreviewing}
                onClick={onPreviewHdtImport}
              >
                {hdtPreviewing ? tr('common.loading') : tr('settings.hdtImport.load')}
              </button>
            </div>
          </section>

          <section className="settings-section" hidden={activeCategory !== 'profile'}>
            <h3>{tr('settings.legacyDb.title')}</h3>
            <p className="settings-section-help">{tr('settings.legacyDb.help')}</p>

            <div className="settings-folder-grid">
              <PathPickerInput
                value={legacyDbFileName}
                placeholder={tr('settings.legacyDb.placeholder')}
                browseLabel={tr('modal.hdtUpload.browse')}
                onBrowse={handleOpenLegacyDbFileDialog}
              />
              <input
                ref={legacyDbFileInputRef}
                className="settings-hidden-file-input"
                type="file"
                accept=".db"
                onChange={(event) => onSelectLegacyDbFile(event.target.files?.[0] ?? null)}
              />
            </div>

            {legacyDbPath && (
              <div className="settings-meta" title={legacyDbPath}>{legacyDbPath}</div>
            )}

            {legacyDbNotice && (
              <div className="settings-notice">{legacyDbNotice}</div>
            )}
            <div className="settings-section-actions settings-import-actions">
              <div className="settings-section-action-spacer" aria-hidden="true" />
              <button
                className="btn-primary"
                disabled={!legacyDbPath || legacyDbPreviewing}
                onClick={onPreviewLegacyDbImport}
              >
                {legacyDbPreviewing ? tr('common.loading') : tr('settings.legacyDb.load')}
              </button>
            </div>
          </section>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-secondary" disabled={profileBusy} onClick={onOpenProfileSelection}>
            {tr('settings.profile.openSelection')}
          </button>
          <button className="btn-primary" onClick={onClose}>{tr('common.close')}</button>
        </div>
      </div>
    </Modal>
  )
}
