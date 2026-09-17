import { Router } from 'express'
import { TokenController } from '../controllers/tokenController.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

router.use(requireAdmin)
router.get('/', TokenController.listTokens)
router.post('/', TokenController.createToken)
router.patch('/:id/toggle', TokenController.toggleToken)
router.patch('/:id/backend-url', TokenController.updateBackendUrl)
router.post('/:id/ping', TokenController.pingTokenBackend)
router.put('/:id', TokenController.updateToken)
router.delete('/:id', TokenController.deleteToken)
router.get('/:token', TokenController.validateToken)

export default router
