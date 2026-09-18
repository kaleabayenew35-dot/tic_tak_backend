import { query } from '../config/db.js'

export const AiConfigModel = {
  async get() {
    const { rows } = await query('SELECT id, ai_enabled FROM ai_config WHERE id = 1')
    return rows[0] || null
  },
  async update(enabled) {
    await query('UPDATE ai_config SET ai_enabled = $1 WHERE id = 1', [enabled ? 1 : 0])
    return this.get()
  },
}
