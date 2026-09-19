import { XoModel } from '../models/xoModel.js'
import { TransactionModel } from '../models/transactionModel.js'
import { OwnerCallbackService } from '../services/ownerCallback.js'

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

export const XoService = {
  async getPlayerBalance({ username }) {
    const player = await XoModel.ensurePlayer({ username })
    return { ok: true, data: { balance: Number(player.balance || 0) } }
  },

  async gameAction({ action, username, amount = 0, fee = 0, playerId = null, gameId = null, token = null }) {
    amount = Number(amount || 0)
    fee = Number(fee || 0)
    if (!username) throw new Error('username is required')

    switch (action) {
      case 'deduct': {
        // Deduct amount from player; caller must have ensured player exists
        const player = await XoModel.ensurePlayer({ username })
        const updated = await XoModel.adjustPlayerBalance(username, -amount)
        try {
          await TransactionModel.create({ owner_id: updated.id, owner_username: updated.username, amount: -amount, type: 'deduct', reference: gameId || token || null })
        } catch (err) {
          console.error('[XoService.gameAction] failed to record transaction', err.message)
        }
        return { ok: true, data: { balance: Number(updated.balance || 0) } }
      }
      case 'credit': {
        const player = await XoModel.ensurePlayer({ username })
        const updated = await XoModel.adjustPlayerBalance(username, amount)
        try {
          await TransactionModel.create({ owner_id: updated.id, owner_username: updated.username, amount: amount, type: 'credit', reference: gameId || token || null })
        } catch (err) {
          console.error('[XoService.gameAction] failed to record transaction', err.message)
        }
        return { ok: true, data: { balance: Number(updated.balance || 0) } }
      }
      case 'loss': {
        // Record a loss event (no balance change if already deducted)
        const player = await XoModel.findPlayerByUsername(username) || await XoModel.ensurePlayer({ username })
        try {
          await TransactionModel.create({ owner_id: player.id, owner_username: player.username, amount: 0, type: 'loss', reference: gameId || token || null })
        } catch (err) {
          console.error('[XoService.gameAction] failed to record loss transaction', err.message)
        }
        return { ok: true, data: { balance: Number((player && player.balance) || 0) } }
      }
      case 'refund': {
        const player = await XoModel.ensurePlayer({ username })
        const updated = await XoModel.adjustPlayerBalance(username, amount)
        try {
          await TransactionModel.create({ owner_id: updated.id, owner_username: updated.username, amount: amount, type: 'refund', reference: gameId || token || null })
        } catch (err) {
          console.error('[XoService.gameAction] failed to record refund transaction', err.message)
        }
        return { ok: true, data: { balance: Number(updated.balance || 0) } }
      }
      default:
        throw new Error('Unsupported action')
    }
  },

  // Settle a finished match: distribute pot and owner fee
  async settleMatch(match, token = null, tokenId = null) {
    try {
      const wager = Number(match.wager_amount || 0)
      const pot = wager * 2
      const ownerFee = Math.round((pot * 0.10) * 100) / 100 // 10%

      if (match.result === 'draw') {
        // Each player gets back their bet minus 5% owner fee each
        const eachFee = Math.round((wager * 0.05) * 100) / 100
        const refundAmount = Math.round((wager - eachFee) * 100) / 100
        const updatedX = await XoModel.adjustPlayerBalance(match.player_x_username, refundAmount)
        const updatedO = await XoModel.adjustPlayerBalance(match.player_o_username, refundAmount)
        try {
          await TransactionModel.create({ owner_id: updatedX.id, owner_username: updatedX.username, amount: refundAmount, type: 'draw_refund', reference: match.id })
          await TransactionModel.create({ owner_id: updatedO.id, owner_username: updatedO.username, amount: refundAmount, type: 'draw_refund', reference: match.id })
        } catch (err) {
          console.error('[XoService.settleMatch] failed to record refund transactions', err.message)
        }
        await OwnerCallbackService.notifySystemDrawRefund({
          player1Username: match.player_x_username,
          player2Username: match.player_o_username,
          refund: refundAmount,
          gameId: match.id,
        })
        await OwnerCallbackService.notifySystemOwnerFee({
          amount: eachFee * 2,
          type: 'pvp_draw_fee',
          gameId: match.id,
        })
        if (token) {
          try {
            await OwnerCallbackService.notifyDrawRefund(tokenId, {
              player1Id: updatedX.id,
              player2Id: updatedO.id,
              refund: refundAmount,
              fee: ownerFee,
              gameId: match.id,
            })
            await OwnerCallbackService.notifyOwnerFee(tokenId, {
              amount: ownerFee,
              type: 'draw_fee',
              gameId: match.id,
              humanPlayerId: null,
            })
          } catch (err) {
            console.error('[XoService.settleMatch] failed to dispatch draw callbacks', err.message)
          }
        }
        if (token) await XoModel.addToOwnerBalance(token, ownerFee)
        return { ok: true }
      }

      // winner exists
      const winner = match.winner_username
      if (!winner) return { ok: false, error: 'No winner to credit' }

      const winnerAmount = Math.round((pot - ownerFee) * 100) / 100
      const updatedWinner = await XoModel.adjustPlayerBalance(winner, winnerAmount)
      try {
        await TransactionModel.create({ owner_id: updatedWinner.id, owner_username: updatedWinner.username, amount: winnerAmount, type: 'win_credit', reference: match.id })
      } catch (err) {
        console.error('[XoService.settleMatch] failed to record win transaction', err.message)
      }
      const loser = normalizeUsername(match.player_x_username) === normalizeUsername(winner)
        ? match.player_o_username
        : match.player_x_username
      await OwnerCallbackService.notifySystemWinPayout({
        winnerUsername: winner,
        loserUsername: loser,
        winnerPayout: winnerAmount,
        gameId: match.id,
      })
      await OwnerCallbackService.notifySystemOwnerFee({
        amount: ownerFee,
        type: 'pvp_win_fee',
        gameId: match.id,
      })
      if (token) await XoModel.addToOwnerBalance(token, ownerFee)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }
}
