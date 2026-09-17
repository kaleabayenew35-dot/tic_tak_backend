import { AiConfigModel } from '../models/aiConfigModel.js'

export const AiController = {
  getConfig(req, res) {
    res.json({ ok: true, data: AiConfigModel.get() })
  },

  updateConfig(req, res) {
    const { aiEnabled } = req.body
    if (typeof aiEnabled !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'aiEnabled must be a boolean' })
    }
    res.json({ ok: true, data: AiConfigModel.update(aiEnabled) })
  },
}