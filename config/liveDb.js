import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'live.db')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(dbPath)

db.exec(`
CREATE TABLE IF NOT EXISTS live_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger_username TEXT NOT NULL,
  opponent_username TEXT NOT NULL,
  wager_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  accepted_at INTEGER,
  match_id INTEGER
);

CREATE TABLE IF NOT EXISTS live_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL UNIQUE,
  player_x_username TEXT NOT NULL,
  player_o_username TEXT NOT NULL,
  wager_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  result TEXT,
  winner_username TEXT,
  moves TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  finished_at INTEGER
);
`)

const matchColumns = db.prepare('PRAGMA table_info(live_matches)').all()
const hasWinnerColumn = matchColumns.some((column) => column.name === 'winner_username')
if (!hasWinnerColumn) {
  db.exec('ALTER TABLE live_matches ADD COLUMN winner_username TEXT')
}

export default db
