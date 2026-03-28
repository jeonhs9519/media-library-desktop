import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import type { BookViewerViewMode } from './index'

function isBookViewerViewMode(value: string | null): value is BookViewerViewMode {
  return value === 'single' || value === 'double-ltr' || value === 'double-rtl'
}

export function useBookViewerViewMode(settingKey: string) {
  const [viewMode, setViewMode] = useState<BookViewerViewMode>('single')
  const [hasHydratedViewMode, setHasHydratedViewMode] = useState(false)

  const hydrateViewMode = useCallback(async () => {
    const savedViewMode = await api.settings.get(settingKey)
    if (isBookViewerViewMode(savedViewMode)) {
      setViewMode(savedViewMode)
    }
    setHasHydratedViewMode(true)
  }, [settingKey])

  useEffect(() => {
    if (!hasHydratedViewMode) return
    api.settings.set(settingKey, viewMode).catch(console.error)
  }, [settingKey, viewMode, hasHydratedViewMode])

  return {
    viewMode,
    setViewMode,
    hydrateViewMode,
  }
}
