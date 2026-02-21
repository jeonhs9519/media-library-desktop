import { sqliteTable, text, integer, real, blob, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
  thumbnail: blob('thumbnail', { mode: 'buffer' }),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
  fileModifiedAt: integer('fileModifiedAt'),
}, (table) => ({
  uniqueFile: uniqueIndex('unique_file').on(table.filePath, table.fileName, table.fileExtension),
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
  name: text('name').notNull().unique(),
})

export const itemTags = sqliteTable('itemTags', {
  itemId: integer('itemId').notNull().references(() => items.id, { onDelete: 'cascade' }),
  tagId: integer('tagId').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
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
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
