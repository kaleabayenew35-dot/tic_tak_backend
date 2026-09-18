import { query } from '../config/db.js'

export const BotsModel = {
  async list() { const { rows } = await query('SELECT id, name, difficulty, active, created_at FROM bots ORDER BY id ASC'); return rows },
  async findById(id) { const { rows } = await query('SELECT id, name, difficulty, active, created_at FROM bots WHERE id = $1', [id]); return rows[0] || null },
  async create({ name, difficulty = 50, active = 1 }) { const { rows } = await query('INSERT INTO bots (name, difficulty, active) VALUES ($1, $2, $3) RETURNING *', [name, Number(difficulty || 50), active ? 1 : 0]); return rows[0] },
  async update(id, { difficulty, active, name } = {}) { const current = await this.findById(id); if (!current) return null; const nextDifficulty = typeof difficulty === 'number' ? Math.max(0, Math.min(100, difficulty)) : current.difficulty; const nextActive = active === undefined ? current.active : (active ? 1 : 0); await query('UPDATE bots SET name = $1, difficulty = $2, active = $3 WHERE id = $4', [name || current.name, nextDifficulty, nextActive, id]); return this.findById(id) },
  async setAllDifficulty(value) { await query('UPDATE bots SET difficulty = $1', [Math.max(0, Math.min(100, Number(value || 50)))]); return this.list() },
  async count() { const { rows } = await query('SELECT count(1)::INTEGER AS c FROM bots'); return rows[0].c },
  async seedDefaultIfNeeded(target = 15) { const count = await this.count(); for (let i = count + 1; i <= target; i++) await this.create({ name: `bot_${String(i).padStart(2, '0')}`, difficulty: Math.floor(Math.random() * 81) + 10 }); return this.list() },
}
