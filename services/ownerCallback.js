import { query } from '../config/db.js'
import { normalizePhone } from '../utils/phone.js'

const CALL_TIMEOUT_MS = 5000
const SYSTEM_BACKEND_URL = () => process.env.SYSTEM_BACKEND_URL?.trim().replace(/\/+$/, '')
const DAMA_GAME_TOKEN = () => process.env.DAMA_GAME_TOKEN?.trim()

async function resolvePlayerIdentity(username) {
  const value = String(username || '').trim().replace(/^@/, '').toLowerCase()
  if (!value) return { username: null, phone: null }
  const { rows } = await query(
    "SELECT username, phone FROM players WHERE lower(replace(trim(username), '@', '')) = $1",
    [value],
  )
  const player = rows[0]
  return {
    username: player?.username || String(username).trim().replace(/^@/, ''),
    phone: player?.phone ? normalizePhone(player.phone) : null,
  }
}

async function callSystemDama(action, username, amount, gameId) {
  const backendUrl = SYSTEM_BACKEND_URL()
  const token = DAMA_GAME_TOKEN()
  if (!backendUrl || !token) {
    console.warn('[OwnerCallbackService] system callback skipped: SYSTEM_BACKEND_URL or DAMA_GAME_TOKEN is missing')
    return null
  }

  const identity = await resolvePlayerIdentity(username)
  const payload = {
    action,
    token,
    username: identity.username,
    ...(identity.phone ? { phone: identity.phone } : {}),
    amount: Number(amount || 0),
    gameId: String(gameId || ''),
  }

  try {
    const response = await fetch(`${backendUrl}/dama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) {
      throw new Error(`HTTP ${response.status}: ${data?.error || 'callback failed'}`)
    }
    console.log(`[OwnerCallbackService] system ${action} callback succeeded for ${identity.username}, game=${gameId}`)
    return data
  } catch (error) {
    console.error(`[OwnerCallbackService] system ${action} callback failed for ${identity.username}, game=${gameId}: ${error.message}`)
    return null
  }
}

async function notifySystemBetPlaced({ player1Username, player2Username, amount, gameId }) {
  return Promise.all([
    callSystemDama('deduct', player1Username, amount, gameId),
    callSystemDama('deduct', player2Username, amount, gameId),
  ])
}

async function notifySystemWinPayout({ winnerUsername, loserUsername, winnerPayout, gameId }) {
  return Promise.all([
    callSystemDama('credit', winnerUsername, winnerPayout, gameId),
    callSystemDama('loss', loserUsername, 0, gameId),
  ])
}

async function notifySystemDrawRefund({ player1Username, player2Username, refund, gameId }) {
  return Promise.all([
    callSystemDama('refund', player1Username, refund, gameId),
    callSystemDama('refund', player2Username, refund, gameId),
  ])
}

async function getTokenRow(tokenStr) {
  if (!tokenStr) return null
  const { rows } = await query('SELECT * FROM tokens WHERE token = $1', [String(tokenStr)])
  return rows[0] || null
}

async function getBackendInfo(tokenId) {
  if (!tokenId) return null
  const { rows } = await query('SELECT id, token, owner_id, backend_url, backend, status FROM tokens WHERE id = $1', [Number(tokenId)])
  return rows[0] || null
}

async function getTokenIdForPlayer(playerId) {
  if (!playerId) return null
  const { rows } = await query('SELECT id FROM tokens WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1', [Number(playerId)])
  const row = rows[0]
  return row?.id || null
}

async function insertOutboxRow(tokenId, gameId, action, payload) {
  const { rows } = await query('INSERT INTO pending_owner_callbacks (token_id, game_id, action, payload_json, status, attempts, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [tokenId, gameId, action, JSON.stringify(payload), 'pending', 0, Date.now(), Date.now()])
  return rows[0]?.id
}

async function markDelivered(outboxId) {
  if (!outboxId) return null
  return query('UPDATE pending_owner_callbacks SET status = $1, updated_at = $2 WHERE id = $3', ['delivered', Date.now(), Number(outboxId)])
}

async function markAttemptFailed(outboxId, errorMsg, maxAttempts = 10) {
  if (!outboxId) return null
  const { rows } = await query('SELECT attempts FROM pending_owner_callbacks WHERE id = $1', [Number(outboxId)])
  const current = rows[0]
  const nextAttempts = (current?.attempts || 0) + 1
  const status = nextAttempts >= maxAttempts ? 'failed' : 'pending'
  return query('UPDATE pending_owner_callbacks SET attempts = $1, last_error = $2, status = $3, updated_at = $4 WHERE id = $5', [nextAttempts, errorMsg, status, Date.now(), Number(outboxId)])
}

async function callXoEndpoint(backendUrl, body) {
  if (!backendUrl) return null
  const normalizedBackend = String(backendUrl).trim().replace(/\/+$/, '')
  const url = `${normalizedBackend}/xo`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const rawText = await response.text()
    try {
      return rawText ? JSON.parse(rawText) : null
    } catch {
      return null
    }
  } catch (error) {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function dispatchCallback(tokenId, gameId, backendUrl, payload) {
  const outboxId = await insertOutboxRow(tokenId, gameId, payload.action, payload)
  const result = await callXoEndpoint(backendUrl, payload)
  if (result && result.ok !== false) {
    await markDelivered(outboxId)
    return result
  }
  await markAttemptFailed(outboxId, result?.error || 'callback failed', 10)
  return result
}

async function fetchOwnerBalance(tokenStr, phone, username) {
  const tokenRow = await getTokenRow(tokenStr)
  if (!tokenRow || tokenRow.status !== 'active') return null
  const backendUrl = (tokenRow.backend_url || tokenRow.backend || '').toString().trim()
  if (!backendUrl) return null
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) return null

  const result = await callXoEndpoint(backendUrl, {
    action: 'get_balance',
    token: tokenStr,
    phone: normalizedPhone,
    username,
  })

  if (!result || result.ok === false) return null
  return {
    balance: result.balance ?? null,
    username: result.username ?? username,
  }
}

async function notifyBetPlaced(tokenId, { player1Id, player2Id, betAmount, gameId }) {
  const backendInfo = await getBackendInfo(tokenId)
  if (!backendInfo) return null
  const backendUrl = (backendInfo.backend_url || backendInfo.backend || '').toString().trim()
  if (!backendUrl) return null
  const actions = [
    {
      action: 'deduct',
      payload: { action: 'deduct', token: backendInfo.token, amount: betAmount, gameId, playerId: player1Id },
    },
    {
      action: 'deduct',
      payload: { action: 'deduct', token: backendInfo.token, amount: betAmount, gameId, playerId: player2Id },
    },
  ]

  return Promise.allSettled(actions.map((item) => dispatchCallback(tokenId, gameId, backendUrl, item.payload)))
}

async function notifyWinPayout(tokenId, { winnerId, loserId, winnerPayout, fee, gameId }) {
  const backendInfo = await getBackendInfo(tokenId)
  if (!backendInfo) return null
  const backendUrl = (backendInfo.backend_url || backendInfo.backend || '').toString().trim()
  if (!backendUrl) return null

  const creditPayload = { action: 'credit', token: backendInfo.token, amount: winnerPayout, gameId, playerId: winnerId }
  const lossPayload = { action: 'loss', token: backendInfo.token, amount: 0, gameId, playerId: loserId }

  return Promise.allSettled([
    dispatchCallback(tokenId, gameId, backendUrl, creditPayload),
    dispatchCallback(tokenId, gameId, backendUrl, lossPayload),
  ])
}

async function notifyDrawRefund(tokenId, { player1Id, player2Id, refund, fee, gameId }) {
  const backendInfo = await getBackendInfo(tokenId)
  if (!backendInfo) return null
  const backendUrl = (backendInfo.backend_url || backendInfo.backend || '').toString().trim()
  if (!backendUrl) return null

  const payloads = [
    { action: 'refund', token: backendInfo.token, amount: refund, gameId, playerId: player1Id },
    { action: 'refund', token: backendInfo.token, amount: refund, gameId, playerId: player2Id },
  ]

  return Promise.allSettled(payloads.map((payload) => dispatchCallback(tokenId, gameId, backendUrl, payload)))
}

async function notifyOwnerFee(tokenId, { amount, type, gameId, humanPlayerId }) {
  const backendInfo = await getBackendInfo(tokenId)
  if (!backendInfo) return null
  const backendUrl = (backendInfo.backend_url || backendInfo.backend || '').toString().trim()
  if (!backendUrl) return null
  const payload = { action: 'owner_fee', token: backendInfo.token, amount, type, gameId, playerId: humanPlayerId }
  return dispatchCallback(tokenId, gameId, backendUrl, payload)
}

export const OwnerCallbackService = {
  notifySystemBetPlaced,
  notifySystemWinPayout,
  notifySystemDrawRefund,
  insertOutboxRow,
  markDelivered,
  markAttemptFailed,
  callXoEndpoint,
  dispatchCallback,
  getTokenRow,
  getBackendInfo,
  getTokenIdForPlayer,
  fetchOwnerBalance,
  notifyBetPlaced,
  notifyWinPayout,
  notifyDrawRefund,
  notifyOwnerFee,
}
