import { useState } from 'react'
import Modal from '../../Modal'
import Dropdown from '../../Dropdown'
import { SortAscendingIcon, SortDescendingIcon } from '../../icons'
import type { TagUsageCount, Translate } from '../types'

type WatchedState = 'all' | 'unread' | 'inProgress' | 'completed'
type FileState = 'all' | 'normal' | 'missing'
const COLLAPSED_TAG_LIMIT = 20

interface Props {
  open: boolean
  search: string
  contentType: string
  language: string
  watchedState: WatchedState
  fileState: FileState
  sortBy: string
  sortDir: 'asc' | 'desc'
  tagUsageCounts: TagUsageCount[]
  selectedTagIds: number[]
  untaggedOnly: boolean
  onClose: () => void
  onChangeSearch: (value: string) => void
  onChangeContentType: (value: string) => void
  onChangeLanguage: (value: string) => void
  onChangeWatchedState: (value: WatchedState) => void
  onChangeFileState: (value: FileState) => void
  onChangeSortBy: (value: string) => void
  onChangeSortDir: (value: 'asc' | 'desc') => void
  onToggleTag: (tagId: number) => void
  onToggleUntagged: () => void
  onClearTags: () => void
  onResetSearch: () => void
  tr: Translate
}

export default function SearchFiltersModal({
  open,
  search,
  contentType,
  language,
  watchedState,
  fileState,
  sortBy,
  sortDir,
  tagUsageCounts,
  selectedTagIds,
  untaggedOnly,
  onClose,
  onChangeSearch,
  onChangeContentType,
  onChangeLanguage,
  onChangeWatchedState,
  onChangeFileState,
  onChangeSortBy,
  onChangeSortDir,
  onToggleTag,
  onToggleUntagged,
  onClearTags,
  onResetSearch,
  tr,
}: Props) {
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const hasSelectedTags = untaggedOnly || selectedTagIds.length > 0
  const hasHiddenTags = tagUsageCounts.length > COLLAPSED_TAG_LIMIT
  const visibleTags = tagsExpanded ? tagUsageCounts : tagUsageCounts.slice(0, COLLAPSED_TAG_LIMIT)
  const hiddenTagCount = Math.max(0, tagUsageCounts.length - COLLAPSED_TAG_LIMIT)

  return (
    <Modal
      open={open}
      onClose={onClose}
      contentWidth={600}
      contentHeight="calc(100vh - 100px)"
      contentMaxWidth="calc(100vw - 80px)"
      contentPadding={0}
    >
      <div className="search-filter-dialog">
        <div className="search-filter-header">
          <h2>{tr('filters.modalTitle')}</h2>
        </div>

        <div className="search-filter-body">
          <section className="search-filter-section">
            <h3>{tr('filters.conditions')}</h3>
            <div className="search-filter-grid">
              <label className="search-filter-field is-wide">
                <span>{tr('filters.keyword')}</span>
                <input
                  value={search}
                  onChange={(event) => onChangeSearch(event.target.value)}
                  placeholder={tr('filters.searchPlaceholder')}
                />
              </label>

              <div className="search-filter-field">
                <span>{tr('detail.contentType')}</span>
                <Dropdown
                  value={contentType}
                  options={[
                    { value: '', label: tr('filters.allTypes') },
                    { value: 'book', label: tr('filters.type.book') },
                    { value: 'comic', label: tr('filters.type.comic') },
                    { value: 'video', label: tr('filters.type.video') },
                    { value: 'other', label: tr('filters.type.other') },
                  ]}
                  onChange={onChangeContentType}
                  ariaLabel={tr('detail.contentType')}
                />
              </div>

              <div className="search-filter-field">
                <span>{tr('detail.language')}</span>
                <Dropdown
                  value={language}
                  options={[
                    { value: '', label: tr('filters.allLanguages') },
                    { value: 'ko', label: tr('filters.language.ko') },
                    { value: 'ja', label: tr('filters.language.ja') },
                    { value: 'en', label: tr('filters.language.en') },
                    { value: 'zh', label: tr('filters.language.zh') },
                    { value: 'other', label: tr('filters.language.other') },
                  ]}
                  onChange={onChangeLanguage}
                  ariaLabel={tr('detail.language')}
                />
              </div>

              <div className="search-filter-field">
                <span>{tr('filters.progressState')}</span>
                <Dropdown
                  value={watchedState}
                  options={[
                    { value: 'all', label: tr('filters.reading.all') },
                    { value: 'unread', label: tr('filters.reading.unread') },
                    { value: 'inProgress', label: tr('filters.reading.inProgress') },
                    { value: 'completed', label: tr('filters.reading.completed') },
                  ]}
                  onChange={(nextValue) => onChangeWatchedState(nextValue as WatchedState)}
                  ariaLabel={tr('filters.progressState')}
                />
              </div>

              <div className="search-filter-field">
                <span>{tr('filters.fileState')}</span>
                <Dropdown
                  value={fileState}
                  options={[
                    { value: 'all', label: tr('filters.file.all') },
                    { value: 'normal', label: tr('filters.file.normal') },
                    { value: 'missing', label: tr('filters.file.missing') },
                  ]}
                  onChange={(nextValue) => onChangeFileState(nextValue as FileState)}
                  ariaLabel={tr('filters.fileState')}
                />
              </div>

              <div className="search-filter-field is-wide">
                <span>{tr('filters.sort')}</span>
                <div className="search-filter-sort-row">
                  <Dropdown
                    value={sortBy}
                    options={[
                      { value: 'createdAt', label: tr('filters.sort.createdAt') },
                      { value: 'updatedAt', label: tr('filters.sort.updatedAt') },
                      { value: 'title', label: tr('filters.sort.title') },
                      { value: 'fileModifiedAt', label: tr('filters.sort.fileModifiedAt') },
                    ]}
                    onChange={onChangeSortBy}
                    ariaLabel={tr('filters.sort')}
                  />
                  <button
                    type="button"
                    className="btn-secondary search-filter-sort-toggle"
                    title={sortDir === 'asc' ? tr('filters.sort.asc') : tr('filters.sort.desc')}
                    aria-label={sortDir === 'asc' ? tr('filters.sort.asc') : tr('filters.sort.desc')}
                    onClick={() => onChangeSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDir === 'asc' ? <SortAscendingIcon /> : <SortDescendingIcon />}
                    <span>{sortDir === 'asc' ? tr('filters.sort.asc') : tr('filters.sort.desc')}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="search-filter-section">
            <div className="search-filter-section-header">
              <h3>{tr('filters.tags')}</h3>
              <button
                type="button"
                className="btn-secondary search-filter-tag-reset"
                disabled={!hasSelectedTags}
                onClick={onClearTags}
              >
                {tr('filters.clearTags')}
              </button>
            </div>
            <div className="search-filter-tags">
              <button
                type="button"
                className={`library-tag-chip${untaggedOnly ? ' is-selected' : ''}`}
                aria-pressed={untaggedOnly}
                onClick={onToggleUntagged}
              >
                <span className="library-tag-chip-name">{tr('filters.untagged')}</span>
              </button>
              {visibleTags.map((tag) => {
                const selected = !untaggedOnly && selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`library-tag-chip${selected ? ' is-selected' : ''}`}
                    aria-pressed={selected}
                    title={tr('filters.tagChipLabel', { name: tag.name, count: tag.count })}
                    onClick={() => onToggleTag(tag.id)}
                  >
                    <span className="library-tag-chip-name">{tag.name}</span>
                    <span className="library-tag-chip-count">{tag.count}</span>
                  </button>
                )
              })}
              {hasHiddenTags && (
                <button
                  type="button"
                  className="btn-secondary search-filter-tag-more"
                  onClick={() => setTagsExpanded((expanded) => !expanded)}
                >
                  {tagsExpanded
                    ? tr('filters.showLessTags')
                    : tr('filters.showMoreTags', { count: hiddenTagCount })}
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="search-filter-footer">
          <button className="btn-secondary" onClick={onResetSearch}>
            {tr('filters.resetSearch')}
          </button>
          <button className="btn-primary" onClick={onClose}>
            {tr('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
