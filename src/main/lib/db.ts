import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'cassette-lab.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        path        TEXT NOT NULL UNIQUE,
        daw_type    TEXT NOT NULL DEFAULT '',
        size_bytes  INTEGER NOT NULL DEFAULT 0,
        last_modified TEXT NOT NULL,
        synced_at   TEXT,
        cloud_id    TEXT,
        tags        TEXT NOT NULL DEFAULT '[]',
        created_at  TEXT NOT NULL
      )
    `)
  }
  return db
}
