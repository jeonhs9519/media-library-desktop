import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

type TableInfoRow = {
  name: string
  pk?: number
}

type SqliteMasterRow = {
  sql?: string
}

type IndexInfoRow = {
  seqno: number
  name: string
}

const SYSTEM_SETTING_KEYS = new Set([
  'ui.language',
  'video.volume',
  'fileModifiedAt.updatePolicy',
  'profile.lastActiveId',
  'profile.lastActiveIds',
  'profile.useLastOnStartup',
])

function tableExists(sqlite: Database.Database, tableName: string) {
  const row = sqlite.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tableName) as TableInfoRow | undefined

  return Boolean(row)
}

function getTableColumns(sqlite: Database.Database, tableName: string) {
  if (!tableExists(sqlite, tableName)) return []
  return sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[]
}

function hasColumn(sqlite: Database.Database, tableName: string, columnName: string) {
  return getTableColumns(sqlite, tableName).some(column => column.name === columnName)
}

function getCreateSql(sqlite: Database.Database, tableName: string) {
  const row = sqlite.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tableName) as SqliteMasterRow | undefined

  return row?.sql || ''
}

function getIndexColumns(sqlite: Database.Database, indexName: string) {
  const safeIndexName = indexName.replace(/"/g, '""')
  const rows = sqlite.prepare(`PRAGMA index_info("${safeIndexName}")`).all() as IndexInfoRow[]
  return rows.sort((a, b) => a.seqno - b.seqno).map(row => row.name)
}

function indexColumnsMatch(sqlite: Database.Database, indexName: string, expectedColumns: string[]) {
  const columns = getIndexColumns(sqlite, indexName)
  return columns.length === expectedColumns.length
    && columns.every((column, index) => column === expectedColumns[index])
}

function isSettingsPrimaryKeyProfileScoped(sqlite: Database.Database) {
  const columns = getTableColumns(sqlite, 'settings')
  const profileColumn = columns.find(column => column.name === 'profileId')
  const keyColumn = columns.find(column => column.name === 'key')
  return profileColumn?.pk === 1 && keyColumn?.pk === 2
}

function swapProfileReferenceIds(sqlite: Database.Database, tableName: string) {
  if (!hasColumn(sqlite, tableName, 'profileId')) return

  sqlite.prepare(`UPDATE ${tableName} SET profileId = -101 WHERE profileId = ?`).run(schema.SYSTEM_PROFILE_ID)
  sqlite.prepare(`UPDATE ${tableName} SET profileId = -102 WHERE profileId = ?`).run(schema.UNASSIGNED_PROFILE_ID)
  sqlite.prepare(`UPDATE ${tableName} SET profileId = ? WHERE profileId = -102`).run(schema.SYSTEM_PROFILE_ID)
  sqlite.prepare(`UPDATE ${tableName} SET profileId = ? WHERE profileId = -101`).run(schema.UNASSIGNED_PROFILE_ID)
}

function ensureProfileSeedRows(sqlite: Database.Database) {
  const now = Date.now()

  const unassigned = sqlite.prepare('SELECT id FROM profiles WHERE name = ?').get('UNASSIGNED') as { id: number } | undefined
  const system = sqlite.prepare('SELECT id FROM profiles WHERE name = ?').get('SYSTEM') as { id: number } | undefined
  if (unassigned?.id === schema.SYSTEM_PROFILE_ID && system?.id === schema.UNASSIGNED_PROFILE_ID) {
    sqlite.prepare('UPDATE profiles SET id = -101 WHERE id = ?').run(schema.SYSTEM_PROFILE_ID)
    sqlite.prepare('UPDATE profiles SET id = -102 WHERE id = ?').run(schema.UNASSIGNED_PROFILE_ID)
    swapProfileReferenceIds(sqlite, 'items')
    swapProfileReferenceIds(sqlite, 'tags')
    swapProfileReferenceIds(sqlite, 'playlists')
    swapProfileReferenceIds(sqlite, 'settings')
    sqlite.prepare('UPDATE profiles SET id = ? WHERE id = -102').run(schema.SYSTEM_PROFILE_ID)
    sqlite.prepare('UPDATE profiles SET id = ? WHERE id = -101').run(schema.UNASSIGNED_PROFILE_ID)
  }

  sqlite.prepare(`
    INSERT OR IGNORE INTO profiles (id, name, createdAt, updatedAt)
    VALUES (?, ?, ?, ?)
  `).run(schema.UNASSIGNED_PROFILE_ID, 'UNASSIGNED', now, now)

  sqlite.prepare(`
    UPDATE profiles
    SET name = ?, updatedAt = ?
    WHERE id = ? AND name = ?
  `).run('SYSTEM', now, schema.SYSTEM_PROFILE_ID, 'GUEST')

  sqlite.prepare(`
    INSERT OR IGNORE INTO profiles (id, name, createdAt, updatedAt)
    VALUES (?, ?, ?, ?)
  `).run(schema.SYSTEM_PROFILE_ID, 'SYSTEM', now, now)

  sqlite.prepare(`
    INSERT OR IGNORE INTO profiles (id, name, createdAt, updatedAt)
    VALUES (?, ?, ?, ?)
  `).run(schema.GUEST_PROFILE_ID, 'GUEST', now, now)
}

function ensureProfileColumn(sqlite: Database.Database, tableName: string) {
  if (!tableExists(sqlite, tableName) || hasColumn(sqlite, tableName, 'profileId')) return

  sqlite.exec(`
    ALTER TABLE ${tableName}
      ADD COLUMN profileId integer NOT NULL DEFAULT ${schema.UNASSIGNED_PROFILE_ID}
      REFERENCES profiles(id);
  `)
  console.log(`[main] Added missing ${tableName}.profileId column`)
}

function profileScopedTablesNeedRebuild(sqlite: Database.Database) {
  if (!tableExists(sqlite, 'items') || !tableExists(sqlite, 'tags') || !tableExists(sqlite, 'settings')) return false

  const itemsUniqueOk = indexColumnsMatch(sqlite, 'unique_file', [
    'profileId',
    'filePath',
    'fileName',
    'fileExtension',
  ])
  const tagsHasOldUniqueName = getIndexColumns(sqlite, 'tags_name_unique').length > 0
  const playlistsCreateSql = getCreateSql(sqlite, 'playlists')

  return !itemsUniqueOk
    || tagsHasOldUniqueName
    || !isSettingsPrimaryKeyProfileScoped(sqlite)
    || !hasColumn(sqlite, 'playlists', 'profileId')
    || /name\s+text\s+NOT\s+NULL\s+UNIQUE/i.test(playlistsCreateSql)
}

function rebuildProfileScopedTables(sqlite: Database.Database) {
  const systemKeys = Array.from(SYSTEM_SETTING_KEYS).map(key => `'${key.replace(/'/g, "''")}'`).join(', ')

  sqlite.exec(`
    CREATE TABLE items_new (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      profileId integer NOT NULL DEFAULT ${schema.UNASSIGNED_PROFILE_ID} REFERENCES profiles(id),
      filePath text NOT NULL,
      fileName text NOT NULL,
      fileExtension text NOT NULL,
      title text NOT NULL,
      sourceUrl text,
      author text,
      memo text,
      contentType text NOT NULL,
      containerType text NOT NULL,
      language text DEFAULT '' NOT NULL,
      watched integer DEFAULT 0 NOT NULL,
      progress real DEFAULT 0 NOT NULL,
      lastPageIndex integer,
      lastPositionSeconds real,
      totalContent real,
      thumbnail blob,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL,
      fileModifiedAt integer
    );

    CREATE TABLE tags_new (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      profileId integer NOT NULL DEFAULT ${schema.UNASSIGNED_PROFILE_ID} REFERENCES profiles(id),
      name text NOT NULL
    );

    CREATE TABLE itemTags_new (
      itemId integer NOT NULL REFERENCES items(id) ON DELETE cascade,
      tagId integer NOT NULL REFERENCES tags(id) ON DELETE cascade,
      PRIMARY KEY (itemId, tagId)
    );

    CREATE TABLE playlists_new (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      profileId integer NOT NULL DEFAULT ${schema.UNASSIGNED_PROFILE_ID} REFERENCES profiles(id),
      name text NOT NULL,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    );

    CREATE TABLE playlistItems_new (
      playlistId integer NOT NULL REFERENCES playlists(id) ON DELETE cascade,
      itemId integer NOT NULL REFERENCES items(id) ON DELETE cascade,
      position integer NOT NULL,
      createdAt integer NOT NULL,
      PRIMARY KEY (playlistId, itemId)
    );

    CREATE TABLE reviews_new (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      itemId integer NOT NULL UNIQUE REFERENCES items(id) ON DELETE cascade,
      rating integer NOT NULL,
      comment text,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    );

    CREATE TABLE settings_new (
      profileId integer NOT NULL DEFAULT ${schema.UNASSIGNED_PROFILE_ID} REFERENCES profiles(id),
      key text NOT NULL,
      value text NOT NULL,
      PRIMARY KEY (profileId, key)
    );

    INSERT INTO items_new (
      id, profileId, filePath, fileName, fileExtension, title, sourceUrl, author, memo,
      contentType, containerType, language, watched, progress, lastPageIndex,
      lastPositionSeconds, totalContent, thumbnail, createdAt, updatedAt, fileModifiedAt
    )
    SELECT
      id, profileId, filePath, fileName, fileExtension, title, sourceUrl, author, memo,
      contentType, containerType, language, watched, progress, lastPageIndex,
      lastPositionSeconds, totalContent, thumbnail, createdAt, updatedAt, fileModifiedAt
    FROM items;

    INSERT INTO tags_new (id, profileId, name)
    SELECT id, profileId, name
    FROM tags;

    INSERT INTO itemTags_new (itemId, tagId)
    SELECT itemId, tagId
    FROM itemTags;

    INSERT INTO playlists_new (id, profileId, name, createdAt, updatedAt)
    SELECT id, profileId, name, createdAt, updatedAt
    FROM playlists;

    INSERT INTO playlistItems_new (playlistId, itemId, position, createdAt)
    SELECT playlistId, itemId, position, createdAt
    FROM playlistItems;

    INSERT INTO reviews_new (id, itemId, rating, comment, createdAt, updatedAt)
    SELECT id, itemId, rating, comment, createdAt, updatedAt
    FROM reviews;

    INSERT OR REPLACE INTO settings_new (profileId, key, value)
    SELECT
      CASE
        WHEN key IN (${systemKeys}) THEN ${schema.SYSTEM_PROFILE_ID}
        ELSE profileId
      END,
      key,
      value
    FROM settings;

    DROP TABLE playlistItems;
    DROP TABLE itemTags;
    DROP TABLE reviews;
    DROP TABLE settings;
    DROP TABLE playlists;
    DROP TABLE tags;
    DROP TABLE items;

    ALTER TABLE items_new RENAME TO items;
    ALTER TABLE tags_new RENAME TO tags;
    ALTER TABLE itemTags_new RENAME TO itemTags;
    ALTER TABLE playlists_new RENAME TO playlists;
    ALTER TABLE playlistItems_new RENAME TO playlistItems;
    ALTER TABLE reviews_new RENAME TO reviews;
    ALTER TABLE settings_new RENAME TO settings;
  `)

  console.log('[main] Rebuilt profile-scoped tables')
}

export function createDatabase(dbPath: string) {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

export function runMigrations(db: ReturnType<typeof drizzle>, migrationsFolder: string) {
  migrate(db, { migrationsFolder })
}

export function ensureRuntimeSchema(sqlite: Database.Database) {
  if (!hasColumn(sqlite, 'items', 'totalContent')) {
    sqlite.exec('ALTER TABLE `items` ADD COLUMN `totalContent` real;')
    console.log('[main] Added missing items.totalContent column')
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL UNIQUE,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      profileId integer NOT NULL DEFAULT ${schema.UNASSIGNED_PROFILE_ID} REFERENCES profiles(id),
      name text NOT NULL,
      createdAt integer NOT NULL,
      updatedAt integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlistItems (
      playlistId integer NOT NULL,
      itemId integer NOT NULL,
      position integer NOT NULL,
      createdAt integer NOT NULL,
      PRIMARY KEY (playlistId, itemId),
      FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE cascade,
      FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE cascade
    );

    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_position
      ON playlistItems (playlistId, position);
  `)

  sqlite.pragma('foreign_keys = OFF')
  try {
    ensureProfileSeedRows(sqlite)
    ensureProfileColumn(sqlite, 'items')
    ensureProfileColumn(sqlite, 'tags')
    ensureProfileColumn(sqlite, 'playlists')
    ensureProfileColumn(sqlite, 'settings')
    if (profileScopedTablesNeedRebuild(sqlite)) {
      rebuildProfileScopedTables(sqlite)
    }
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_file
      ON items (profileId, filePath, fileName, fileExtension);
    CREATE INDEX IF NOT EXISTS idx_items_profile ON items (profileId);
    CREATE INDEX IF NOT EXISTS idx_content_type ON items (contentType);
    CREATE INDEX IF NOT EXISTS idx_language ON items (language);
    CREATE INDEX IF NOT EXISTS idx_watched ON items (watched);
    CREATE INDEX IF NOT EXISTS idx_created_at ON items (createdAt);
    CREATE INDEX IF NOT EXISTS idx_updated_at ON items (updatedAt);
    CREATE INDEX IF NOT EXISTS idx_file_modified_at ON items (fileModifiedAt);
    CREATE INDEX IF NOT EXISTS idx_title ON items (title);
    CREATE INDEX IF NOT EXISTS idx_tags_profile ON tags (profileId);
    CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_tag_name ON tags (profileId, name);
    CREATE INDEX IF NOT EXISTS idx_playlists_profile ON playlists (profileId);
    CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_playlist_name ON playlists (profileId, name);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_position
      ON playlistItems (playlistId, position);
  `)
}
