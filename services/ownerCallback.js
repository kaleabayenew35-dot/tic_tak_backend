import db from '../config/db.js'
import { normalizePhone } from '../utils/phone.js'

const CALL_TIMEOUT_MS = 5000

function getTokenRow(tokenStr) {
  if (!tokenStr) return null
  return db.prepare('SELECT * FROM tokens WHERE token = ?').get(String(tokenStr))
}

function getBackendInfo(tokenId) {
  if (!tokenId) return null
  return db.prepare('SELECT id, token, owner_id, backend_url, backend, status FROM tokens WHERE id = ?').get(Number(tokenId))
}

function getTokenIdForPlayer(playerId) {
  if (!playerId) return null
  const row = db.prepare('SELECT id FROM tokens WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1').get(Number(playerId))
  return row?.id || null
}

function insertOutboxRow(tokenId, gameId, action, payload) {
  const stmt = db.prepare(
    'INSERT INTO pending_owner_callbacks (token_id, game_id, action, payload_json, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const info = stmt.run(tokenId, gameId, action, JSON.stringify(payload), 'pending', 0, Date.now(), Date.now())
  return info.lastInsertRowid
}

function markDelivered(outboxId) {
  if (!outboxId) return null
  return db.prepare('UPDATE pending_owner_callbacks SET status = ?, updated_at = ? WHERE id = ?').run('delivered', Date.now(), Number(outboxId))
}

function markAttemptFailed(outboxId, errorMsg, maxAttempts = 10) {
  if (!outboxId) return null
  const current = db.prepare('SELECT attempts FROM pending_owner_callbacks WHERE id = ?').get(Number(outboxId))
  const nextAttempts = (current?.attempts || 0) + 1
  const status = nextAttempts >= maxAttempts ? 'failed' : 'pending'
  const stmt = db.prepare('UPDATE pending_owner_callbacks SET attempts = ?, last_error = ?, status = ?, updated_at = ? WHERE id = ?')
  return stmt.run(nextAttempts, errorMsg, status, Date.now(), Number(outboxId))
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
  const outboxId = insertOutboxRow(tokenId, gameId, payload.action, payload)
  const result = await callXoEndpoint(backendUrl, payload)
  if (result && result.ok !== false) {
    markDelivered(outboxId)
    return result
  }
  markAttemptFailed(outboxId, result?.error || 'callback failed', 10)
  return result
}

async function fetchOwnerBalance(tokenStr, phone, username) {
  const tokenRow = getTokenRow(tokenStr)
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
  const backendInfo = getBackendInfo(tokenId)
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
  const backendInfo = getBackendInfo(tokenId)
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
  const backendInfo = getBackendInfo(tokenId)
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
  const backendInfo = getBackendInfo(tokenId)
  if (!backendInfo) return null
  const backendUrl = (backendInfo.backend_url || backendInfo.backend || '').toString().trim()
  if (!backendUrl) return null
  const payload = { action: 'owner_fee', token: backendInfo.token, amount, type, gameId, playerId: humanPlayerId }
  return dispatchCallback(tokenId, gameId, backendUrl, payload)
}

export const OwnerCallbackService = {
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
