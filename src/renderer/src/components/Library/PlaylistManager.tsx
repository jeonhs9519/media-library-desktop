import { useEffect, useRef, useState } from 'react'
import Dropdown from '../Dropdown'
import Modal from '../Modal'
import { PlaylistCreateIcon, PlaylistRenameIcon, PlaylistResetIcon, CloseXIcon } from '../icons'
import { api } from '../../api'
import type { PlaylistState } from '../../types'
import type { Translate } from './types'

type Props = { state: PlaylistState | null; busy: boolean; reload: () => Promise<void>; tr: Translate }
type Action = 'create' | 'rename' | 'delete' | 'clear'

export default function PlaylistManager({ state, busy, reload, tr }: Props) {
  const [dialog, setDialog] = useState<{ action: Action; id?: number; profileId: number; name: string } | null>(null)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const restoreSelectionFocus = useRef(false)
  const selected = state?.lists.find(list => list.id === state.selectedId)
  const disabled = busy || pending || !state
  const errorText = (reason?: string) => tr(`playlist.error.${reason || 'failed'}`)

  useEffect(() => {
    if (!pending && !busy && restoreSelectionFocus.current) {
      restoreSelectionFocus.current = false
      root.current?.querySelector<HTMLButtonElement>('.dropdown-trigger')?.focus()
    }
  }, [pending, busy])

  const open = (action: Action) => {
    if (!state || !selected) return
    setError('')
    setName(action === 'rename' ? selected.name : '')
    setDialog({ action, id: selected.id, profileId: state.profileId, name: selected.name })
  }
  const select = async (id: string) => {
    if (!state || lock.current) return
    lock.current = true
    restoreSelectionFocus.current = true
    setPending(true)
    setError('')
    try {
      const result = await api.playlists.select(Number(id), state.profileId)
      if (!result.ok) { setError(errorText(result.reason)); return }
      await reload()
    } catch { setError(tr('playlist.error.failed')) }
    finally { lock.current = false; setPending(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dialog || lock.current) return
    lock.current = true
    setPending(true)
    setError('')
    try {
      const result = dialog.action === 'create' ? await api.playlists.create(name, dialog.profileId)
        : dialog.action === 'rename' ? await api.playlists.rename(dialog.id!, name, dialog.profileId)
          : dialog.action === 'delete' ? await api.playlists.delete(dialog.id!, dialog.profileId)
            : await api.playlists.clear(dialog.id!)
      if (!result.ok) { setError(errorText(result.reason)); return }
      await reload()
      setDialog(null)
    } catch { setError(tr('playlist.error.failed')) }
    finally { lock.current = false; setPending(false) }
  }

  return <>
    <div className="playlist-manager" ref={root}>
      <Dropdown value={String(state?.selectedId ?? '')} ariaLabel={tr('playlist.select')}
        className="playlist-select" disabled={disabled}
        options={state?.lists.map(list => ({ value: String(list.id), label: list.name, count: list.count })) ?? []}
        onChange={id => { void select(id) }} />
      <div className="playlist-manager-actions">
        <button className="btn-secondary library-icon-button" title={tr('playlist.create')} aria-label={tr('playlist.create')}
          disabled={disabled} onClick={() => open('create')}><PlaylistCreateIcon /></button>
        <button className="btn-secondary library-icon-button" title={tr('playlist.rename')} aria-label={tr('playlist.rename')}
          disabled={disabled} onClick={() => open('rename')}><PlaylistRenameIcon /></button>
        <button className="btn-secondary library-icon-button" title={tr('playlist.clear')} aria-label={tr('playlist.clear')}
          disabled={disabled || !selected?.count} onClick={() => open('clear')}><PlaylistResetIcon /></button>
        <button className="btn-secondary library-icon-button playlist-delete-button" aria-label={tr('common.delete')}
          disabled={disabled || (state?.lists.length ?? 0) <= 1}
          title={(state?.lists.length ?? 0) <= 1 ? tr('playlist.error.last-playlist') : tr('common.delete')}
          onClick={() => open('delete')}><CloseXIcon /></button>
      </div>
      {error && !dialog ? <p role="alert" className="playlist-manager-error">{error}</p> : null}
    </div>
    <Modal open={Boolean(dialog)} title={dialog ? tr(`playlist.dialog.${dialog.action}`) : ''}
      onClose={() => { if (!pending) { setDialog(null); setError('') } }} contentWidth={420}>
      <form onSubmit={submit} className="playlist-manager-form">
        {dialog?.action === 'create' || dialog?.action === 'rename' ?
          <label>{tr('playlist.name')}<input autoFocus aria-label={tr('playlist.name')} value={name}
            maxLength={100} disabled={pending} onChange={event => { setName(event.target.value); setError('') }} /></label>
          : <p>{tr(dialog?.action === 'delete' ? 'playlist.deleteConfirm' : 'playlist.clearConfirm', { name: dialog?.name ?? '' })}</p>}
        {error ? <p role="alert" className="playlist-manager-error">{error}</p> : null}
        <div className="playlist-manager-dialog-actions">
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => { setDialog(null); setError('') }}>{tr('common.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={pending || ((dialog?.action === 'create' || dialog?.action === 'rename') && !name.trim())}>
            {dialog?.action === 'delete' ? tr('common.delete') : dialog?.action === 'clear' ? tr('playlist.clear') : tr('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  </>
}
