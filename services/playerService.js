import { PlayerModel } from '../models/playerModel.js'

export const PlayerService = {
  listPlayers() { return PlayerModel.findAll() },
  getPlayersByBet(amount) { return PlayerModel.findByBetAmount(amount) },
  createPlayer(payload) {
    const { is_demo: _ignored, ...safePayload } = payload
    if (!safePayload.username) throw new Error('Username is required')
    return PlayerModel.create(safePayload)
  },
  savePlayerBet(payload) {
    if (!payload.username) throw new Error('Username is required')
    const raw = payload.selectedBetAmount ?? payload.betAmount ?? payload.wagerAmount ?? null
    const value = raw == null ? null : Number(raw)
    const selectedBetAmount = Number.isFinite(value) && value > 0 ? value : null
    return PlayerModel.upsertByUsername({
      username: payload.username,
      balance: payload.balance,
      status: payload.status || 'online',
      selectedBetAmount,
      updateBalance: Object.prototype.hasOwnProperty.call(payload, 'balance'),
    })
  },
  cancelPlayerBet(username) {
    if (!username) throw new Error('Username is required')
    return PlayerModel.clearBet(username)
  },
  playerGoOnline({ username, balance }) {
    if (!username) throw new Error('Username is required')
    return PlayerModel.goOnline({ username, balance })
  },
  playerGoOffline(username) {
    if (!username) throw new Error('Username is required')
    return PlayerModel.goOffline(username)
  },
}
