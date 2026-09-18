import { BotsModel } from '../models/botsModel.js'

export const BotsController = {
  async list(req, res) {
    try {
      const bots = await BotsModel.seedDefaultIfNeeded(15)
      res.json({ ok: true, data: bots })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  async get(req, res) {
    try {
      const bot = await BotsModel.findById(Number(req.params.id))
      if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' })
      res.json({ ok: true, data: bot })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  async create(req, res) {
    try {
      const { name, difficulty = 50, active = 1 } = req.body || {}
      if (!name) return res.status(400).json({ ok: false, error: 'name is required' })
      const bot = await BotsModel.create({ name, difficulty, active })
      res.json({ ok: true, data: bot })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ ok: false, error: 'id is required' })
      const { difficulty, active, name } = req.body || {}
      const bot = await BotsModel.update(id, { difficulty, active, name })
      if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' })
      res.json({ ok: true, data: bot })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  async setAll(req, res) {
    try {
      const { difficulty } = req.body || {}
      if (typeof difficulty === 'undefined') return res.status(400).json({ ok: false, error: 'difficulty is required' })
      const bots = await BotsModel.setAllDifficulty(Number(difficulty))
      res.json({ ok: true, data: bots })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  }
}
