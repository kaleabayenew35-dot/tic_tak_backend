import db from '../config/db.js'

function normalizeUsername(username) {
  return String(username || '').trim().replace(/^@/, '').toLowerCase()
}

export const PlayerModel = {
  findAll() {
    return db.prepare(
      "SELECT id, username, balance, status, selected_bet_amount FROM players WHERE (is_demo IS NULL OR is_demo = 0) AND status = 'online' ORDER BY id ASC"
    ).all()
  },

  findById(id) {
    return db.prepare('SELECT id, username, balance, status, selected_bet_amount FROM players WHERE id = ?').get(id)
  },

  findByUsername(username) {
    const normalized = normalizeUsername(username)
    if (!normalized) return null
    return db.prepare(
      "SELECT id, username, balance, status, selected_bet_amount FROM players WHERE lower(replace(trim(username), '@', '')) = ?"
    ).get(normalized)
  },

  findByBetAmount(amount) {
    const value = Number(amount)
    // Guard: if the caller passed something that can't be parsed (NaN) or
    // a non-positive number, bail out immediately with an empty result set
    // rather than letting a broken query through.
    if (!Number.isFinite(value) || value <= 0) return []
    return db.prepare(
      "SELECT id, username, balance, status, selected_bet_amount FROM players WHERE (is_demo IS NULL OR is_demo = 0) AND selected_bet_amount = ? AND selected_bet_amount > 0 AND status = 'online' ORDER BY id ASC"
    ).all(value)
  },

  create({ username, balance = 0, status = 'online', selectedBetAmount = null }) {
    const normalizedUsername = normalizeUsername(username)
    // is_demo=0 is explicit — never rely on the column default when creating
    // a real player via the app. This prevents seeded/test rows from silently
    // being treated as demo players if the column default ever changes.
    const stmt = db.prepare('INSERT INTO players (username, balance, status, selected_bet_amount, is_demo) VALUES (?, ?, ?, ?, 0)')
    const info = stmt.run(normalizedUsername, balance, status, selectedBetAmount == null ? null : Number(selectedBetAmount))
    return this.findById(info.lastInsertRowid)
  },


  upsertByUsername({ username, balance, status = 'online', selectedBetAmount = null, updateBalance = false }) {
    const existing = this.findByUsername(username)
    if (existing) {
      const nextBalance = updateBalance ? Number(balance ?? existing.balance ?? 0) : existing.balance
      const nextStatus = status || existing.status || 'online'
      // Treat 0 and non-finite values the same as null — only positive finite
      // numbers count as a real bet selection.
      const coerced = selectedBetAmount == null ? null : Number(selectedBetAmount)
      const nextSelectedBetAmount = (Number.isFinite(coerced) && coerced > 0) ? coerced : null

      db.prepare("UPDATE players SET balance = ?, status = ?, selected_bet_amount = ? WHERE lower(replace(trim(username), '@', '')) = ?").run(
        nextBalance,
        nextStatus,
        nextSelectedBetAmount,
        normalizeUsername(username),
      )
      return this.findByUsername(username)
    }

    return this.create({
      username,
      balance: Number(balance ?? 0),
      status,
      selectedBetAmount,
    })
  },

  clearBet(username) {
    const normalized = normalizeUsername(username)
    if (!normalized) return null
    db.prepare("UPDATE players SET selected_bet_amount = NULL WHERE lower(replace(trim(username), '@', '')) = ?").run(normalized)
    return this.findByUsername(normalized)
  },

  // Called when a player opens the app — registers them as online with their
  // current balance. Promotes any existing row to is_demo=0 (a real logged-in
  // player is always real, even if the row was previously seeded as demo).
  goOnline({ username, balance }) {
    const normalized = normalizeUsername(username)
    if (!normalized) return null
    const balanceNum = Number(balance) || 0
    const existing = this.findByUsername(username)
    if (existing) {
      db.prepare(
        "UPDATE players SET status = 'online', balance = ?, is_demo = 0 WHERE lower(replace(trim(username), '@', '')) = ?"
      ).run(balanceNum, normalized)
      return this.findByUsername(username)
    }
    // New player — create with status online, no bet yet, definitely not demo
    return this.create({ username, balance: balanceNum, status: 'online', selectedBetAmount: null })
  },

  // Called when a player closes the tab — marks them offline and clears bet
  // so they vanish from all online/match lists immediately.
  goOffline(username) {
    const normalized = normalizeUsername(username)
    if (!normalized) return
    db.prepare(
      "UPDATE players SET status = 'offline', selected_bet_amount = NULL WHERE lower(replace(trim(username), '@', '')) = ?"
    ).run(normalized)
  },
}
