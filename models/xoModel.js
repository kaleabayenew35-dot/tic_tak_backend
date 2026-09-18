import { query } from '../config/db.js'
import { TransactionModel } from './transactionModel.js'
function normalize(username) { return String(username || '').trim().replace(/^@/, '').toLowerCase() }
export const XoModel = {
  async findPlayerByUsername(username) { const value = normalize(username); if (!value) return null; const { rows } = await query("SELECT * FROM players WHERE lower(replace(trim(username), '@', '')) = $1", [value]); return rows[0] || null },
  async createPlayer({ username, balance = 0 }) { const { rows } = await query('INSERT INTO players (username, balance) VALUES ($1, $2) RETURNING *', [normalize(username), Number(balance || 0)]); return rows[0] },
  async ensurePlayer(data) { return (await this.findPlayerByUsername(data.username)) || this.createPlayer(data) },
  async adjustPlayerBalance(username, delta) { const player = await this.findPlayerByUsername(username); if (!player) throw new Error('Player not found'); const next = Number(player.balance || 0) + Number(delta || 0); if (next < 0) throw new Error('Insufficient balance'); const { rows } = await query('UPDATE players SET balance = $1 WHERE id = $2 RETURNING *', [next, player.id]); return rows[0] },
  async findToken(token) { if (!token) return null; const { rows } = await query('SELECT * FROM tokens WHERE token = $1', [String(token)]); return rows[0] || null },
  async getAllTokensWithOwners() { const { rows } = await query(`SELECT t.id AS token_id, t.token, t.owner_id, p.username AS owner_username, p.balance AS owner_balance, t.backend_url FROM tokens t LEFT JOIN players p ON p.id = t.owner_id ORDER BY t.created_at DESC`); return rows },
  async getOwnerForToken(token) { const rec = await this.findToken(token); if (!rec?.owner_id) return null; const { rows } = await query('SELECT * FROM players WHERE id = $1', [rec.owner_id]); return rows[0] || null },
  async addToOwnerBalance(token, amount) { const owner = await this.getOwnerForToken(token); if (!owner) throw new Error('Token owner not found'); const updated = await this.adjustPlayerBalance(owner.username, amount); try { await TransactionModel.create({ owner_id: owner.id, owner_username: owner.username, amount, type: 'owner_fee', reference: token }) } catch (error) { console.error('[XoModel.addToOwnerBalance] transaction failed', error.message) } return updated },
}
