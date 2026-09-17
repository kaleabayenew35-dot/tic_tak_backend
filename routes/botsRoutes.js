import express from 'express'
import { BotsController } from '../controllers/botsController.js'

const router = express.Router()

router.get('/', BotsController.list)
router.get('/:id', BotsController.get)
router.post('/', BotsController.create)
router.put('/:id', BotsController.update)
router.post('/set-all', BotsController.setAll)

export default router
