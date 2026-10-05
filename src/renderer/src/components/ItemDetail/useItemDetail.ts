import { useState, useEffect } from 'react'
import { api } from '../../api'
import type { Item, Tag } from '../../types'
import type { Translate } from '../../i18n'
import type { ItemEditForm, UsedTag } from './types'
import { buildDisplayItemPath, isReservedTagName } from './formatters'

export function useItemDetail({
  itemId,
  onClose,
  tr,
}: {
  itemId: number
  onClose: () => void
  tr: Translate
}) {
  const [item, setItem] = useState<Item | null>(null)
  const [usedTags, setUsedTags] = useState<UsedTag[]>([])
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<ItemEditForm>({
    title: '',
    contentType: 'other',
    language: 'unspecified',
    author: '',
    memo: '',
    sourceUrl: '',
    watched: false,
  })
  const [reviewModal, setReviewModal] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' })
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [tagInputError, setTagInputError] = useState('')
  const [relinkModal, setRelinkModal] = useState(false)
  const [relinkDuplicate, setRelinkDuplicate] = useState<{
    targetPath: string
    duplicatePath: string
    duplicateTitle?: string
  } | null>(null)
  const [relinkErrorOpen, setRelinkErrorOpen] = useState(false)
  const [relinkErrorMessage, setRelinkErrorMessage] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  useEffect(() => {
    const load = async () => {
      const data = await api.items.getById(itemId)
      setItem(data)
      setEditForm({
        title: data?.title || '',
        contentType: data?.contentType || 'other',
        language: data?.language || 'unspecified',
        author: data?.author || '',
        memo: data?.memo || '',
        sourceUrl: data?.sourceUrl || '',
        watched: data?.watched === 1,
      })
      if (data?.review) {
        setReviewForm({ rating: data.review.rating, comment: data.review.comment || '' })
      }
      const thumb = await api.thumbnail.get(itemId)
      if (thumb) setThumbnail(`data:image/jpeg;base64,${thumb}`)
    }
    load()
    api.tags.getUsageCounts().then(setUsedTags)
  }, [itemId])

  const handleSave = async () => {
    const normalizedForm = {
      ...editForm,
      title: editForm.title.trim(),
      author: editForm.author.trim(),
      memo: editForm.memo.trim(),
      sourceUrl: editForm.sourceUrl.trim(),
    }
    await api.items.update(itemId, {
      ...normalizedForm,
      watched: editForm.watched ? 1 : 0,
    })
    setEditForm(normalizedForm)
    setEditing(false)
    const data = await api.items.getById(itemId)
    setItem(data)
  }

  const handleDelete = () => {
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteBusy(true)
    try {
      await api.items.delete(itemId)
      setDeleteConfirmOpen(false)
      onClose()
    } catch (error) {
      console.error('Failed to delete item:', error)
      setDeleteBusy(false)
    }
  }

  const handleRelink = async () => {
    try {
      const paths = await api.file.openDialog()
      if (paths.length > 0) {
        const result = await api.items.relink(itemId, paths[0])

        if (result?.ok === false && result?.reason === 'duplicate') {
          const dup = result.duplicate
          const duplicatePath = dup ? buildDisplayItemPath(dup) : ''

          setRelinkDuplicate({
            targetPath: result.targetPath || paths[0],
            duplicatePath,
            duplicateTitle: dup?.title,
          })
        } else if (result?.ok === false) {
          setRelinkErrorMessage(String(result?.message || ''))
          setRelinkErrorOpen(true)
        } else {
          const data = await api.items.getById(itemId)
          setItem(data)
        }
      }
    } catch (error: any) {
      setRelinkErrorMessage(String(error?.message || ''))
      setRelinkErrorOpen(true)
    } finally {
      setRelinkModal(false)
    }
  }

  const handleAddTag = async () => {
    const trimmed = newTagName.trim()
    await commitTagName(trimmed)
  }

  const commitTagName = async (trimmed: string) => {
    if (!trimmed) return
    if (isReservedTagName(trimmed, tr('filters.untagged'))) {
      setTagInputError(tr('detail.invalidTagNameShort'))
      window.setTimeout(() => setTagInputError(''), 2600)
      return
    }

    let tag: Tag | undefined = usedTags.find((t) => t.name === trimmed)

    if (!tag) {
      try {
        tag = await api.tags.create(trimmed)
      } catch {
        const refreshedTags = await api.tags.getAll()
        tag = refreshedTags.find((t: Tag) => t.name === trimmed)
      }
    }

    if (!tag) return

    await api.tags.assignToItem(itemId, tag.id)
    setNewTagName('')
    const data = await api.items.getById(itemId)
    setItem(data)
    const refreshedUsedTags = await api.tags.getUsageCounts()
    setUsedTags(refreshedUsedTags)
  }

  const handleRemoveTag = async (tagId: number) => {
    await api.tags.removeFromItem(itemId, tagId)
    const data = await api.items.getById(itemId)
    setItem(data)
    const refreshedUsedTags = await api.tags.getUsageCounts()
    setUsedTags(refreshedUsedTags)
  }

  const handleReviewSave = async () => {
    const comment = reviewForm.comment.trim()
    await api.reviews.upsert(itemId, reviewForm.rating, comment)
    setReviewForm((form) => ({ ...form, comment }))
    setReviewModal(false)
    const data = await api.items.getById(itemId)
    setItem(data)
  }

  return {
    item,
    editing,
    setEditing,
    editForm,
    setEditForm,
    thumbnail,
    usedTags,
    newTagName,
    setNewTagName,
    tagInputError,
    setTagInputError,
    reviewModal,
    setReviewModal,
    reviewForm,
    setReviewForm,
    relinkModal,
    setRelinkModal,
    relinkDuplicate,
    setRelinkDuplicate,
    relinkErrorOpen,
    setRelinkErrorOpen,
    relinkErrorMessage,
    setRelinkErrorMessage,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deleteBusy,
    handleSave,
    handleDelete,
    handleDeleteConfirm,
    handleRelink,
    handleAddTag,
    commitTagName,
    handleRemoveTag,
    handleReviewSave,
  }
}
