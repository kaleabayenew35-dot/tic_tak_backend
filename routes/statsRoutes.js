import express from 'express'
import { StatsController } from '../controllers/statsController.js'

const router = express.Router()

router.get('/player/:username', StatsController.getPlayerStats)
router.post('/player', StatsController.getPlayerStats)

export default router
