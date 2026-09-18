import crypto from 'crypto'
import { query } from '../config/db.js'

export const AdminModel = {
  async initializeTable() { return query(`CREATE TABLE IF NOT EXISTS admin_users (id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT)`) },
  async findByUsername(username) { const { rows } = await query('SELECT id, username, password_hash FROM admin_users WHERE username = $1', [username]); return rows[0] || null },
  async create({ username, password_hash }) { const { rows } = await query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username', [username, password_hash]); return rows[0] },
  async seedDefaultAdmin() { const username = 'kaleab'; const existing = await this.findByUsername(username); if (existing) return existing; return this.create({ username, password_hash: crypto.createHash('sha256').update('Kale@1513').digest('hex') }) },
}
