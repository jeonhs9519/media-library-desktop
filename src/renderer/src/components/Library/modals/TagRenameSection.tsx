import { useState } from 'react'
import { api } from '../../../api'
import TagSearchInput from '../../TagSearchInput'
import type { TagUsageCount, Translate } from '../types'

type Props = {
  tags: TagUsageCount[]
  profileId: number | null
  onRenamed: (removedId: number | null, id: number) => Promise<void>
  tr: Translate
  hidden?: boolean
}

export default function TagRenameSection({ tags, profileId, onRenamed, tr, hidden = false }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [sourceQuery, setSourceQuery] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const selected = tags.find((tag) => String(tag.id) === selectedId)
  const duplicate = tags.find((tag) => tag.id !== selected?.id && tag.name === name.trim())

  const rename = async () => {
    if (!selected || !profileId || busy) return
    setBusy(true)
    setNotice('')
    try {
      const result = await api.tags.rename(selected.id, name, profileId)
      if (!result.ok) {
        setNotice(tr(`settings.tags.error.${result.reason}`))
        return
      }
      setSelectedId(String(result.id))
      setSourceQuery(result.name)
      setName(result.name)
      setNotice(tr(result.removedId ? 'settings.tags.merged' : 'settings.tags.done'))
      await onRenamed(result.removedId, result.id)
    } catch {
      setNotice(tr('settings.tags.error.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-section settings-tag-rename" aria-busy={busy} hidden={hidden}>
      <h3>{tr('settings.tags.title')}</h3>
      <p className="settings-section-help">{tr('settings.tags.help')}</p>
      <div className="settings-folder-grid">
        <TagSearchInput
          value={sourceQuery}
          options={tags}
          maxOptions={50}
          countSort="asc"
          closeOnCommit
          clearLabel={tr('settings.tags.clear')}
          showTagId
          placeholder={tr(tags.length ? 'settings.tags.current' : 'settings.tags.empty')}
          ariaLabel={tr('settings.tags.current')}
          disabled={busy || !tags.length}
          onChange={(value) => {
            setSourceQuery(value)
            const exact = tags.find((tag) => tag.name === value.trim())
            setSelectedId(exact ? String(exact.id) : '')
            setNotice('')
          }}
          onCommit={(value) => {
            const tag = tags.find((tag) => tag.name === value)
            if (!tag) return
            setSelectedId(String(tag.id))
            setSourceQuery(tag.name)
            setNotice('')
          }}
        />
        <TagSearchInput
          value={name}
          options={tags.filter((tag) => tag.id !== selected?.id)}
          maxOptions={50}
          countSort="desc"
          closeOnCommit
          clearLabel={tr('settings.tags.clear')}
          showTagId
          placeholder={tr('settings.tags.next')}
          ariaLabel={tr('settings.tags.next')}
          disabled={busy}
          onChange={(value) => { setName(value); setNotice('') }}
          onCommit={(value) => { setName(value); setNotice('') }}
        />
      </div>
      {duplicate && selected ? (
        <p className="settings-notice">{tr('settings.tags.mergeHelp', { name: duplicate.name, id: Math.min(selected.id, duplicate.id) })}</p>
      ) : null}
      {notice ? <div className="settings-notice" role="status">{notice}</div> : null}
      <div className="settings-section-actions">
        <div className="settings-meta settings-section-action-meta">
          {selected ? tr('settings.tags.count', { count: selected.count }) : ''}
        </div>
        <button className="btn-primary" disabled={busy || !selected || !name.trim() || name.trim() === selected.name} onClick={rename}>
          {busy ? tr('common.loading') : tr(duplicate ? 'settings.tags.merge' : 'settings.tags.apply')}
        </button>
      </div>
    </section>
  )
}
