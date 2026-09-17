import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import playerRoutes from './routes/playerRoutes.js'
import gameRoutes from './routes/gameRoutes.js'
import tokenRoutes from './routes/tokenRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import liveRoutes from './routes/liveRoutes.js'
import xoRoutes from './routes/xoRoutes.js'
import { XoController } from './controllers/xoController.js'
import statsRoutes from './routes/statsRoutes.js'
import { StatsController } from './controllers/statsController.js'
import botsRoutes from './routes/botsRoutes.js'
import { BotsController } from './controllers/botsController.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const PORT = process.env.BACKEND_PORT || process.env.PORT || 10000
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://tic-tak-5qd1.onrender.com',
  'https://tic-tak-backend.onrender.com',
  'https://system-admin-iou9.onrender.com',
  'https://system-backend-1u5m.onrender.com',
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.options('*', cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.use('/api/players', playerRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/admin/tokens', tokenRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/live', liveRoutes)
app.use('/api/xo', xoRoutes)
app.use('/xo', xoRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/bots', botsRoutes)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`XO backend running at http://0.0.0.0:${PORT}`)
})
