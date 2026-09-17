import { PlayerService } from '../services/playerService.js'

export const PlayerController = {
  async getPlayers(req, res) {
    try {
      const betAmount = req.query.bet
      const players = betAmount ? PlayerService.getPlayersByBet(betAmount) : PlayerService.getPlayers()
      res.json(players)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async createPlayer(req, res) {
    try {
      const player = PlayerService.createPlayer(req.body)
      res.status(201).json(player)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async savePlayerBet(req, res) {
    try {
      const player = PlayerService.savePlayerBet(req.body)
      res.json(player)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async cancelPlayerBet(req, res) {
    try {
      const player = PlayerService.cancelPlayerBet(req.body?.username || req.query?.username)
      res.json(player)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  // POST /api/players/online  — called on app load to register the player
  async goOnline(req, res) {
    try {
      const player = PlayerService.playerGoOnline(req.body)
      res.json(player)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  // POST /api/players/offline  — called on beforeunload to mark player offline
  async goOffline(req, res) {
    try {
      PlayerService.playerGoOffline(req.body?.username || req.query?.username)
      res.json({ ok: true })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },
}

