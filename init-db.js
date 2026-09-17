import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, 'data')
const fs = await import('fs')
const { mkdirSync, existsSync } = fs

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const db = new Database(path.join(dataDir, 'xo.db'))

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'online',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_x_id INTEGER NOT NULL,
  player_o_id INTEGER NOT NULL,
  result TEXT NOT NULL,
  moves TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (player_x_id) REFERENCES players(id),
  FOREIGN KEY (player_o_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  owner_id INTEGER,
  backend_url TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (owner_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS pending_owner_callbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  game_id TEXT,
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
`)

const tokenColumns = db.prepare('PRAGMA table_info(tokens)').all()
const hasBackendUrlColumn = tokenColumns.some((column) => column.name === 'backend_url')
if (!hasBackendUrlColumn) {
  db.exec('ALTER TABLE tokens ADD COLUMN backend_url TEXT')
}

const hasBackendColumn = tokenColumns.some((column) => column.name === 'backend')
if (hasBackendColumn) {
  db.prepare('UPDATE tokens SET backend_url = backend WHERE backend_url IS NULL AND backend IS NOT NULL').run()
}

console.log('Database initialized at', path.join(dataDir, 'xo.db'))
