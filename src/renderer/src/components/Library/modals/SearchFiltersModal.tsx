import Modal from '../../Modal'
import { SortAscendingIcon, SortDescendingIcon } from '../../icons'
import type { TagUsageCount, Translate } from '../types'

type WatchedState = 'all' | 'unread' | 'inProgress' | 'completed'
type FileState = 'all' | 'normal' | 'missing'

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
  onResetSearch,
  tr,
}: Props) {
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

              <label className="search-filter-field">
                <span>{tr('detail.contentType')}</span>
                <select value={contentType} onChange={(event) => onChangeContentType(event.target.value)}>
                  <option value="">{tr('filters.allTypes')}</option>
                  <option value="book">{tr('filters.type.book')}</option>
                  <option value="comic">{tr('filters.type.comic')}</option>
                  <option value="video">{tr('filters.type.video')}</option>
                  <option value="other">{tr('filters.type.other')}</option>
                </select>
              </label>

              <label className="search-filter-field">
                <span>{tr('detail.language')}</span>
                <select value={language} onChange={(event) => onChangeLanguage(event.target.value)}>
                  <option value="">{tr('filters.allLanguages')}</option>
                  <option value="ko">{tr('filters.language.ko')}</option>
                  <option value="ja">{tr('filters.language.ja')}</option>
                  <option value="en">{tr('filters.language.en')}</option>
                  <option value="zh">{tr('filters.language.zh')}</option>
                  <option value="other">{tr('filters.language.other')}</option>
                </select>
              </label>

              <label className="search-filter-field">
                <span>{tr('filters.progressState')}</span>
                <select value={watchedState} onChange={(event) => onChangeWatchedState(event.target.value as WatchedState)}>
                  <option value="all">{tr('filters.reading.all')}</option>
                  <option value="unread">{tr('filters.reading.unread')}</option>
                  <option value="inProgress">{tr('filters.reading.inProgress')}</option>
                  <option value="completed">{tr('filters.reading.completed')}</option>
                </select>
              </label>

              <label className="search-filter-field">
                <span>{tr('filters.fileState')}</span>
                <select value={fileState} onChange={(event) => onChangeFileState(event.target.value as FileState)}>
                  <option value="all">{tr('filters.file.all')}</option>
                  <option value="normal">{tr('filters.file.normal')}</option>
                  <option value="missing">{tr('filters.file.missing')}</option>
                </select>
              </label>

              <div className="search-filter-field is-wide">
                <span>{tr('filters.sort')}</span>
                <div className="search-filter-sort-row">
                  <select value={sortBy} onChange={(event) => onChangeSortBy(event.target.value)}>
                    <option value="createdAt">{tr('filters.sort.createdAt')}</option>
                    <option value="updatedAt">{tr('filters.sort.updatedAt')}</option>
                    <option value="title">{tr('filters.sort.title')}</option>
                    <option value="fileModifiedAt">{tr('filters.sort.fileModifiedAt')}</option>
                  </select>
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
            <h3>{tr('filters.tags')}</h3>
            <div className="search-filter-tags">
              <button
                type="button"
                className={`library-tag-chip${untaggedOnly ? ' is-selected' : ''}`}
                aria-pressed={untaggedOnly}
                onClick={onToggleUntagged}
              >
                <span className="library-tag-chip-name">{tr('filters.untagged')}</span>
              </button>
              {tagUsageCounts.map((tag) => {
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
