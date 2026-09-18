import { query } from '../config/db.js'

export const TransactionModel = {
  async create({ owner_id = null, owner_username = null, amount = 0, type = 'unknown', reference = null }) {
    const { rows } = await query(`INSERT INTO transactions (owner_id, owner_username, amount, type, reference, created_at)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [owner_id, owner_username, Number(amount || 0), type, reference, Date.now()])
    return rows[0]
  },
  async list({ limit = 50, offset = 0 } = {}) {
    const { rows } = await query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1 OFFSET $2', [Number(limit), Number(offset)])
    return rows
  },
  async listByOwner(owner_id, { limit = 50, offset = 0 } = {}) {
    const { rows } = await query('SELECT * FROM transactions WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [owner_id, Number(limit), Number(offset)])
    return rows
  },
}
