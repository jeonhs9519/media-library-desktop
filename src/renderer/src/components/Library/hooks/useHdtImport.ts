import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../api'
import { getDroppedFilePaths } from '../fileDrop'
import type { HdtPreviewItem, HdtPreviewResponse, HdtPreviewStats, Translate } from '../types'

type UseHdtImportOptions = {
  tr: Translate
  loadItems: () => Promise<void>
}

export function useHdtImport({ tr, loadItems }: UseHdtImportOptions) {
  const [hdtUploadModalOpen, setHdtUploadModalOpen] = useState(false)
  const [hdtUploadDragging, setHdtUploadDragging] = useState(false)
  const [hdtUploadNotice, setHdtUploadNotice] = useState('')
  const [hdtModalOpen, setHdtModalOpen] = useState(false)
  const [hdtPreviewItems, setHdtPreviewItems] = useState<HdtPreviewItem[]>([])
  const [hdtPreviewStats, setHdtPreviewStats] = useState<HdtPreviewStats>({ rawTotal: 0, visibleTotal: 0, selectableTotal: 0 })
  const [hdtSelectedIds, setHdtSelectedIds] = useState<string[]>([])
  const [hdtApplying, setHdtApplying] = useState(false)

  useEffect(() => {
    if (!hdtUploadModalOpen) return

    const allowFileDrop = (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    window.addEventListener('dragenter', allowFileDrop)
    window.addEventListener('dragover', allowFileDrop)
    window.addEventListener('drop', allowFileDrop)

    return () => {
      window.removeEventListener('dragenter', allowFileDrop)
      window.removeEventListener('dragover', allowFileDrop)
      window.removeEventListener('drop', allowFileDrop)
    }
  }, [hdtUploadModalOpen])

  const beginHdtPreview = useCallback(async (paths: string[]) => {
    if (!paths.length) return

    const hdtPaths = paths.filter((path) => path.toLowerCase().endsWith('.hdt'))
    if (!hdtPaths.length) {
      setHdtUploadNotice(tr('modal.hdtUpload.invalidSelection'))
      return
    }

    setHdtUploadNotice('')
    const previewResult = await api.items.importHdtPreview(hdtPaths) as HdtPreviewItem[] | HdtPreviewResponse
    const previewItems = Array.isArray(previewResult) ? previewResult : previewResult.items
    const stats = Array.isArray(previewResult)
      ? {
          rawTotal: previewItems.length,
          visibleTotal: previewItems.length,
          selectableTotal: previewItems.filter((item: HdtPreviewItem) => !item.disabledReason).length,
        }
      : previewResult.stats

    if (!previewItems.length) {
      setHdtUploadNotice(tr('modal.hdtUpload.noPreview'))
      return
    }

    const selectableIds = previewItems
      .filter((item: HdtPreviewItem) => !item.disabledReason)
      .map((item: HdtPreviewItem) => item.previewId)

    setHdtPreviewItems(previewItems)
    setHdtPreviewStats(stats)
    setHdtSelectedIds(selectableIds)
    setHdtUploadDragging(false)
    setHdtUploadNotice('')
    setHdtUploadModalOpen(false)
    setHdtModalOpen(true)
  }, [tr])

  const openHdtUploadModal = useCallback(() => {
    setHdtUploadNotice('')
    setHdtUploadDragging(false)
    setHdtUploadModalOpen(true)
  }, [])

  const closeHdtUploadModal = useCallback(() => {
    setHdtUploadModalOpen(false)
    setHdtUploadDragging(false)
    setHdtUploadNotice('')
  }, [])

  const handleBrowseHdtFiles = useCallback(async () => {
    const paths = await api.file.openDialog([
      { name: 'HDT Files', extensions: ['hdt'] },
      { name: 'All Files', extensions: ['*'] },
    ])
    await beginHdtPreview(paths)
  }, [beginHdtPreview])

  const handleHdtUploadDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setHdtUploadDragging(false)

    const hasFiles = Array.from(event.dataTransfer.types || []).includes('Files')
    if (!hasFiles) {
      setHdtUploadNotice(tr('modal.hdtUpload.invalidSelection'))
      return
    }

    const paths = getDroppedFilePaths(Array.from(event.dataTransfer.files))
    if (!paths.length) {
      setHdtUploadNotice(tr('modal.hdtUpload.dropBlocked'))
      return
    }

    await beginHdtPreview(paths)
  }, [beginHdtPreview, tr])

  const handleHdtUploadDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setHdtUploadDragging(true)
  }, [])

  const handleHdtUploadDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setHdtUploadDragging(false)
  }, [])

  const handleToggleHdtItem = useCallback((previewId: string) => {
    setHdtSelectedIds((prev) => (
      prev.includes(previewId)
        ? prev.filter((id) => id !== previewId)
        : [...prev, previewId]
    ))
  }, [])

  const resetHdtImport = useCallback(() => {
    setHdtModalOpen(false)
    setHdtPreviewItems([])
    setHdtPreviewStats({ rawTotal: 0, visibleTotal: 0, selectableTotal: 0 })
    setHdtSelectedIds([])
  }, [])

  const handleApplyHdt = useCallback(async () => {
    if (!hdtSelectedIds.length) {
      resetHdtImport()
      return
    }

    setHdtApplying(true)
    try {
      await api.items.importHdtApply(hdtSelectedIds)
      resetHdtImport()
      await loadItems()
    } finally {
      setHdtApplying(false)
    }
  }, [hdtSelectedIds, loadItems, resetHdtImport])

  const getHdtReasonLabel = useCallback((item: HdtPreviewItem) => {
    if (item.disabledReason === 'duplicate') return tr('modal.hdtImport.reason.duplicate')
    if (item.disabledReason === 'missing_title') return tr('modal.hdtImport.reason.missingTitle')
    if (item.disabledReason === 'missing_path') return tr('modal.hdtImport.reason.missingPath')
    if (item.disabledReason === 'invalid_entry') return tr('modal.hdtImport.reason.invalidEntry')
    return tr('modal.hdtImport.reason.ready')
  }, [tr])

  const groupedHdtPreviewItems = useMemo(() => {
    const groups = new Map<string, HdtPreviewItem[]>()
    for (const item of hdtPreviewItems) {
      const current = groups.get(item.sourceFile) ?? []
      current.push(item)
      groups.set(item.sourceFile, current)
    }
    return Array.from(groups.entries()).map(([sourceFile, items]) => ({ sourceFile, items }))
  }, [hdtPreviewItems])

  const handleSelectHdtGroup = useCallback((previewIds: string[]) => {
    if (hdtApplying || !previewIds.length) return
    setHdtSelectedIds((prev) => Array.from(new Set([...prev, ...previewIds])))
  }, [hdtApplying])

  const handleClearHdtGroup = useCallback((previewIds: string[]) => {
    if (hdtApplying || !previewIds.length) return
    const idSet = new Set(previewIds)
    setHdtSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
  }, [hdtApplying])

  const closeHdtImport = useCallback(() => {
    if (hdtApplying) return
    resetHdtImport()
  }, [hdtApplying, resetHdtImport])

  return {
    hdtUploadModalOpen,
    hdtUploadDragging,
    hdtUploadNotice,
    hdtModalOpen,
    hdtPreviewStats,
    hdtSelectedIds,
    hdtApplying,
    groupedHdtPreviewItems,
    isHdtModalOpen: hdtUploadModalOpen || hdtModalOpen,
    openHdtUploadModal,
    closeHdtUploadModal,
    closeHdtImport,
    handleBrowseHdtFiles,
    handleHdtUploadDrop,
    handleHdtUploadDragOver,
    handleHdtUploadDragLeave,
    handleToggleHdtItem,
    handleApplyHdt,
    getHdtReasonLabel,
    handleSelectHdtGroup,
    handleClearHdtGroup,
  }
}
