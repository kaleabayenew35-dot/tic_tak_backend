import db from '../config/db.js'

export const BotsModel = {
  list() {
    return db.prepare('SELECT id, name, difficulty, active, created_at FROM bots ORDER BY id ASC').all()
  },

  findById(id) {
    return db.prepare('SELECT id, name, difficulty, active, created_at FROM bots WHERE id = ?').get(id)
  },

  create({ name, difficulty = 50, active = 1 }) {
    const stmt = db.prepare('INSERT INTO bots (name, difficulty, active) VALUES (?, ?, ?)')
    const info = stmt.run(name, Number(difficulty || 50), active ? 1 : 0)
    return this.findById(info.lastInsertRowid)
  },

  update(id, { difficulty, active, name } = {}) {
    const current = this.findById(id)
    if (!current) return null
    const nextDifficulty = typeof difficulty === 'number' ? Math.max(0, Math.min(100, Number(difficulty))) : current.difficulty
    const nextActive = typeof active !== 'undefined' ? (active ? 1 : 0) : current.active
    const nextName = name ? name : current.name
    db.prepare('UPDATE bots SET name = ?, difficulty = ?, active = ? WHERE id = ?').run(nextName, nextDifficulty, nextActive, id)
    return this.findById(id)
  },

  setAllDifficulty(value) {
    const v = Math.max(0, Math.min(100, Number(value || 50)))
    db.prepare('UPDATE bots SET difficulty = ?').run(v)
    return this.list()
  },

  count() {
    return db.prepare('SELECT count(1) as c FROM bots').get().c
  },

  seedDefaultIfNeeded(target = 15) {
    const c = this.count()
    if (c >= target) return this.list()
    const created = []
    for (let i = c + 1; i <= target; i++) {
      const name = `bot_${String(i).padStart(2,'0')}`
      const difficulty = Math.floor(Math.random() * 81) + 10 // 10..90
      created.push(this.create({ name, difficulty }))
    }
    return this.list()
  }
}
