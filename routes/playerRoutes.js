import { Router } from 'express'
import { PlayerController } from '../controllers/playerController.js'

const router = Router()

router.get('/', PlayerController.getPlayers)
router.post('/', PlayerController.createPlayer)
router.post('/online', PlayerController.goOnline)
router.post('/offline', PlayerController.goOffline)
router.post('/bet', PlayerController.savePlayerBet)
router.post('/bet/cancel', PlayerController.cancelPlayerBet)

export default router
