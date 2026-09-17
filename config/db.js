import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'xo.db')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(dbPath)

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

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER,
  owner_username TEXT,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  reference TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (owner_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  difficulty INTEGER NOT NULL DEFAULT 50,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS ai_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ai_enabled INTEGER NOT NULL DEFAULT 1
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

const playerColumns = db.prepare('PRAGMA table_info(players)').all()
const hasSelectedBetColumn = playerColumns.some((column) => column.name === 'selected_bet_amount')
if (!hasSelectedBetColumn) {
  db.exec('ALTER TABLE players ADD COLUMN selected_bet_amount REAL DEFAULT NULL')
}

const hasDemoColumn = playerColumns.some((column) => column.name === 'is_demo')
if (!hasDemoColumn) {
  // Mark placeholder/test players so they never appear in public online-player lists.
  db.exec('ALTER TABLE players ADD COLUMN is_demo INTEGER DEFAULT 0')
}

export default db
