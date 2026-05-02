import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

type TableInfoRow = {
  name: string
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
  const itemColumns = sqlite.prepare('PRAGMA table_info(items)').all() as TableInfoRow[]

  if (!itemColumns.some(column => column.name === 'totalContent')) {
    sqlite.exec('ALTER TABLE `items` ADD COLUMN `totalContent` real;')
    console.log('[main] Added missing items.totalContent column')
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL UNIQUE,
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
}
