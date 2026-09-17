import db from '../config/db.js'

export const TokenModel = {
  findByToken(token) {
    return db.prepare('SELECT * FROM tokens WHERE token = ?').get(token)
  },

  create({ token, owner_id = null, expires_at = null, status = 'active', backend_url = null, backend = null }) {
    const resolvedBackendUrl = backend_url ?? backend
    const stmt = db.prepare('INSERT INTO tokens (token, owner_id, backend_url, expires_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    const info = stmt.run(token, owner_id, resolvedBackendUrl, expires_at, status, Date.now())
    return db.prepare('SELECT * FROM tokens WHERE id = ?').get(info.lastInsertRowid)
  },

  activate(token) {
    return db.prepare('UPDATE tokens SET status = ? WHERE token = ?').run('active', token)
  },

  update(id, updates) {
    const fields = []
    const values = []

    if (updates.backend_url !== undefined) {
      fields.push('backend_url = ?')
      values.push(updates.backend_url)
    }

    if (updates.backend !== undefined && updates.backend_url === undefined) {
      fields.push('backend_url = ?')
      values.push(updates.backend)
    }

    if (updates.expires_at !== undefined) {
      fields.push('expires_at = ?')
      values.push(updates.expires_at)
    }

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }

    if (updates.token !== undefined) {
      fields.push('token = ?')
      values.push(updates.token)
    }

    if (fields.length === 0) {
      return this.findById(id)
    }

    values.push(id)
    db.prepare(`UPDATE tokens SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.findById(id)
  },

  findById(id) {
    return db.prepare('SELECT * FROM tokens WHERE id = ?').get(id)
  },

  delete(id) {
    return db.prepare('DELETE FROM tokens WHERE id = ?').run(id)
  },
}
