import { TokenService } from '../services/tokenService.js'

export const TokenController = {
  async listTokens(req, res) {
    try {
      const tokens = await TokenService.getTokens()
      res.json(tokens)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async validateToken(req, res) {
    try {
      const { token } = req.params
      const tokenRecord = await TokenService.validateToken(token)
      if (!tokenRecord) {
        return res.status(404).json({ error: 'Invalid or expired token' })
      }
      res.json(tokenRecord)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async createToken(req, res) {
    try {
      const token = await TokenService.createToken(req.body)
      res.status(201).json(token)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async resolveToken(req, res) {
    try {
      const result = await TokenService.resolveToken(req.body)
      res.json({ ok: false, error: 'This route is deprecated; use launch-token based flows instead.', data: result })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async toggleToken(req, res) {
    try {
      const { id } = req.params
      const result = await TokenService.toggleToken(Number(id))
      res.json(result)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async updateBackendUrl(req, res) {
    try {
      const { id } = req.params
      const { backend_url } = req.body
      if (!backend_url) {
        throw new Error('backend_url is required')
      }
      const result = await TokenService.updateBackendUrl(Number(id), backend_url)
      res.json(result)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async pingTokenBackend(req, res) {
    try {
      const { id } = req.params
      const result = await TokenService.pingTokenBackend(Number(id))
      res.json(result)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async updateToken(req, res) {
    try {
      const { id } = req.params
      const updatedToken = await TokenService.updateToken(Number(id), req.body)
      res.json(updatedToken)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async deleteToken(req, res) {
    try {
      const { id } = req.params
      const deleted = await TokenService.deleteToken(Number(id))
      res.json({ success: deleted })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },
}
