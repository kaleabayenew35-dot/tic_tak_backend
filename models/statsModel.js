import db from '../config/db.js'

function normalizeUsername(username) {
  return String(username || '').trim().replace(/^@/, '').toLowerCase()
}

export const StatsModel = {
  findByUsername(username) {
    const normalized = normalizeUsername(username)
    if (!normalized) return null
    return db.prepare('SELECT * FROM stats WHERE lower(replace(trim(username), "@", "")) = ?').get(normalized)
  },

  create({ username }) {
    const normalized = normalizeUsername(username)
    const info = db.prepare('INSERT INTO stats (username) VALUES (?)').run(normalized)
    return db.prepare('SELECT * FROM stats WHERE id = ?').get(info.lastInsertRowid)
  },

  ensure(username) {
    const existing = this.findByUsername(username)
    if (existing) return existing
    return this.create({ username })
  },

  incrementWin(username) {
    const rec = this.ensure(username)
    db.prepare('UPDATE stats SET wins = wins + 1 WHERE id = ?').run(rec.id)
    return db.prepare('SELECT * FROM stats WHERE id = ?').get(rec.id)
  },

  incrementDraw(username) {
    const rec = this.ensure(username)
    db.prepare('UPDATE stats SET draws = draws + 1 WHERE id = ?').run(rec.id)
    return db.prepare('SELECT * FROM stats WHERE id = ?').get(rec.id)
  },

  incrementLoss(username) {
    const rec = this.ensure(username)
    db.prepare('UPDATE stats SET losses = losses + 1 WHERE id = ?').run(rec.id)
    return db.prepare('SELECT * FROM stats WHERE id = ?').get(rec.id)
  },

  getStats(username) {
    return this.ensure(username)
  }
}
