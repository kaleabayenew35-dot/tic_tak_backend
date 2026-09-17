import db from '../config/db.js'

export const TransactionModel = {
  create({ owner_id = null, owner_username = null, amount = 0, type = 'unknown', reference = null }) {
    const stmt = db.prepare('INSERT INTO transactions (owner_id, owner_username, amount, type, reference) VALUES (?, ?, ?, ?, ?)')
    const info = stmt.run(owner_id, owner_username, Number(amount || 0), type, reference)
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid)
  },

  list({ limit = 50, offset = 0 } = {}) {
    const stmt = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?')
    return stmt.all(Number(limit), Number(offset))
  },

  listByOwner(owner_id, { limit = 50, offset = 0 } = {}) {
    const stmt = db.prepare('SELECT * FROM transactions WHERE owner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    return stmt.all(owner_id, Number(limit), Number(offset))
  }
}
