import { query } from '../config/db.js'
import { TokenModel } from '../models/tokenModel.js'

const CALL_TIMEOUT_MS = 5000
function buildBackendUrl(record) { const value = (record?.backend_url ?? record?.backend ?? '').toString().trim(); return value ? value.replace(/\/+$/, '') : null }
async function pingBackend(backendUrl, token) {
  if (!backendUrl) return { online: false, reason: 'missing backend_url' }
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS); const start = Date.now()
  try { const response = await fetch(`${backendUrl}/xo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ping', token }), signal: controller.signal }); const raw = await response.text(); let data = null; try { data = raw ? JSON.parse(raw) : null } catch {} return { online: response.ok && data?.ok !== false, latencyMs: Date.now() - start, httpStatus: response.status, reason: data?.error || null } } catch (error) { return { online: false, latencyMs: null, reason: error.message } } finally { clearTimeout(timeout) }
}
export const TokenService = {
  async getTokens() { const { rows } = await query('SELECT id, token, owner_id, backend_url, status, created_at, expires_at FROM tokens ORDER BY created_at DESC'); return rows },
  async validateToken(token) { if (!token) return null; const record = await TokenModel.findByToken(token); if (!record || record.status !== 'active') return null; if (record.expires_at && record.expires_at < Date.now()) return null; return record },
  createToken(payload) { if (!payload.token) throw new Error('Token value is required'); return TokenModel.create({ ...payload, backend_url: payload.backend_url ?? payload.backend ?? null }) },
  async resolveToken(payload = {}) { const token = payload.token; const phoneNumber = payload.phoneNumber || payload.phone_number || payload.phone; if (!token) throw new Error('Token is required'); if (!phoneNumber) throw new Error('Phone number is required'); const record = await this.validateToken(token); if (!record) throw new Error('Invalid or expired token'); const backendUrl = buildBackendUrl(record); if (!backendUrl) throw new Error('No backend URL is stored for this token'); const response = await fetch(`${backendUrl}/xo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'get_balance', phone: phoneNumber, username: payload.username || '' }) }); const raw = await response.text(); let data = {}; try { data = raw ? JSON.parse(raw) : {} } catch {} if (response.ok && (data.ok || data.username || data.balance !== undefined)) return { token, phoneNumber, username: data.username || payload.username || '', balance: data.balance ?? data.data?.balance ?? '' }; throw new Error(data?.error || `Backend responded with ${response.status}`) },
  async toggleToken(id) { const token = await TokenModel.findById(id); if (!token) throw new Error('Token not found'); return TokenModel.update(id, { status: token.status === 'active' ? 'inactive' : 'active' }) },
  updateBackendUrl(id, backendUrl) { if (!id || !backendUrl) throw new Error('backend_url is required'); return TokenModel.update(id, { backend_url: backendUrl }) },
  async pingTokenBackend(id) { const token = await TokenModel.findById(id); if (!token) throw new Error('Token not found'); return pingBackend(buildBackendUrl(token), token.token) },
  updateToken(id, payload) { return TokenModel.update(id, payload) },
  async deleteToken(id) { if (!id) throw new Error('Token id is required'); const result = await TokenModel.delete(id); return result.changes > 0 },
}
