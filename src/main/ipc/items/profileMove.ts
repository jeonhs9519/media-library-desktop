import { ipcMain } from 'electron'
import { and, asc, eq, gt } from 'drizzle-orm'
import { GUEST_PROFILE_ID, UNASSIGNED_PROFILE_ID, itemTags, items, playlistItems, profiles, reviews, tags } from '../../db/schema'
import { cleanupUnusedTags } from '../../services/tagMaintenance'
import { getActiveProfileId } from '../../services/profileState'
import type { DB } from './utils'

function getVisibleProfiles(db: DB) {
  return db.select({
    id: profiles.id,
    name: profiles.name,
  })
    .from(profiles)
    .where(gt(profiles.id, UNASSIGNED_PROFILE_ID))
    .orderBy(asc(profiles.id))
    .all()
}

function getActiveItem(db: DB, itemId: number) {
  return db.select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.profileId, getActiveProfileId())))
    .get()
}

function findDuplicateInProfile(db: DB, item: typeof items.$inferSelect, targetProfileId: number) {
  return db.select({ id: items.id })
    .from(items)
    .where(and(
      eq(items.profileId, targetProfileId),
      eq(items.filePath, item.filePath),
      eq(items.fileName, item.fileName),
      eq(items.fileExtension, item.fileExtension),
    ))
    .get()
}

export function registerItemProfileMoveIPC(db: DB) {
  ipcMain.handle('items:getMoveTargets', async (_event, { itemId }: { itemId: number }) => {
    const item = getActiveItem(db, itemId)
    if (!item) return { ok: false, reason: 'missing-item', targets: [] }

    const activeProfileId = getActiveProfileId()
    const targets = getVisibleProfiles(db).map((profile) => {
      const duplicate = findDuplicateInProfile(db, item, profile.id)
      const isCurrent = profile.id === activeProfileId

      return {
        id: profile.id,
        name: profile.name,
        disabled: isCurrent || Boolean(duplicate),
        reason: isCurrent ? 'current-profile' : duplicate ? 'duplicate-file' : null,
      }
    })

    return { ok: true, targets }
  })

  ipcMain.handle('items:moveToProfile', async (_event, { itemId, targetProfileId }: { itemId: number; targetProfileId: number }) => {
    const item = getActiveItem(db, itemId)
    if (!item) return { ok: false, reason: 'missing-item' }

    const targetProfile = db.select()
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .get()

    if (!targetProfile || targetProfile.id < GUEST_PROFILE_ID) {
      return { ok: false, reason: 'missing-profile' }
    }

    if (targetProfile.id === getActiveProfileId()) {
      return { ok: false, reason: 'current-profile' }
    }

    if (findDuplicateInProfile(db, item, targetProfile.id)) {
      return { ok: false, reason: 'duplicate-file' }
    }

    const now = Date.now()

    db.transaction((tx) => {
      const sourceTagRows = tx.select({ name: tags.name })
        .from(itemTags)
        .innerJoin(tags, eq(itemTags.tagId, tags.id))
        .where(eq(itemTags.itemId, item.id))
        .all()

      tx.delete(playlistItems)
        .where(eq(playlistItems.itemId, item.id))
        .run()

      tx.delete(itemTags)
        .where(eq(itemTags.itemId, item.id))
        .run()

      tx.update(items)
        .set({ profileId: targetProfile.id, updatedAt: now })
        .where(and(eq(items.id, item.id), eq(items.profileId, getActiveProfileId())))
        .run()

      const uniqueTagNames = Array.from(new Set(sourceTagRows.map((row) => row.name)))

      for (const tagName of uniqueTagNames) {
        let targetTag = tx.select()
          .from(tags)
          .where(and(eq(tags.profileId, targetProfile.id), eq(tags.name, tagName)))
          .get()

        if (!targetTag) {
          targetTag = tx.insert(tags)
            .values({ profileId: targetProfile.id, name: tagName })
            .returning()
            .get()
        }

        tx.insert(itemTags)
          .values({ itemId: item.id, tagId: targetTag.id })
          .onConflictDoNothing()
          .run()
      }
    })

    const cleanup = cleanupUnusedTags(db)
    return { ok: true, targetProfile, cleanup }
  })

  ipcMain.handle('items:copyToProfile', async (_event, { itemId, targetProfileId }: { itemId: number; targetProfileId: number }) => {
    const item = getActiveItem(db, itemId)
    if (!item) return { ok: false, reason: 'missing-item' }

    const targetProfile = db.select()
      .from(profiles)
      .where(eq(profiles.id, targetProfileId))
      .get()

    if (!targetProfile || targetProfile.id < GUEST_PROFILE_ID) {
      return { ok: false, reason: 'missing-profile' }
    }

    if (findDuplicateInProfile(db, item, targetProfile.id)) {
      return { ok: false, reason: 'duplicate-file' }
    }

    const now = Date.now()
    let copiedItemId: number | null = null

    db.transaction((tx) => {
      const sourceTagRows = tx.select({ name: tags.name })
        .from(itemTags)
        .innerJoin(tags, eq(itemTags.tagId, tags.id))
        .where(eq(itemTags.itemId, item.id))
        .all()

      const copiedItem = tx.insert(items)
        .values({
          profileId: targetProfile.id,
          filePath: item.filePath,
          fileName: item.fileName,
          fileExtension: item.fileExtension,
          title: item.title,
          sourceUrl: item.sourceUrl,
          author: item.author,
          memo: item.memo,
          contentType: item.contentType,
          containerType: item.containerType,
          language: item.language,
          watched: item.watched,
          progress: item.progress,
          lastPageIndex: item.lastPageIndex,
          lastPositionSeconds: item.lastPositionSeconds,
          totalContent: item.totalContent,
          thumbnail: item.thumbnail,
          createdAt: now,
          updatedAt: now,
          fileModifiedAt: item.fileModifiedAt,
        })
        .returning()
        .get()

      copiedItemId = copiedItem.id

      const uniqueTagNames = Array.from(new Set(sourceTagRows.map((row) => row.name)))

      for (const tagName of uniqueTagNames) {
        let targetTag = tx.select()
          .from(tags)
          .where(and(eq(tags.profileId, targetProfile.id), eq(tags.name, tagName)))
          .get()

        if (!targetTag) {
          targetTag = tx.insert(tags)
            .values({ profileId: targetProfile.id, name: tagName })
            .returning()
            .get()
        }

        tx.insert(itemTags)
          .values({ itemId: copiedItem.id, tagId: targetTag.id })
          .onConflictDoNothing()
          .run()
      }

      const sourceReview = tx.select()
        .from(reviews)
        .where(eq(reviews.itemId, item.id))
        .get()

      if (sourceReview) {
        tx.insert(reviews)
          .values({
            itemId: copiedItem.id,
            rating: sourceReview.rating,
            comment: sourceReview.comment,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }
    })

    return { ok: true, targetProfile, itemId: copiedItemId }
  })
}
