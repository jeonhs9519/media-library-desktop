import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../api'
import { getDroppedFilePaths } from '../fileDrop'
import type { Translate } from '../types'

type UseFileImportOptions = {
  tr: Translate
  loadItems: () => Promise<void>
}

export function useFileImport({ tr, loadItems }: UseFileImportOptions) {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [duplicateModal, setDuplicateModal] = useState<{ fileName: string } | null>(null)
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false)
  const [fileUploadDragging, setFileUploadDragging] = useState(false)
  const [fileUploadNotice, setFileUploadNotice] = useState('')

  const addFile = useCallback(async (filePath: string) => {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    const dir = filePath.substring(0, lastSlash)
    const baseName = filePath.substring(lastSlash + 1)
    const lastDot = baseName.lastIndexOf('.')
    const fileName = lastDot > 0 ? baseName.substring(0, lastDot) : baseName
    const fileExtension = lastDot > 0 ? baseName.substring(lastDot + 1) : ''

    const exists = await api.items.checkExists(dir, fileName, fileExtension)
    if (!mounted.current) return false
    if (exists) {
      setDuplicateModal({ fileName: baseName })
      return false
    }

    const stat = await api.file.readStat(filePath)
    if (!mounted.current) return false
    await api.items.add({
      filePath: dir,
      fileName,
      fileExtension,
      fileModifiedAt: stat?.mtime,
    })
    return true
  }, [])

  const addFiles = useCallback(async (paths: string[]) => {
    let added = false
    try {
      for (const path of paths) {
        if (!mounted.current) break
        added = await addFile(path) || added
      }
    } finally {
      if (added && mounted.current) await loadItems()
    }
  }, [addFile, loadItems])

  const beginFileAdd = useCallback(async (paths: string[]) => {
    if (!mounted.current) return
    if (!paths.length) {
      setFileUploadNotice(tr('modal.fileUpload.noFilesAdded'))
      return
    }

    setFileUploadNotice('')
    await addFiles(paths)
    setFileUploadDragging(false)
    setFileUploadNotice('')
    setFileUploadModalOpen(false)
  }, [addFiles, tr])

  const openFileUploadModal = useCallback(() => {
    setFileUploadNotice('')
    setFileUploadDragging(false)
    setFileUploadModalOpen(true)
  }, [])

  const closeFileUploadModal = useCallback(() => {
    setFileUploadModalOpen(false)
    setFileUploadDragging(false)
    setFileUploadNotice('')
  }, [])

  const handleBrowseFiles = useCallback(async () => {
    const paths = await api.file.openDialog()
    await beginFileAdd(paths)
  }, [beginFileAdd])

  const handleRootDrop = useCallback(async (event: React.DragEvent, blocked: boolean) => {
    event.preventDefault()
    if (blocked) return

    const paths = getDroppedFilePaths(Array.from(event.dataTransfer.files))
    await addFiles(paths)
  }, [addFiles])

  const handleFileUploadDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setFileUploadDragging(false)

    const hasFiles = Array.from(event.dataTransfer.types || []).includes('Files')
    if (!hasFiles) {
      setFileUploadNotice(tr('modal.fileUpload.invalidSelection'))
      return
    }

    const paths = getDroppedFilePaths(Array.from(event.dataTransfer.files))
    if (!paths.length) {
      setFileUploadNotice(tr('modal.fileUpload.dropBlocked'))
      return
    }

    await beginFileAdd(paths)
  }, [beginFileAdd, tr])

  const handleFileUploadDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setFileUploadDragging(true)
  }, [])

  const handleFileUploadDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setFileUploadDragging(false)
  }, [])

  return {
    duplicateModal,
    fileUploadModalOpen,
    fileUploadDragging,
    fileUploadNotice,
    setDuplicateModal,
    openFileUploadModal,
    closeFileUploadModal,
    handleBrowseFiles,
    handleRootDrop,
    handleFileUploadDrop,
    handleFileUploadDragOver,
    handleFileUploadDragLeave,
  }
}
