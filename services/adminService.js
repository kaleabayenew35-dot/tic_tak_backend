import crypto from 'crypto'
import { AdminModel } from '../models/adminModel.js'

export const AdminService = {
  async ensureSeeded() {
    await AdminModel.initializeTable()
    return AdminModel.seedDefaultAdmin()
  },
  async authenticate(username, password) {
    if (!username || !password) return null
    const admin = await AdminModel.findByUsername(username)
    if (!admin) return null
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
    return admin.password_hash === passwordHash ? { id: admin.id, username: admin.username } : null
  },
}
