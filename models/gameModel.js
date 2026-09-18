import { query } from '../config/db.js'

export const GameModel = {
  async findAll() {
    const { rows } = await query(`SELECT g.id, p1.username AS player_x, p2.username AS player_o, g.result, g.moves, g.created_at
      FROM games g LEFT JOIN players p1 ON g.player_x_id = p1.id LEFT JOIN players p2 ON g.player_o_id = p2.id
      ORDER BY g.created_at DESC`)
    return rows
  },
  async create({ player_x_id, player_o_id, result, moves = '' }) {
    const { rows } = await query('INSERT INTO games (player_x_id, player_o_id, result, moves, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *', [player_x_id, player_o_id, result, moves, Date.now()])
    return rows[0]
  },
}
