import { LiveService } from '../services/liveService.js'
import { attachLiveStream } from '../liveEventBus.js'

export const LiveController = {
  async listChallenges(req, res) {
    try {
      res.json(LiveService.listChallenges())
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async recordMove(req, res) {
    try {
      const match = LiveService.recordMove({
        matchId: req.params.id,
        playerUsername: req.body.playerUsername || req.body.username,
        index: req.body.index,
      })
      res.json(match)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async createChallenge(req, res) {
    try {
      const challenge = LiveService.createChallenge(req.body)
      res.status(201).json(challenge)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async acceptChallenge(req, res) {
    try {
      const result = LiveService.acceptChallenge(req.params.id)
      res.json(result)
    } catch (error) {
      const message = error.message?.includes('UNIQUE') ? 'Challenge already accepted' : error.message
      console.log(`[LiveController.acceptChallenge] challengeId=${req.params.id} error=${message}`)
      res.status(400).json({ error: message })
    }
  },

  async declineChallenge(req, res) {
    try {
      const result = LiveService.declineChallenge(req.params.id)
      res.json(result)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async listMatches(req, res) {
    try {
      res.json(LiveService.listMatches())
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async getMatch(req, res) {
    try {
      const match = LiveService.getMatch(req.params.id)
      if (!match) {
        res.status(404).json({ error: 'Match not found' })
        return
      }
      res.json(match)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async getPendingChallenges(req, res) {
    try {
      const challenges = LiveService.getPendingChallenges(req.params.username)
      res.json(challenges)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  async forfeitMatch(req, res) {
    try {
      const match = LiveService.forfeitMatch({ matchId: req.params.id, leavingUsername: req.body.playerUsername || req.body.username });
      res.json(match)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  },

  async stream(req, res) {
    try {
      const username = req.query.username || req.headers['x-username']
      if (!username) {
        res.status(400).json({ error: 'username is required' })
        return
      }
      attachLiveStream(req, res, username)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },
}
