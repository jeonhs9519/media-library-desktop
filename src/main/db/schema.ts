import { sqliteTable, text, integer, real, blob, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const SYSTEM_PROFILE_ID = 1
export const UNASSIGNED_PROFILE_ID = 2
export const GUEST_PROFILE_ID = 3

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
})

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profileId').notNull().default(UNASSIGNED_PROFILE_ID).references(() => profiles.id),
  filePath: text('filePath').notNull(),
  fileName: text('fileName').notNull(),
  fileExtension: text('fileExtension').notNull(),
  title: text('title').notNull(),
  sourceUrl: text('sourceUrl'),
  author: text('author'),
  memo: text('memo'),
  contentType: text('contentType').notNull(),
  containerType: text('containerType').notNull(),
  language: text('language').notNull().default(''),
  watched: integer('watched').notNull().default(0),
  progress: real('progress').notNull().default(0),
  lastPageIndex: integer('lastPageIndex'),
  lastPositionSeconds: real('lastPositionSeconds'),
  totalContent: real('totalContent'), // Pages for book/comic, seconds for video
  thumbnail: blob('thumbnail', { mode: 'buffer' }),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  fileModifiedAt: integer('fileModifiedAt'),
}, (table) => ({
  uniqueFile: uniqueIndex('unique_file').on(table.profileId, table.filePath, table.fileName, table.fileExtension),
  idxProfile: index('idx_items_profile').on(table.profileId),
  idxContentType: index('idx_content_type').on(table.contentType),
  idxLanguage: index('idx_language').on(table.language),
  idxWatched: index('idx_watched').on(table.watched),
  idxCreatedAt: index('idx_created_at').on(table.createdAt),
  idxUpdatedAt: index('idx_updated_at').on(table.updatedAt),
  idxFileModifiedAt: index('idx_file_modified_at').on(table.fileModifiedAt),
  idxTitle: index('idx_title').on(table.title),
}))

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profileId').notNull().default(UNASSIGNED_PROFILE_ID).references(() => profiles.id),
  name: text('name').notNull(),
}, (table) => ({
  uniqueProfileTagName: uniqueIndex('unique_profile_tag_name').on(table.profileId, table.name),
  idxProfile: index('idx_tags_profile').on(table.profileId),
}))

export const itemTags = sqliteTable('itemTags', {
  itemId: integer('itemId').notNull().references(() => items.id, { onDelete: 'cascade' }),
  tagId: integer('tagId').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}))

export const playlists = sqliteTable('playlists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profileId').notNull().default(UNASSIGNED_PROFILE_ID).references(() => profiles.id),
  name: text('name').notNull(),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
}, (table) => ({
  uniqueProfilePlaylistName: uniqueIndex('unique_profile_playlist_name').on(table.profileId, table.name),
  idxProfile: index('idx_playlists_profile').on(table.profileId),
}))

export const playlistItems = sqliteTable('playlistItems', {
  playlistId: integer('playlistId').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  itemId: integer('itemId').notNull().references(() => items.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  createdAt: integer('createdAt').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.playlistId, table.itemId] }),
  idxPlaylistPosition: index('idx_playlist_items_playlist_position').on(table.playlistId, table.position),
}))

export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('itemId').notNull().unique().references(() => items.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
})

export const settings = sqliteTable('settings', {
  profileId: integer('profileId').notNull().default(UNASSIGNED_PROFILE_ID).references(() => profiles.id),
  key: text('key').notNull(),
  value: text('value').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.profileId, table.key] }),
}))
