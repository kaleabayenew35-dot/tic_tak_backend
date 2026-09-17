import db from '../config/db.js'
import { TokenModel } from '../models/tokenModel.js'

const CALL_TIMEOUT_MS = 5000

function buildBackendUrl(record) {
  const backendUrl = (record.backend_url ?? record.backend ?? '').toString().trim()
  if (!backendUrl) return null
  return backendUrl.replace(/\/+$/, '')
}

async function pingBackend(backendUrl, token) {
  if (!backendUrl) return { online: false, reason: 'missing backend_url' }
  const endpoint = `${backendUrl}/xo`
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping', token }),
      signal: controller.signal,
    })
    const latencyMs = Date.now() - start
    const rawText = await response.text()
    let data = null
    try {
      data = rawText ? JSON.parse(rawText) : null
    } catch {
      data = null
    }
    return {
      online: response.ok && data?.ok !== false,
      latencyMs,
      httpStatus: response.status,
      reason: data?.error || null,
    }
  } catch (err) {
    return { online: false, latencyMs: null, reason: err.message }
  } finally {
    clearTimeout(timeout)
  }
}

export const TokenService = {
  getTokens() {
    return db.prepare('SELECT id, token, owner_id, backend_url, status, created_at, expires_at FROM tokens ORDER BY created_at DESC').all()
  },

  validateToken(token) {
    if (!token) return null
    const record = TokenModel.findByToken(token)
    if (!record || record.status !== 'active') return null
    if (record.expires_at && record.expires_at < Date.now()) return null
    return record
  },

  createToken(payload) {
    if (!payload.token) {
      throw new Error('Token value is required')
    }
    return TokenModel.create({
      ...payload,
      backend_url: payload.backend_url ?? payload.backend ?? null,
    })
  },

  async resolveToken(payload = {}) {
    const token = payload.token
    const phoneNumber = payload.phoneNumber || payload.phone_number || payload.phone

    if (!token) {
      throw new Error('Token is required')
    }

    if (!phoneNumber) {
      throw new Error('Phone number is required')
    }

    const record = this.validateToken(token)
    if (!record) {
      throw new Error('Invalid or expired token')
    }

    const backendUrl = buildBackendUrl(record)
    if (!backendUrl) {
      throw new Error('No backend URL is stored for this token')
    }

    const response = await fetch(`${backendUrl}/xo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'get_balance',
        phone: phoneNumber,
        username: payload.username || '',
      }),
    })
    const rawText = await response.text()
    let data = {}
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      data = { raw: rawText }
    }

    if (response.ok && (data.ok || data.username || data.balance !== undefined || data.balance !== null)) {
      return {
        token,
        phoneNumber,
        username: data.username || payload.username || data.data?.player?.username || '',
        balance: data.balance ?? data.data?.balance ?? data.data?.player?.balance ?? '',
      }
    }

    throw new Error(data?.error || `Backend responded with ${response.status}`)
  },

  async toggleToken(id) {
    if (!id) throw new Error('Token id is required')
    const token = TokenModel.findById(id)
    if (!token) throw new Error('Token not found')
    const nextStatus = token.status === 'active' ? 'inactive' : 'active'
    return TokenModel.update(id, { status: nextStatus })
  },

  updateBackendUrl(id, backendUrl) {
    if (!id) throw new Error('Token id is required')
    if (!backendUrl) throw new Error('backend_url is required')
    return TokenModel.update(id, { backend_url: backendUrl })
  },

  async pingTokenBackend(id) {
    if (!id) throw new Error('Token id is required')
    const token = TokenModel.findById(id)
    if (!token) throw new Error('Token not found')
    const backendUrl = buildBackendUrl(token)
    return pingBackend(backendUrl, token.token)
  },

  updateToken(id, payload) {
    return TokenModel.update(id, payload)
  },

  deleteToken(id) {
    if (!id) {
      throw new Error('Token id is required')
    }
    const result = TokenModel.delete(id)
    return result.changes > 0
  },
}
