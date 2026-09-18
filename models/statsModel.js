import { query } from '../config/db.js'
function normalize(username) { return String(username || '').trim().replace(/^@/, '').toLowerCase() }
export const StatsModel = {
  async findByUsername(username) { const value = normalize(username); if (!value) return null; const { rows } = await query("SELECT * FROM stats WHERE lower(replace(trim(username), '@', '')) = $1", [value]); return rows[0] || null },
  async create({ username }) { const { rows } = await query('INSERT INTO stats (username) VALUES ($1) RETURNING *', [normalize(username)]); return rows[0] },
  async ensure(username) { return (await this.findByUsername(username)) || this.create({ username }) },
  async incrementWin(username) { const rec = await this.ensure(username); await query('UPDATE stats SET wins = wins + 1 WHERE id = $1', [rec.id]); return this.findByUsername(username) },
  async incrementDraw(username) { const rec = await this.ensure(username); await query('UPDATE stats SET draws = draws + 1 WHERE id = $1', [rec.id]); return this.findByUsername(username) },
  async incrementLoss(username) { const rec = await this.ensure(username); await query('UPDATE stats SET losses = losses + 1 WHERE id = $1', [rec.id]); return this.findByUsername(username) },
  async getStats(username) { return this.ensure(username) },
}
