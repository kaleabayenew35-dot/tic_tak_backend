import { Router } from 'express'
import { AdminController } from '../controllers/adminController.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

router.post('/login', AdminController.login)
router.get('/owners', requireAdmin, AdminController.listOwners)
router.get('/transactions', requireAdmin, AdminController.listTransactions)

export default router
