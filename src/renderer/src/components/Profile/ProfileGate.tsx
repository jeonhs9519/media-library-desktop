import React from 'react'
import { TrashIcon } from '../icons'
import ChoiceInput from '../ChoiceInput'
import type { ProfileStatus } from '../../types/profile'
import { useProfileSelection } from './useProfileSelection'
import ProfileDeleteModal from './ProfileDeleteModal'

function hasUnassignedData(status: ProfileStatus | null) {
  if (!status) return false
  return Object.values(status.unassignedCounts).some((count) => count > 0)
}

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const selection = useProfileSelection()
  const {
    status,
    selectedProfileId,
    setSelectedProfileId,
    profileName,
    setProfileName,
    useProfileOnNextStartup,
    setUseProfileOnNextStartup,
    profileNameInputRef,
    profileNameToast,
    profileNameToastClosing,
    profileNameErrorActive,
    loading,
    submitting,
    error,
    selectProfile,
    startWithSelection,
    createAndSelectProfile,
    openDeleteProfileModal,
    deleteBusy,
  } = selection
  if (status?.currentProfileId) return <>{children}</>

  return (
    <main className="profile-screen">
      <section className="profile-panel" aria-live="polite">
        <div className="startup-kicker">Media Library</div>
        <h1 className="profile-title">프로필 선택</h1>
        <p className="profile-description">사용할 프로필을 선택하거나 새 프로필을 생성하세요.</p>

        {hasUnassignedData(status) ? (
          <p className="profile-notice">
            현재 프로필이 지정되지 않은 데이터가 존재합니다. GUEST 프로필로 시작할 경우 해당
            데이터들은 GUEST 프로필에 귀속되며, 신규 프로필을 생성할 경우 생성된 프로필로
            귀속됩니다.
          </p>
        ) : null}

        {loading ? (
          <div className="profile-loading">프로필을 불러오는 중...</div>
        ) : (
          <>
            <div className="profile-list" role="radiogroup" aria-label="프로필 목록">
              {(status?.profiles || []).map((profile) => (
                <div
                  key={profile.id}
                  className={`profile-option-row${profile.id === 3 ? ' is-guest' : ''}`}
                >
                  <button
                    type="button"
                    className={`profile-option${selectedProfileId === profile.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedProfileId(profile.id)}
                    onDoubleClick={() => selectProfile(profile.id)}
                    onKeyDown={(event) => {
                      if (
                        (event.key === 'Enter' || event.key === ' ') &&
                        selectedProfileId === profile.id
                      ) {
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

        <ProfileDeleteModal selection={selection} />
      </section>
    </main>
  )
}
