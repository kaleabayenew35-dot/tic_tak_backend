import db from '../config/db.js'

export const AiConfigModel = {
  get() {
    db.prepare('INSERT OR IGNORE INTO ai_config (id, ai_enabled) VALUES (1, 1)').run()
    return db.prepare('SELECT id, ai_enabled FROM ai_config WHERE id = 1').get()
  },

  update(enabled) {
    db.prepare('INSERT OR IGNORE INTO ai_config (id, ai_enabled) VALUES (1, 1)').run()
    db.prepare('UPDATE ai_config SET ai_enabled = ? WHERE id = 1').run(enabled ? 1 : 0)
    return this.get()
  },
}