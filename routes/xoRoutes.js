import express from 'express'
import { XoController } from '../controllers/xoController.js'

const router = express.Router()

router.post('/', XoController.xoCallback)
router.post('/player-balance', XoController.playerBalance)
router.post('/game-action', XoController.gameAction)
router.post('/verify', XoController.verify)

export default router
