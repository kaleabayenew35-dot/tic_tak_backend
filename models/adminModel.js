import crypto from 'crypto'
import db from '../config/db.js'

export const AdminModel = {
  initializeTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )
    `)
  },

  findByUsername(username) {
    return db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').get(username)
  },

  create({ username, password_hash }) {
    const stmt = db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
    const info = stmt.run(username, password_hash)
    return db.prepare('SELECT id, username FROM admin_users WHERE id = ?').get(info.lastInsertRowid)
  },

  seedDefaultAdmin() {
    const username = 'kaleab'
    const password = 'Kale@1513'
    const existing = this.findByUsername(username)
    if (existing) return existing

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
    return this.create({ username, password_hash: passwordHash })
  },
}
