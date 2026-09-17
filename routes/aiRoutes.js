import { Router } from 'express'
import { AiController } from '../controllers/aiController.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/config', AiController.getConfig)
router.put('/config', requireAdmin, AiController.updateConfig)

export default router