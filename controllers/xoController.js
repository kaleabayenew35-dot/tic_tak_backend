import { XoService } from '../services/xoService.js'
import { TokenModel } from '../models/tokenModel.js'
import { PlayerModel } from '../models/playerModel.js'
import { TransactionModel } from '../models/transactionModel.js'
import { OwnerCallbackService } from '../services/ownerCallback.js'
import { verifyLaunchToken } from '../utils/launchToken.js'
import { normalizePhone } from '../utils/phone.js'

export const XoController = {
  async playerBalance(req, res) {
    try {
      const { token, launch } = req.body
      if (!token || !launch) {
        return res.status(400).json({ ok: false, error: 'token and launch are required' })
      }

      const tokenRow = TokenModel.findByToken(token)
      if (!tokenRow || tokenRow.status !== 'active' || !(tokenRow.backend_url || tokenRow.backend)) {
        return res.json({ ok: true, data: { balance: null } })
      }

      const launchData = await verifyLaunchToken(launch, process.env.SYSTEM_BACKEND_URL)
      if (!launchData) {
        return res.json({ ok: true, data: { balance: null } })
      }

      const ownerBalance = await OwnerCallbackService.fetchOwnerBalance(token, normalizePhone(launchData.phone), launchData.username)
      return res.json({ ok: true, data: { balance: ownerBalance?.balance ?? null, username: ownerBalance?.username ?? launchData.username } })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  async gameAction(req, res) {
    try {
      const payload = req.body || {}
      const action = payload.action
      if (!action) return res.status(400).json({ ok: false, error: 'action is required' })
      const result = await XoService.gameAction(payload)
      res.json(result)
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message })
    }
  },

  async verify(req, res) {
    try {
      const { token, launch } = req.body
      if (!token || !launch) {
        return res.status(400).json({ ok: false, error: 'token and launch are required' })
      }

      const launchData = await verifyLaunchToken(launch, process.env.SYSTEM_BACKEND_URL)
      if (!launchData) {
        return res.status(400).json({ ok: false, error: 'Invalid launch token' })
      }

      const ownerBalance = await OwnerCallbackService.fetchOwnerBalance(token, normalizePhone(launchData.phone), launchData.username)
      const username = ownerBalance?.username ?? launchData.username
      const balance = ownerBalance?.balance ?? null
      res.json({ ok: true, data: { game: { id: 1, name: 'XO' }, player: { id: null, username, phone: null, balance, coins: 0 } } })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  async xoCallback(req, res) {
    try {
      const payload = req.body || {}
      const token = payload.token
      const action = payload.action
      if (!token) return res.status(400).json({ ok: false, error: 'token is required' })
      // Optionally validate token; TokenModel can be used to find owner/backend association
      if (action === 'ping') return res.json({ ok: true, message: 'pong' })
      if (action === 'get_balance') {
        const username = payload.username || payload.phone
        const result = XoService.getPlayerBalance({ username })
        return res.json({ ok: true, balance: result.data.balance })
      }
      if (['deduct', 'credit', 'loss', 'refund', 'owner_fee'].includes(action)) {
        if (action === 'owner_fee') {
          const { amount, gameId, game_id, username } = payload
          const tokenRow = TokenModel.findByToken(token)
          let ownerId = null
          let ownerUsername = username || null
          if (tokenRow && tokenRow.owner_id) {
            const owner = PlayerModel.findById(tokenRow.owner_id)
            if (owner) {
              ownerId = owner.id
              ownerUsername = owner.username
            }
          }

          TransactionModel.create({
            owner_id: ownerId,
            owner_username: ownerUsername,
            amount: Number(amount || 0),
            type: 'owner_fee',
            reference: gameId || game_id || token,
          })
          return res.json({ ok: true })
        }
        const result = await XoService.gameAction(payload)
        return res.json(result)
      }
      return res.status(400).json({ ok: false, error: 'unknown action' })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  }
}
