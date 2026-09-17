import { BotsModel } from '../models/botsModel.js'

export const BotsController = {
  list(req, res) {
    try {
      const bots = BotsModel.seedDefaultIfNeeded(15)
      res.json({ ok: true, data: bots })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  get(req, res) {
    try {
      const bot = BotsModel.findById(Number(req.params.id))
      if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' })
      res.json({ ok: true, data: bot })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  create(req, res) {
    try {
      const { name, difficulty = 50, active = 1 } = req.body || {}
      if (!name) return res.status(400).json({ ok: false, error: 'name is required' })
      const bot = BotsModel.create({ name, difficulty, active })
      res.json({ ok: true, data: bot })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  update(req, res) {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ ok: false, error: 'id is required' })
      const { difficulty, active, name } = req.body || {}
      const bot = BotsModel.update(id, { difficulty, active, name })
      if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' })
      res.json({ ok: true, data: bot })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  setAll(req, res) {
    try {
      const { difficulty } = req.body || {}
      if (typeof difficulty === 'undefined') return res.status(400).json({ ok: false, error: 'difficulty is required' })
      const bots = BotsModel.setAllDifficulty(Number(difficulty))
      res.json({ ok: true, data: bots })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  }
}
