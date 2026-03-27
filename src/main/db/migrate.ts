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
}
