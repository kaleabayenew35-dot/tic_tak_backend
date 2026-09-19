import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL?.trim()
if (process.env.NODE_ENV === 'production' && (!databaseUrl || databaseUrl.endsWith('.db'))) {
  throw new Error('DATABASE_URL must be a PostgreSQL connection string in production.')
}

const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://postgres:password@localhost:5432/xo',
  ssl: databaseUrl && !databaseUrl.includes('localhost') ? { rejectUnauthorized: false } : false,
  max: 15,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (error) => console.error('[db] PostgreSQL pool error:', error.message))

export function query(text, params = []) {
  let index = 0
  const sql = text.replace(/\?/g, () => `$${++index}`)
  return pool.query(sql, params)
}

const schema = [
  `CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, balance REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'online', selected_bet_amount REAL, is_demo INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS phone TEXT`,
  `CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY, player_x_id INTEGER NOT NULL, player_o_id INTEGER NOT NULL,
    result TEXT NOT NULL, moves TEXT, created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE, owner_id INTEGER, backend_url TEXT,
    backend TEXT, created_at BIGINT NOT NULL, expires_at BIGINT, status TEXT NOT NULL DEFAULT 'active'
  )`,
  `CREATE TABLE IF NOT EXISTS pending_owner_callbacks (
    id SERIAL PRIMARY KEY, token_id INTEGER, game_id TEXT, action TEXT NOT NULL,
    payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS stats (
    id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY, owner_id INTEGER, owner_username TEXT, amount REAL NOT NULL,
    type TEXT NOT NULL, reference TEXT, created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bots (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, difficulty INTEGER NOT NULL DEFAULT 50,
    active INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS ai_config (id INTEGER PRIMARY KEY CHECK (id = 1), ai_enabled INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS live_challenges (
    id SERIAL PRIMARY KEY, challenger_username TEXT NOT NULL, opponent_username TEXT NOT NULL,
    wager_amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT, accepted_at BIGINT, match_id INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS live_matches (
    id SERIAL PRIMARY KEY, challenge_id INTEGER NOT NULL UNIQUE, player_x_username TEXT NOT NULL,
    player_o_username TEXT NOT NULL, wager_amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
    result TEXT, winner_username TEXT, moves TEXT, created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    finished_at BIGINT
  )`,
]

export const databaseReady = (async () => {
  for (const statement of schema) await pool.query(statement)
  await query('INSERT INTO ai_config (id, ai_enabled) VALUES (1, 1) ON CONFLICT DO NOTHING')
  console.log('[db] PostgreSQL schema ready')
})().catch((error) => {
  console.error('[db] PostgreSQL initialization failed:', error)
  throw error
})

export async function closeDatabase() {
  await databaseReady
  await pool.end()
}

export default { query, databaseReady, closeDatabase }
