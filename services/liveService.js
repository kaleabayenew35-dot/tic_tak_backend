import { LiveModel } from '../models/liveModel.js'
import { broadcastLiveEvent } from '../liveEventBus.js'
import { PlayerModel } from '../models/playerModel.js'
import { XoService } from './xoService.js'
import { StatsModel } from '../models/statsModel.js'
import { OwnerCallbackService } from './ownerCallback.js'

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '')
}

export const LiveService = {
  async listChallenges() {
    return LiveModel.getChallenges()
  },

  async createChallenge(payload) {
    const challengerUsername = normalizeUsername(payload.challengerUsername || payload.challenger || payload.username)
    const opponentUsername = normalizeUsername(payload.opponentUsername || payload.opponent || payload.receiver)
    const wagerAmount = Number(payload.wagerAmount ?? payload.amount ?? payload.betAmount ?? 0)

    if (!challengerUsername || !opponentUsername) {
      throw new Error('challengerUsername and opponentUsername are required')
    }
    if (!Number.isFinite(wagerAmount) || wagerAmount <= 0) {
      throw new Error('wagerAmount must be a positive number')
    }

    const challenge = await LiveModel.createChallenge({ challengerUsername, opponentUsername, wagerAmount })

    // Instantly notify the opponent via SSE so the invite modal appears
    // without waiting for their polling cycle.
    broadcastLiveEvent([opponentUsername], 'challenge_received', { challenge })
    // Also notify the challenger so their UI can confirm the challenge was sent.
    broadcastLiveEvent([challengerUsername], 'challenge_sent', { challenge })

    return challenge
  },

  async acceptChallenge(id) {
    const numericId = Number(id)
    if (!numericId) throw new Error('Challenge id is required')
    const challenge = await LiveModel.getChallengeById(numericId)
    if (!challenge) throw new Error('Challenge not found')

    // Attempt to deduct wager from both players before creating the match
    const wager = Number(challenge.wager_amount || 0)
    try {
      if (wager > 0) {
        // Deduct challenger first
        await XoService.gameAction({ action: 'deduct', username: challenge.challenger_username, amount: wager })
        try {
          // Then deduct opponent; if it fails, refund challenger
          await XoService.gameAction({ action: 'deduct', username: challenge.opponent_username, amount: wager })
        } catch (err) {
          // refund challenger
          try {
            await XoService.gameAction({ action: 'credit', username: challenge.challenger_username, amount: wager })
          } catch (refundErr) {
            console.error('[LiveService.acceptChallenge] failed to refund challenger after opponent deduction failure', refundErr.message)
          }
          throw err
        }
      }
    } catch (err) {
      throw new Error('Failed to deduct wagers: ' + err.message)
    }

    const result = await LiveModel.acceptChallenge(numericId)
    if (result?.challenge && result?.match) {
      const usernames = [result.challenge.challenger_username, result.challenge.opponent_username]
      await PlayerModel.clearBet(result.challenge.challenger_username)
      await PlayerModel.clearBet(result.challenge.opponent_username)
      await OwnerCallbackService.notifySystemBetPlaced({
        player1Username: result.challenge.challenger_username,
        player2Username: result.challenge.opponent_username,
        amount: wager,
        gameId: result.match.id,
      })
      broadcastLiveEvent(usernames, 'challenge_accepted', { challenge: result.challenge, match: result.match })
    }
    return result
  },

  async declineChallenge(id) {
    const numericId = Number(id)
    if (!numericId) throw new Error('Challenge id is required')
    const challenge = await LiveModel.declineChallenge(numericId)
    if (challenge) {
      // Tell the challenger their challenge was declined so their UI updates
      broadcastLiveEvent([challenge.challenger_username], 'challenge_declined', { challenge })
    }
    return challenge
  },

  async recordMove({ matchId, playerUsername, index }) {
    const numericId = Number(matchId)
    const moveIndex = Number(index)
    if (!numericId) throw new Error('Match id is required')
    if (!playerUsername) throw new Error('playerUsername is required')
    if (!Number.isInteger(moveIndex) || moveIndex < 0 || moveIndex > 8) throw new Error('Move index must be between 0 and 8')
    console.log(`[LiveService.recordMove] matchId=${numericId} player=${playerUsername} index=${moveIndex}`)
    const updatedMatch = await LiveModel.recordMove({ matchId: numericId, playerUsername, index: moveIndex })
    if (updatedMatch) {
      const matchParticipants = [updatedMatch.player_x_username, updatedMatch.player_o_username]
      console.log(`[LiveService.recordMove] broadcast move_made for matchId=${updatedMatch.id}`)
      broadcastLiveEvent(matchParticipants, 'move_made', { match: updatedMatch })
      if (updatedMatch.status === 'finished') {
        // settle payments for the finished match (owner token not provided)
        try {
          await XoService.settleMatch(updatedMatch)
        } catch (err) {
          console.error('[LiveService.recordMove] failed to settle match payments', err.message)
        }
        // update stats
        try {
          if (updatedMatch.result === 'draw') {
            await StatsModel.incrementDraw(updatedMatch.player_x_username)
            await StatsModel.incrementDraw(updatedMatch.player_o_username)
          } else if (updatedMatch.result === 'x_win') {
            await StatsModel.incrementWin(updatedMatch.player_x_username)
            await StatsModel.incrementLoss(updatedMatch.player_o_username)
          } else if (updatedMatch.result === 'o_win') {
            await StatsModel.incrementWin(updatedMatch.player_o_username)
            await StatsModel.incrementLoss(updatedMatch.player_x_username)
          }
        } catch (err) {
          console.error('[LiveService.recordMove] failed to update stats', err.message)
        }
        console.log(`[LiveService.recordMove] broadcast match_finished for matchId=${updatedMatch.id}`)
        broadcastLiveEvent(matchParticipants, 'match_finished', { match: updatedMatch })
      }
    } else {
      console.log('[LiveService.recordMove] LiveModel.recordMove returned no updatedMatch')
    }
    return updatedMatch
  },

  async forfeitMatch({ matchId, leavingUsername }) {
    const numericId = Number(matchId)
    if (!numericId) throw new Error('Match id is required')
    if (!leavingUsername) throw new Error('leavingUsername is required')
    console.log(`[LiveService.forfeitMatch] matchId=${numericId} leaving=${leavingUsername}`)
    const updatedMatch = await LiveModel.forfeitMatch({ matchId: numericId, leavingUsername })
    if (updatedMatch) {
      const matchParticipants = [updatedMatch.player_x_username, updatedMatch.player_o_username]
      console.log(`[LiveService.forfeitMatch] broadcast match_finished for matchId=${updatedMatch.id}`)
      try {
        await XoService.settleMatch(updatedMatch)
      } catch (err) {
        console.error('[LiveService.forfeitMatch] failed to settle payments', err.message)
      }
      try {
        // Update stats for forfeit case
        if (updatedMatch.result === 'x_win') {
          await StatsModel.incrementWin(updatedMatch.player_x_username)
          await StatsModel.incrementLoss(updatedMatch.player_o_username)
        } else if (updatedMatch.result === 'o_win') {
          await StatsModel.incrementWin(updatedMatch.player_o_username)
          await StatsModel.incrementLoss(updatedMatch.player_x_username)
        }
      } catch (err) {
        console.error('[LiveService.forfeitMatch] failed to update stats', err.message)
      }
      broadcastLiveEvent(matchParticipants, 'match_finished', { match: updatedMatch })
    }
    return updatedMatch
  },

  async listMatches() {
    return LiveModel.getMatches()
  },

  async getMatch(id) {
    const numericId = Number(id)
    if (!numericId) throw new Error('Match id is required')
    return LiveModel.getMatchById(numericId)
  },

  async getPendingChallenges(username) {
    return LiveModel.getPendingChallenges(username)
  },
}
