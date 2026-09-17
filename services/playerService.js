import { PlayerModel } from '../models/playerModel.js'

export const PlayerService = {
  getPlayers() {
    return PlayerModel.findAll()
  },

  getPlayersByBet(amount) {
    return PlayerModel.findByBetAmount(amount)
  },

  createPlayer(payload = {}) {
    const { is_demo: _ignoredIsDemo, ...sanitizedPayload } = payload

    if (!sanitizedPayload.username) {
      throw new Error('Username is required')
    }

    return PlayerModel.create(sanitizedPayload)
  },

  savePlayerBet(payload) {
    if (!payload.username) {
      throw new Error('Username is required')
    }

    // Normalize the bet amount: only positive finite numbers count.
    // 0, null, undefined, NaN, and strings that don't parse all become null.
    const rawBet = payload.selectedBetAmount ?? payload.betAmount ?? payload.wagerAmount ?? null
    const coercedBet = rawBet == null ? null : Number(rawBet)
    const selectedBetAmount = (Number.isFinite(coercedBet) && coercedBet > 0) ? coercedBet : null
    const hasExplicitBalance = Object.prototype.hasOwnProperty.call(payload, 'balance')

    return PlayerModel.upsertByUsername({
      username: payload.username,
      balance: payload.balance,
      status: payload.status || 'online',
      selectedBetAmount,
      updateBalance: hasExplicitBalance,
    })
  },

  cancelPlayerBet(username) {
    if (!username) {
      throw new Error('Username is required')
    }
    return PlayerModel.clearBet(username)
  },

  // Register a player as online (called on app load / auth success).
  // Creates the row if it doesn't exist, otherwise updates status + balance.
  playerGoOnline({ username, balance }) {
    if (!username) throw new Error('Username is required')
    return PlayerModel.goOnline({ username, balance })
  },

  // Mark a player offline and clear their bet (called on tab/window close).
  playerGoOffline(username) {
    if (!username) throw new Error('Username is required')
    return PlayerModel.goOffline(username)
  },
}
