import db from '../config/db.js'

export const GameModel = {
  findAll() {
    return db.prepare(`SELECT g.id, p1.username AS player_x, p2.username AS player_o, g.result, g.moves, g.created_at
      FROM games g
      LEFT JOIN players p1 ON g.player_x_id = p1.id
      LEFT JOIN players p2 ON g.player_o_id = p2.id
      ORDER BY g.created_at DESC`).all()
  },

  create({ player_x_id, player_o_id, result, moves = '' }) {
    const stmt = db.prepare('INSERT INTO games (player_x_id, player_o_id, result, moves, created_at) VALUES (?, ?, ?, ?, ?)')
    const info = stmt.run(player_x_id, player_o_id, result, moves, Date.now())
    return db.prepare('SELECT * FROM games WHERE id = ?').get(info.lastInsertRowid)
  },
}
