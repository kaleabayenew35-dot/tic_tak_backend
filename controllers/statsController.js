import { StatsModel } from '../models/statsModel.js'

export const StatsController = {
  async getPlayerStats(req, res) {
    try {
      const username = req.params.username || req.body.username || req.query.username
      if (!username) return res.status(400).json({ ok: false, error: 'username is required' })
      const stats = StatsModel.getStats(username)
      res.json({ ok: true, data: { username: stats.username, wins: stats.wins, draws: stats.draws, losses: stats.losses } })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },
}
