import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, 'data', 'xo.db')

const db = new Database(dbPath)

const demoUsernames = ['@user_alpha', '@user_gamma', '@delta_pro', '@sigma_x', '@player123', 'p123', 'player13', 'betfix-test', 'queue-test']

const columns = db.prepare('PRAGMA table_info(players)').all()
const hasDemoColumn = columns.some((column) => column.name === 'is_demo')

if (!hasDemoColumn) {
  db.exec('ALTER TABLE players ADD COLUMN is_demo INTEGER DEFAULT 0')
}

const updateStmt = db.prepare('UPDATE players SET is_demo = 1 WHERE username = ? AND COALESCE(is_demo, 0) <> 1')
const updatedUsernames = []

for (const username of demoUsernames) {
  const result = updateStmt.run(username)
  if (result.changes > 0) {
    updatedUsernames.push(username)
  }
}

console.log(`Marked ${updatedUsernames.length} demo players as is_demo=1.`)
if (updatedUsernames.length > 0) {
  console.log(`Updated: ${updatedUsernames.join(', ')}`)
} else {
  console.log('No matching demo players needed updates.')
}

const remaining = db.prepare("SELECT id, username, is_demo FROM players WHERE username IN ('@user_alpha', '@user_gamma', '@delta_pro', '@sigma_x', '@player123', 'p123', 'player13', 'betfix-test', 'queue-test') ORDER BY id").all()
console.log(JSON.stringify(remaining, null, 2))
