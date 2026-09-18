import { GameModel } from '../models/gameModel.js'
import { OwnerCallbackService } from '../services/ownerCallback.js'

export const GameService = {
  async getGames() {
    return GameModel.findAll()
  },

  async createGame(payload) {
    const { player_x_id, player_o_id, result, token_id, bet_amount, game_id } = payload
    if (!player_x_id || !player_o_id || !result) {
      throw new Error('player_x_id, player_o_id, and result are required')
    }

    const game = await GameModel.create(payload)

    if (token_id && bet_amount) {
      try {
        await OwnerCallbackService.notifyBetPlaced(Number(token_id), {
          player1Id: Number(player_x_id),
          player2Id: Number(player_o_id),
          betAmount: Number(bet_amount),
          gameId: game.id || game_id || null,
        })
      } catch (err) {
        console.error('[GameService.createGame] failed to dispatch owner bet callbacks', err.message)
      }
    }

    return game
  },
}
