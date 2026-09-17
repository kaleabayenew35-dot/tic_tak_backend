import { Router } from 'express'
import { GameController } from '../controllers/gameController.js'

const router = Router()

router.get('/', GameController.getGames)
router.post('/', GameController.createGame)

export default router
