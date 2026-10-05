import React from 'react'
import Modal from '../Modal'
import ChoiceInput from '../ChoiceInput'
import Dropdown from '../Dropdown'
import type { useProfileSelection } from './useProfileSelection'

export default function ProfileDeleteModal({
  selection,
}: {
  selection: ReturnType<typeof useProfileSelection>
}) {
  const {
    deleteSummary,
    deleteMode,
    setDeleteMode,
    deleteTargetProfileId,
    setDeleteTargetProfileId,
    deleteDuplicateStrategy,
    setDeleteDuplicateStrategy,
    deleteConfirmed,
    setDeleteConfirmed,
    deleteBusy,
    deleteError,
    canDeleteProfile,
    closeDeleteProfileModal,
    deleteProfile,
  } = selection
  return (
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
                현재 해당 프로필에는 {deleteSummary.itemCount}개의 데이터가 등록되어있으며, 이를
                다른 프로필로 이관하거나, 데이터 채로 삭제할 수 있습니다.
                <br />
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
              현재 해당 프로필에 등록된 데이터가 존재하지 않습니다.
              <br />
              프로필 삭제 시 복구할 수 없습니다.
              <br />
              계속하시겠습니까?
            </p>
          )}

          {deleteError ? <div className="profile-delete-error">{deleteError}</div> : null}

          <div className="profile-delete-footer">
            <button
              className="btn-secondary"
              type="button"
              onClick={closeDeleteProfileModal}
              disabled={deleteBusy}
            >
              취소
            </button>
            <button
              className="btn-danger"
              type="button"
              onClick={deleteProfile}
              disabled={!canDeleteProfile}
            >
              삭제
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
