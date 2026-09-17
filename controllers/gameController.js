import { GameService } from '../services/gameService.js'

export const GameController = {
  async getGames(req, res) {
    try {
      const games = GameService.getGames()
      res.json(games)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async createGame(req, res) {
    try {
      const game = GameService.createGame(req.body)
      res.status(201).json(game)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },
}
