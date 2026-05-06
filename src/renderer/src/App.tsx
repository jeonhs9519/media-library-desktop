import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import { api } from './api'
import { loadCbzViewerPage, loadPdfViewerPage, loadVideoPlayerPage } from './routes/viewerPages'
import { TrashIcon } from './components/icons'
import Modal from './components/Modal'
import ChoiceInput from './components/ChoiceInput'
import Dropdown from './components/Dropdown'

const PdfViewerPage = lazy(loadPdfViewerPage)
const CbzViewerPage = lazy(loadCbzViewerPage)
const VideoPlayerPage = lazy(loadVideoPlayerPage)

type StartupStep = {
  phase: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  durationMs?: number
  detail?: string
}

type StartupStatus = {
  ready: boolean
  phase: string
  label: string
  detail?: string
  elapsedMs?: number
  steps: StartupStep[]
  error?: string
}

type ProfileSummary = {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

type ProfileStatus = {
  currentProfileId: number | null
  profiles: ProfileSummary[]
  lastActiveProfileId: number | null
  useLastProfileOnStartup: boolean
  unassignedCounts: {
    items: number
    tags: number
    playlists: number
    settings: number
  }
}

type ProfileDeleteSummary = {
  ok: boolean
  reason?: string
  profile?: ProfileSummary
  itemCount: number
  targets: Array<{ id: number; name: string }>
  status?: ProfileStatus
}

const STARTUP_LABELS: Record<string, string> = {
  boot: '앱을 시작하는 중',
  'window:create': '창을 여는 중',
  'db:open': '라이브러리 데이터베이스를 여는 중',
  'db:migrate': '데이터베이스 구조를 확인하는 중',
  'db:runtime-schema': '런타임 스키마를 점검하는 중',
  'ipc:register': '앱 기능을 준비하는 중',
  ready: '준비 완료',
}

function getStartupLabel(status?: Pick<StartupStatus, 'phase' | 'label'>) {
  if (!status) return STARTUP_LABELS.boot
  return STARTUP_LABELS[status.phase] || status.label || STARTUP_LABELS.boot
}

function formatDuration(ms?: number) {
  if (typeof ms !== 'number') return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StartupGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<StartupStatus | null>(null)

  useEffect(() => {
    let mounted = true

    api.startup.getStatus().then((nextStatus: StartupStatus) => {
      if (mounted) setStatus(nextStatus)
    }).catch((error: unknown) => {
      if (!mounted) return
      setStatus({
        ready: false,
        phase: 'error',
        label: 'Startup failed',
        steps: [],
        error: String((error as Error)?.message || error),
      })
    })

    const removeStatusListener = api.startup.onStatus((nextStatus: StartupStatus) => {
      setStatus(nextStatus)
    })
    const removeReadyListener = api.startup.onReady((nextStatus: StartupStatus) => {
      setStatus(nextStatus)
    })

    return () => {
      mounted = false
      removeStatusListener()
      removeReadyListener()
    }
  }, [])

  const visibleSteps = useMemo(() => status?.steps || [], [status?.steps])

  if (status?.ready) {
    return <>{children}</>
  }

  return (
    <main className="startup-screen">
      <section className="startup-panel" aria-live="polite">
        <div className="startup-kicker">Media Library</div>
        <h1 className="startup-title">{getStartupLabel(status || undefined)}</h1>
        <div className="startup-progress" aria-hidden="true">
          <div className="startup-progress-bar" />
        </div>
        <div className="startup-meta">
          <span>{formatDuration(status?.elapsedMs) || '0ms'}</span>
          {status?.detail ? <span title={status.detail}>{status.detail}</span> : null}
        </div>

        {status?.error ? (
          <pre className="startup-error">{status.error}</pre>
        ) : (
          <ol className="startup-steps">
            {visibleSteps.map((step) => (
              <li key={step.phase} className={`startup-step is-${step.status}`}>
                <span className="startup-step-dot" />
                <span className="startup-step-label">{getStartupLabel(step)}</span>
                <span className="startup-step-duration">{formatDuration(step.durationMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}

function RouteFallback() {
  return (
    <main className="startup-screen">
      <section className="startup-panel" aria-live="polite">
        <div className="startup-kicker">Media Library</div>
        <h1 className="startup-title">{STARTUP_LABELS.boot}</h1>
        <div className="startup-progress" aria-hidden="true">
          <div className="startup-progress-bar" />
        </div>
      </section>
    </main>
  )
}

function getProfileErrorMessage(reason?: string) {
  if (reason === 'empty-name') return '프로필명을 입력해주세요.'
  if (reason === 'name-too-long') return '프로필명은 16자 이하로 입력해주세요.'
  if (reason === 'reserved-name') return '사용할 수 없는 프로필명입니다.'
  if (reason === 'duplicate-name') return '이미 존재하는 프로필명입니다.'
  if (reason === 'transfer-failed') return '기존 데이터 이관 중 오류가 발생했습니다.'
  return '프로필을 선택하지 못했습니다.'
}

function hasUnassignedData(status: ProfileStatus | null) {
  if (!status) return false
  return Object.values(status.unassignedCounts).some((count) => count > 0)
}

function ProfileGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ProfileStatus | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [profileName, setProfileName] = useState('')
  const [useProfileOnNextStartup, setUseProfileOnNextStartup] = useState(false)
  const [profileNameToast, setProfileNameToast] = useState<{ id: number; message: string } | null>(null)
  const [profileNameToastClosing, setProfileNameToastClosing] = useState(false)
  const [profileNameErrorActive, setProfileNameErrorActive] = useState(false)
  const [profileNameFocusSignal, setProfileNameFocusSignal] = useState(0)
  const [deleteSummary, setDeleteSummary] = useState<ProfileDeleteSummary | null>(null)
  const [deleteMode, setDeleteMode] = useState<'transfer' | 'delete'>('transfer')
  const [deleteTargetProfileId, setDeleteTargetProfileId] = useState<number | null>(null)
  const [deleteDuplicateStrategy, setDeleteDuplicateStrategy] = useState<'target' | 'source'>('target')
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const profileNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true

    api.profiles.getStatus()
      .then((nextStatus: ProfileStatus) => {
        if (!mounted) return
        setStatus(nextStatus)
        const initialProfileId = nextStatus.currentProfileId
          || nextStatus.lastActiveProfileId
          || nextStatus.profiles[0]?.id
          || null
        setSelectedProfileId(initialProfileId)
        setUseProfileOnNextStartup(Boolean(nextStatus.useLastProfileOnStartup))
      })
      .catch((err: unknown) => {
        if (mounted) setError(String((err as Error)?.message || err))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!profileNameToast) return
    const timeoutId = window.setTimeout(() => setProfileNameToastClosing(true), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [profileNameToast])

  useEffect(() => {
    if (!profileNameToast || !profileNameToastClosing) return
    const timeoutId = window.setTimeout(() => setProfileNameToast(null), 160)
    return () => window.clearTimeout(timeoutId)
  }, [profileNameToast, profileNameToastClosing])

  useEffect(() => {
    if (!profileNameErrorActive) return
    const timeoutId = window.setTimeout(() => setProfileNameErrorActive(false), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [profileNameErrorActive])

  useEffect(() => {
    if (!profileNameFocusSignal) return
    profileNameInputRef.current?.focus()
    profileNameInputRef.current?.select()
  }, [profileNameFocusSignal])

  if (status?.currentProfileId) return <>{children}</>

  const showProfileNameError = (message: string) => {
    setProfileNameToastClosing(false)
    setProfileNameToast((current) => ({ id: (current?.id ?? 0) + 1, message }))
    setProfileNameErrorActive(true)
    setProfileNameFocusSignal((current) => current + 1)
  }

  const selectProfile = async (profileId: number) => {
    setSubmitting(true)
    setError('')
    try {
      const result = await api.profiles.select(profileId, useProfileOnNextStartup)
      if (!result?.ok) {
        setStatus(result?.status || status)
        setError(result?.message || getProfileErrorMessage(result?.reason))
        return
      }
      setStatus(result.status)
    } catch (err: unknown) {
      setError(String((err as Error)?.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  const startWithSelection = async () => {
    if (profileName.trim()) {
      await createAndSelectProfile()
      return
    }

    if (selectedProfileId) {
      await selectProfile(selectedProfileId)
    }
  }

  const createAndSelectProfile = async () => {
    setSubmitting(true)
    setError('')
    setProfileNameToast(null)
    setProfileNameToastClosing(false)
    try {
      const result = await api.profiles.createAndSelect(profileName, useProfileOnNextStartup)
      if (!result?.ok) {
        setStatus(result?.status || status)
        showProfileNameError(result?.message || getProfileErrorMessage(result?.reason))
        return
      }
      setProfileName('')
      setStatus(result.status)
    } catch (err: unknown) {
      showProfileNameError(String((err as Error)?.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteProfileModal = async (profile: ProfileSummary) => {
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const result = await api.profiles.getDeleteSummary(profile.id) as ProfileDeleteSummary
      if (!result?.ok) {
        setStatus(result?.status || status)
        setError(getProfileErrorMessage(result?.reason))
        return
      }

      setDeleteSummary(result)
      setDeleteMode(result.itemCount > 0 ? 'transfer' : 'delete')
      setDeleteTargetProfileId(result.targets[0]?.id ?? null)
      setDeleteDuplicateStrategy('target')
      setDeleteConfirmed(false)
    } catch (err: unknown) {
      setError(String((err as Error)?.message || err))
    } finally {
      setDeleteBusy(false)
    }
  }

  const closeDeleteProfileModal = () => {
    if (deleteBusy) return
    setDeleteSummary(null)
    setDeleteError('')
  }

  const deleteProfile = async () => {
    if (!deleteSummary?.profile) return

    setDeleteBusy(true)
    setDeleteError('')
    try {
      const result = await api.profiles.delete(
        deleteSummary.profile.id,
        deleteMode,
        deleteMode === 'transfer' ? deleteTargetProfileId ?? undefined : undefined,
        deleteMode === 'transfer' ? deleteDuplicateStrategy : undefined,
      )

      if (!result?.ok) {
        setStatus(result?.status || status)
        setDeleteError(result?.message || getProfileErrorMessage(result?.reason))
        return
      }

      const nextStatus = result.status as ProfileStatus
      setStatus(nextStatus)
      setSelectedProfileId(
        nextStatus.currentProfileId
          || nextStatus.lastActiveProfileId
          || nextStatus.profiles[0]?.id
          || null,
      )
      setDeleteSummary(null)
    } catch (err: unknown) {
      setDeleteError(String((err as Error)?.message || err))
    } finally {
      setDeleteBusy(false)
    }
  }

  const deleteRequiresConfirmation = Boolean(deleteSummary && deleteSummary.itemCount > 0)
  const canDeleteProfile = Boolean(deleteSummary?.profile)
    && !deleteBusy
    && (!deleteRequiresConfirmation || deleteConfirmed)
    && (deleteMode !== 'transfer' || Boolean(deleteTargetProfileId))

  return (
    <main className="profile-screen">
      <section className="profile-panel" aria-live="polite">
        <div className="startup-kicker">Media Library</div>
        <h1 className="profile-title">프로필 선택</h1>
        <p className="profile-description">
          사용할 프로필을 선택하거나 새 프로필을 생성하세요.
        </p>

        {hasUnassignedData(status) ? (
          <p className="profile-notice">
            현재 프로필이 지정되지 않은 데이터가 존재합니다. GUEST 프로필로 시작할 경우 해당 데이터들은 GUEST 프로필에 귀속되며, 신규 프로필을 생성할 경우 생성된 프로필로 귀속됩니다.
          </p>
        ) : null}

        {loading ? (
          <div className="profile-loading">프로필을 불러오는 중...</div>
        ) : (
          <>
            <div className="profile-list" role="radiogroup" aria-label="프로필 목록">
              {(status?.profiles || []).map((profile) => (
                <div key={profile.id} className={`profile-option-row${profile.id === 3 ? ' is-guest' : ''}`}>
                  <button
                    type="button"
                  className={`profile-option${selectedProfileId === profile.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedProfileId(profile.id)}
                  onDoubleClick={() => selectProfile(profile.id)}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && selectedProfileId === profile.id) {
                      event.preventDefault()
                      selectProfile(profile.id)
                    }
                  }}
                  disabled={submitting}
                  role="radio"
                    aria-checked={selectedProfileId === profile.id}
                  >
                    <span className="profile-type-label">
                      {profile.id === 3 ? '기본 프로필' : '사용자 프로필'}
                    </span>
                    <span className="profile-name-line">
                      <span className="profile-name-text">{profile.name}</span>
                      {profile.id === status?.lastActiveProfileId ? (
                        <span className="profile-last-used">마지막으로 사용</span>
                      ) : null}
                    </span>
                  </button>
                  {profile.id > 3 ? (
                    <button
                      type="button"
                      className="profile-delete-button"
                      title="프로필 삭제"
                      aria-label={`${profile.name} 프로필 삭제`}
                      disabled={submitting || deleteBusy}
                      onClick={() => openDeleteProfileModal(profile)}
                    >
                      <TrashIcon size={19} />
                    </button>
                  ) : null}
                </div>
              ))}

              <div
                className={`profile-create-option${!selectedProfileId && profileName.trim() ? ' is-selected' : ''}${profileNameErrorActive ? ' is-error-highlight' : ''}`}
              >
                <span className="profile-type-label">신규 프로필</span>
                <input
                  ref={profileNameInputRef}
                  id="profile-name"
                  value={profileName}
                  maxLength={16}
                  onChange={(event) => {
                    setProfileName(event.target.value)
                    setSelectedProfileId(null)
                  }}
                  onFocus={() => setSelectedProfileId(null)}
                  placeholder="프로필명 입력"
                  disabled={submitting}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && profileName.trim()) {
                      createAndSelectProfile()
                    }
                  }}
                />
                {profileNameToast ? (
                  <div
                    className={`profile-create-toast is-error${profileNameToastClosing ? ' is-closing' : ''}`}
                    aria-live="polite"
                  >
                    {profileNameToast.message}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="profile-actions">
              {error ? <div className="profile-error">{error}</div> : null}
              <ChoiceInput
                className="profile-remember-option"
                type="checkbox"
                checked={useProfileOnNextStartup}
                onChange={(event) => setUseProfileOnNextStartup(event.target.checked)}
                disabled={submitting}
              >
                <span>다음 실행 시 이 프로필 사용</span>
              </ChoiceInput>
              <button
                className="btn-primary"
                type="button"
                disabled={(!selectedProfileId && !profileName.trim()) || submitting}
                onClick={startWithSelection}
              >
                선택한 프로필로 시작
              </button>
            </div>
          </>
        )}

        <Modal
          open={Boolean(deleteSummary)}
          onClose={closeDeleteProfileModal}
          title="프로필 삭제"
          contentWidth={560}
          contentMaxWidth="calc(100vw - 64px)"
        >
          {deleteSummary?.profile ? (
            <div className="profile-delete-dialog">
              {deleteSummary.itemCount > 0 ? (
                <>
                  <p className="profile-delete-message">
                    현재 해당 프로필에는 {deleteSummary.itemCount}개의 데이터가 등록되어있으며, 이를 다른 프로필로 이관하거나, 데이터 채로 삭제할 수 있습니다.<br />
                    프로필 및 데이터 삭제 시 복구할 수 없습니다.
                  </p>

                  <div className="profile-delete-options">
                    <ChoiceInput
                      className="profile-delete-radio"
                      type="radio"
                      name="profile-delete-mode"
                      checked={deleteMode === 'transfer'}
                      onChange={() => setDeleteMode('transfer')}
                      disabled={deleteBusy}
                    >
                      <span>데이터 이관</span>
                    </ChoiceInput>
                    <ChoiceInput
                      className="profile-delete-radio"
                      type="radio"
                      name="profile-delete-mode"
                      checked={deleteMode === 'delete'}
                      onChange={() => setDeleteMode('delete')}
                      disabled={deleteBusy}
                    >
                      <span>데이터 함께 삭제</span>
                    </ChoiceInput>
                  </div>

                  {deleteMode === 'transfer' ? (
                    <div className="profile-delete-transfer">
                      <div className="profile-delete-field">
                        <span>이관 대상 프로필</span>
                        <Dropdown
                          value={deleteTargetProfileId?.toString() ?? ''}
                          options={deleteSummary.targets.map((target) => ({
                            value: target.id.toString(),
                            label: target.name,
                          }))}
                          onChange={(nextValue) => setDeleteTargetProfileId(Number(nextValue))}
                          disabled={deleteBusy}
                          ariaLabel="이관 대상 프로필"
                        />
                      </div>

                      <div className="profile-delete-field">
                        <span>중복 데이터 처리 방식</span>
                        <ChoiceInput
                          className="profile-delete-radio"
                          type="radio"
                          name="profile-delete-duplicate"
                          checked={deleteDuplicateStrategy === 'target'}
                          onChange={() => setDeleteDuplicateStrategy('target')}
                          disabled={deleteBusy}
                        >
                          <span>대상 프로필의 데이터 사용</span>
                        </ChoiceInput>
                        <ChoiceInput
                          className="profile-delete-radio"
                          type="radio"
                          name="profile-delete-duplicate"
                          checked={deleteDuplicateStrategy === 'source'}
                          onChange={() => setDeleteDuplicateStrategy('source')}
                          disabled={deleteBusy}
                        >
                          <span>본 프로필의 데이터로 덮어쓰기</span>
                        </ChoiceInput>
                      </div>
                    </div>
                  ) : null}

                  <ChoiceInput
                    className="profile-delete-confirm"
                    type="checkbox"
                    checked={deleteConfirmed}
                    onChange={(event) => setDeleteConfirmed(event.target.checked)}
                    disabled={deleteBusy}
                  >
                    <span>위 내용을 확인하였습니다.</span>
                  </ChoiceInput>
                </>
              ) : (
                <p className="profile-delete-message">
                  현재 해당 프로필에 등록된 데이터가 존재하지 않습니다.<br />
                  프로필 삭제 시 복구할 수 없습니다.<br />
                  계속하시겠습니까?
                </p>
              )}

              {deleteError ? <div className="profile-delete-error">{deleteError}</div> : null}

              <div className="profile-delete-footer">
                <button className="btn-secondary" type="button" onClick={closeDeleteProfileModal} disabled={deleteBusy}>
                  취소
                </button>
                <button className="btn-danger" type="button" onClick={deleteProfile} disabled={!canDeleteProfile}>
                  삭제
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <StartupGate>
      <ProfileGate>
        <HashRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LibraryPage />} />
              <Route path="/items/:id" element={<LibraryPage />} />
              <Route path="/view/pdf/:id" element={<PdfViewerPage />} />
              <Route path="/view/cbz/:id" element={<CbzViewerPage />} />
              <Route path="/view/video/:id" element={<VideoPlayerPage />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </ProfileGate>
    </StartupGate>
  )
}
