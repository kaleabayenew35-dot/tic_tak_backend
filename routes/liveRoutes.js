import { Router } from 'express'
import { LiveController } from '../controllers/liveController.js'

const router = Router()

router.get('/challenges', LiveController.listChallenges)
router.get('/challenges/:username/pending', LiveController.getPendingChallenges)
router.post('/challenges', LiveController.createChallenge)
router.post('/challenges/:id/accept', LiveController.acceptChallenge)
router.post('/challenges/:id/decline', LiveController.declineChallenge)
router.get('/matches', LiveController.listMatches)
router.get('/matches/:id', LiveController.getMatch)
router.get('/stream', LiveController.stream)
router.post('/matches/:id/move', LiveController.recordMove)
router.post('/matches/:id/forfeit', LiveController.forfeitMatch)

export default router
