import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../api'
import type { PlaylistItem, PlaylistState } from '../../../types'

export function useLibraryPlaylists() {
  const [state, setState] = useState<PlaylistState | null>(null)
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const request = ++generation.current
    setBusy(true)
    setError(false)
    try {
      const next: PlaylistState = await api.playlists.getState()
      const entries = await api.playlists.getItems(next.selectedId)
      if (request !== generation.current) return
      setState(next)
      setItems(entries)
    } catch (error) {
      if (request === generation.current) setError(true)
      throw error
    } finally {
      if (request === generation.current) setBusy(false)
    }
  }, [])
  useEffect(() => {
    void reload().catch(console.error)
    return () => { generation.current++ }
  }, [reload])
  return { state, items, busy, error, reload }
}
