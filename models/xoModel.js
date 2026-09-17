import db from '../config/db.js'
import { TransactionModel } from './transactionModel.js'

function normalizeUsername(username) {
  return String(username || '').trim().replace(/^@/, '').toLowerCase()
}

export const XoModel = {
  findPlayerByUsername(username) {
    const normalized = normalizeUsername(username)
    if (!normalized) return null
    return db.prepare(`SELECT * FROM players WHERE lower(replace(trim(username), '@', '')) = ?`).get(normalized)
  },

  createPlayer({ username, phone = null, balance = 0 }) {
    const normalized = normalizeUsername(username)
    const info = db.prepare('INSERT INTO players (username, balance) VALUES (?, ?)').run(normalized, Number(balance || 0))
    return db.prepare('SELECT * FROM players WHERE id = ?').get(info.lastInsertRowid)
  },

  ensurePlayer({ username, phone = null, balance = 0 }) {
    const existing = this.findPlayerByUsername(username)
    if (existing) return existing
    return this.createPlayer({ username, phone, balance })
  },

  adjustPlayerBalance(username, delta) {
    const player = this.findPlayerByUsername(username)
    if (!player) throw new Error('Player not found')
    const next = Number(player.balance || 0) + Number(delta || 0)
    if (next < 0) throw new Error('Insufficient balance')
    db.prepare('UPDATE players SET balance = ? WHERE id = ?').run(next, player.id)
    return db.prepare('SELECT * FROM players WHERE id = ?').get(player.id)
  },

  findToken(token) {
    if (!token) return null
    return db.prepare('SELECT * FROM tokens WHERE token = ?').get(String(token))
  },

  getAllTokensWithOwners() {
    return db.prepare(`
      SELECT t.id as token_id, t.token, t.owner_id, p.username as owner_username, p.balance as owner_balance, t.backend_url
      FROM tokens t
      LEFT JOIN players p ON p.id = t.owner_id
      ORDER BY t.created_at DESC
    `).all()
  },

  getOwnerForToken(token) {
    const rec = this.findToken(token)
    if (!rec) return null
    if (!rec.owner_id) return null
    return db.prepare('SELECT * FROM players WHERE id = ?').get(rec.owner_id)
  },

  addToOwnerBalance(token, amount) {
    const owner = this.getOwnerForToken(token)
    if (!owner) throw new Error('Token owner not found')
    const next = Number(owner.balance || 0) + Number(amount || 0)
    db.prepare('UPDATE players SET balance = ? WHERE id = ?').run(next, owner.id)
    // record transaction for owner
    try {
      TransactionModel.create({ owner_id: owner.id, owner_username: owner.username, amount, type: 'owner_fee', reference: token })
    } catch (err) {
      console.error('[XoModel.addToOwnerBalance] failed to record transaction', err.message)
    }
    return db.prepare('SELECT * FROM players WHERE id = ?').get(owner.id)
  }
}
