import { query } from '../config/db.js'

export const TokenModel = {
  async findByToken(token) { const { rows } = await query('SELECT * FROM tokens WHERE token = $1', [token]); return rows[0] || null },
  async create({ token, owner_id = null, expires_at = null, status = 'active', backend_url = null, backend = null }) {
    const { rows } = await query(`INSERT INTO tokens (token, owner_id, backend_url, expires_at, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [token, owner_id, backend_url ?? backend, expires_at, status, Date.now()])
    return rows[0]
  },
  async activate(token) { return query('UPDATE tokens SET status = $1 WHERE token = $2', ['active', token]) },
  async update(id, updates) {
    const fields = []; const values = []
    for (const [key, column] of [['backend_url', 'backend_url'], ['backend', 'backend_url'], ['expires_at', 'expires_at'], ['status', 'status'], ['token', 'token']]) {
      if (updates[key] !== undefined && !(key === 'backend' && updates.backend_url !== undefined)) { values.push(updates[key]); fields.push(`${column} = $${values.length}`) }
    }
    if (!fields.length) return this.findById(id)
    values.push(id)
    await query(`UPDATE tokens SET ${fields.join(', ')} WHERE id = $${values.length}`, values)
    return this.findById(id)
  },
  async findById(id) { const { rows } = await query('SELECT * FROM tokens WHERE id = $1', [id]); return rows[0] || null },
  async delete(id) { const result = await query('DELETE FROM tokens WHERE id = $1', [id]); return { changes: result.rowCount } },
}
