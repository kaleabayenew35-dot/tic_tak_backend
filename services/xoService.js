import { XoModel } from '../models/xoModel.js'
import { TransactionModel } from '../models/transactionModel.js'
import { OwnerCallbackService } from '../services/ownerCallback.js'

export const XoService = {
  getPlayerBalance({ username }) {
    const player = XoModel.ensurePlayer({ username })
    return { ok: true, data: { balance: Number(player.balance || 0) } }
  },

  async gameAction({ action, username, amount = 0, fee = 0, playerId = null, gameId = null, token = null }) {
    amount = Number(amount || 0)
    fee = Number(fee || 0)
    if (!username) throw new Error('username is required')

    switch (action) {
      case 'deduct': {
        // Deduct amount from player; caller must have ensured player exists
        const player = XoModel.ensurePlayer({ username })
        const updated = XoModel.adjustPlayerBalance(username, -amount)
        try {
          TransactionModel.create({ owner_id: updated.id, owner_username: updated.username, amount: -amount, type: 'deduct', reference: gameId || token || null })
        } catch (err) {
          console.error('[XoService.gameAction] failed to record transaction', err.message)
        }
        return { ok: true, data: { balance: Number(updated.balance || 0) } }
      }
      case 'credit': {
        const player = XoModel.ensurePlayer({ username })
        const updated = XoModel.adjustPlayerBalance(username, amount)
        try {
          TransactionModel.create({ owner_id: updated.id, owner_username: updated.username, amount: amount, type: 'credit', reference: gameId || token || null })
        } catch (err) {
          console.error('[XoService.gameAction] failed to record transaction', err.message)
        }
        return { ok: true, data: { balance: Number(updated.balance || 0) } }
      }
      case 'loss': {
        // Record a loss event (no balance change if already deducted)
        const player = XoModel.findPlayerByUsername(username) || XoModel.ensurePlayer({ username })
        try {
          TransactionModel.create({ owner_id: player.id, owner_username: player.username, amount: 0, type: 'loss', reference: gameId || token || null })
        } catch (err) {
          console.error('[XoService.gameAction] failed to record loss transaction', err.message)
        }
        return { ok: true, data: { balance: Number((player && player.balance) || 0) } }
      }
      case 'refund': {
        const player = XoModel.ensurePlayer({ username })
        const updated = XoModel.adjustPlayerBalance(username, amount)
        try {
          TransactionModel.create({ owner_id: updated.id, owner_username: updated.username, amount: amount, type: 'refund', reference: gameId || token || null })
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
        const updatedX = XoModel.adjustPlayerBalance(match.player_x_username, refundAmount)
        const updatedO = XoModel.adjustPlayerBalance(match.player_o_username, refundAmount)
        try {
          TransactionModel.create({ owner_id: updatedX.id, owner_username: updatedX.username, amount: refundAmount, type: 'draw_refund', reference: match.id })
          TransactionModel.create({ owner_id: updatedO.id, owner_username: updatedO.username, amount: refundAmount, type: 'draw_refund', reference: match.id })
        } catch (err) {
          console.error('[XoService.settleMatch] failed to record refund transactions', err.message)
        }
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
        if (token) XoModel.addToOwnerBalance(token, ownerFee)
        return { ok: true }
      }

      // winner exists
      const winner = match.winner_username
      if (!winner) return { ok: false, error: 'No winner to credit' }

      const winnerAmount = Math.round((pot - ownerFee) * 100) / 100
      const updatedWinner = XoModel.adjustPlayerBalance(winner, winnerAmount)
      try {
        TransactionModel.create({ owner_id: updatedWinner.id, owner_username: updatedWinner.username, amount: winnerAmount, type: 'win_credit', reference: match.id })
      } catch (err) {
        console.error('[XoService.settleMatch] failed to record win transaction', err.message)
      }
      if (token) XoModel.addToOwnerBalance(token, ownerFee)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }
}
