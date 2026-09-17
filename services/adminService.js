import crypto from 'crypto'
import { AdminModel } from '../models/adminModel.js'

export const AdminService = {
  ensureSeeded() {
    AdminModel.initializeTable()
    return AdminModel.seedDefaultAdmin()
  },

  authenticate(username, password) {
    if (!username || !password) return null
    const admin = AdminModel.findByUsername(username)
    if (!admin) return null

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
    if (admin.password_hash !== passwordHash) return null

    return { id: admin.id, username: admin.username }
  },
}
