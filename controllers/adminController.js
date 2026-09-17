import { AdminService } from '../services/adminService.js'
import { XoModel } from '../models/xoModel.js'
import { TransactionModel } from '../models/transactionModel.js'
import { signAdminToken } from '../middleware/auth.js'

export const AdminController = {
  async login(req, res) {
    try {
      AdminService.ensureSeeded()
      const { username, password } = req.body
      const admin = AdminService.authenticate(username, password)

      if (!admin) {
        return res.status(401).json({ error: 'Invalid username or password' })
      }

      const token = signAdminToken(admin)
      res.json({ success: true, admin, token })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async listOwners(req, res) {
    try {
      // list tokens with owner info
      const rows = XoModel.getAllTokensWithOwners ? XoModel.getAllTokensWithOwners() : []
      res.json({ ok: true, data: rows })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  },

  async listTransactions(req, res) {
    try {
      const limit = Number(req.query.limit || 50)
      const offset = Number(req.query.offset || 0)
      const rows = TransactionModel.list({ limit, offset })
      res.json({ ok: true, data: rows })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  }
}
