import liveDb from '../config/liveDb.js'

export const LiveModel = {
  getChallenges() {
    return liveDb.prepare('SELECT * FROM live_challenges ORDER BY created_at DESC').all()
  },

  createChallenge({ challengerUsername, opponentUsername, wagerAmount }) {
    const stmt = liveDb.prepare(
      'INSERT INTO live_challenges (challenger_username, opponent_username, wager_amount, status) VALUES (?, ?, ?, ?)' 
    )
    const info = stmt.run(challengerUsername, opponentUsername, wagerAmount, 'pending')
    return liveDb.prepare('SELECT * FROM live_challenges WHERE id = ?').get(info.lastInsertRowid)
  },

  acceptChallenge(id) {
    liveDb.prepare('UPDATE live_challenges SET status = ? , accepted_at = ? WHERE id = ?').run('accepted', Date.now(), id)
    const challenge = liveDb.prepare('SELECT * FROM live_challenges WHERE id = ?').get(id)
    if (!challenge) return null

    const existingMatch = liveDb.prepare('SELECT * FROM live_matches WHERE challenge_id = ?').get(id)
    if (existingMatch) {
      console.log(`[LiveModel.acceptChallenge] returning existing match for challengeId=${id} matchId=${existingMatch.id}`)
      return { challenge, match: existingMatch }
    }

    const matchStmt = liveDb.prepare(
      'INSERT INTO live_matches (challenge_id, player_x_username, player_o_username, wager_amount, status, moves) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const matchInfo = matchStmt.run(id, challenge.challenger_username, challenge.opponent_username, challenge.wager_amount, 'active', '[]')
    const match = liveDb.prepare('SELECT * FROM live_matches WHERE id = ?').get(matchInfo.lastInsertRowid)
    liveDb.prepare('UPDATE live_challenges SET match_id = ? WHERE id = ?').run(match.id, id)
    const updatedChallenge = liveDb.prepare('SELECT * FROM live_challenges WHERE id = ?').get(id)
    return { challenge: updatedChallenge, match }
  },

  declineChallenge(id) {
    liveDb.prepare("UPDATE live_challenges SET status = 'declined' WHERE id = ?").run(id)
    return liveDb.prepare('SELECT * FROM live_challenges WHERE id = ?').get(id)
  },

  getPendingChallenges(username) {
    const normalized = String(username || '').trim().replace(/^@/, '').toLowerCase()
    if (!normalized) {
      return liveDb.prepare("SELECT * FROM live_challenges WHERE status = 'pending' ORDER BY created_at DESC").all()
    }
    // Match both @username and username formats in the DB
    return liveDb.prepare(
      "SELECT * FROM live_challenges WHERE status = 'pending' AND (lower(replace(trim(challenger_username),'@','')) = ? OR lower(replace(trim(opponent_username),'@','')) = ?) ORDER BY created_at DESC"
    ).all(normalized, normalized)
  },

  getChallengeById(id) {
    return liveDb.prepare('SELECT * FROM live_challenges WHERE id = ?').get(id)
  },

  getMatches() {
    return liveDb.prepare('SELECT * FROM live_matches ORDER BY created_at DESC').all()
  },

  getMatchById(id) {
    return liveDb.prepare('SELECT * FROM live_matches WHERE id = ?').get(id)
  },

  recordMove({ matchId, playerUsername, index }) {
    try {
      console.log(`[LiveModel.recordMove] attempt matchId=${matchId} player=${playerUsername} index=${index}`)
      const match = liveDb.prepare('SELECT * FROM live_matches WHERE id = ?').get(matchId)
      if (!match) {
        console.log(`[LiveModel.recordMove] match not found: ${matchId}`)
        throw new Error('Match not found')
      }

      const existingMoves = (() => {
        try {
          return typeof match.moves === 'string' && match.moves ? JSON.parse(match.moves) : []
        } catch (err) {
          console.log('[LiveModel.recordMove] could not parse existing moves', err)
          return []
        }
      })()

      const occupied = existingMoves.some((move) => Number(move.index) === index)
      if (occupied) {
        console.log(`[LiveModel.recordMove] cell already occupied: matchId=${matchId} index=${index}`)
        throw new Error('Cell already occupied')
      }

      const expectedRole = existingMoves.length % 2 === 0 ? 'X' : 'O'
      const expectedUsername = expectedRole === 'X' ? match.player_x_username : match.player_o_username
      if (normalizeUsername(playerUsername) !== normalizeUsername(expectedUsername)) {
        console.log(`[LiveModel.recordMove] wrong turn: expected=${expectedUsername} got=${playerUsername}`)
        throw new Error('It is not this player\'s turn')
      }

      const nextMoves = [...existingMoves, { index, player: expectedRole, username: playerUsername }]
      const outcome = getMatchOutcome(nextMoves, match)
      const updateStmt = liveDb.prepare('UPDATE live_matches SET moves = ?, status = ?, result = ?, winner_username = ? WHERE id = ?')
      
      console.log('[BACKEND MOVE] matchId:', matchId, 'player:', playerUsername, 'index:', index, 'role:', expectedRole)

      const info = updateStmt.run(
        JSON.stringify(nextMoves),
        outcome.status,
        outcome.result,
        outcome.winnerUsername,
        matchId,
      )
      console.log(`[LiveModel.recordMove] update result for matchId=${matchId} changes=${info?.changes}`)
      const refreshed = liveDb.prepare('SELECT * FROM live_matches WHERE id = ?').get(matchId)
      return refreshed
    } catch (error) {
      console.error('[BACKEND MOVE ERROR] FAILED recordMove:', error.message)
      throw error
    }
  },
  
  forfeitMatch({ matchId, leavingUsername }) {
    try {
      const match = liveDb.prepare('SELECT * FROM live_matches WHERE id = ?').get(matchId)
      if (!match) throw new Error('Match not found')
      if (match.status === 'finished') return match

      const normalizedLeave = normalizeUsername(leavingUsername)
      const playerX = normalizeUsername(match.player_x_username)
      const playerO = normalizeUsername(match.player_o_username)
      let winnerUsername = null
      if (normalizedLeave === playerX) winnerUsername = match.player_o_username
      else if (normalizedLeave === playerO) winnerUsername = match.player_x_username
      else throw new Error('Player not in match')

      const result = winnerUsername && normalizeUsername(winnerUsername) === normalizeUsername(match.player_x_username) ? 'x_win' : 'o_win'
      liveDb.prepare('UPDATE live_matches SET status = ?, result = ?, winner_username = ?, finished_at = ? WHERE id = ?').run(
        'finished',
        result,
        winnerUsername,
        Date.now(),
        matchId,
      )
      return liveDb.prepare('SELECT * FROM live_matches WHERE id = ?').get(matchId)
    } catch (err) {
      console.error('[LiveModel.forfeitMatch] error', err.message)
      throw err
    }
  },
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function getMatchOutcome(moves, match) {
  const board = Array(9).fill(null)
  moves.forEach((move) => {
    if (Number.isInteger(move.index) && move.index >= 0 && move.index < 9) {
      board[move.index] = move.player
    }
  })

  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        status: 'finished',
        result: board[a] === 'X' ? 'x_win' : 'o_win',
        winnerUsername: board[a] === 'X' ? match.player_x_username : match.player_o_username,
      }
    }
  }

  if (moves.length === 9) {
    return { status: 'finished', result: 'draw', winnerUsername: null }
  }

  return { status: 'active', result: null, winnerUsername: null }
}

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]
