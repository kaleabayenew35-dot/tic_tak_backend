import jwt from 'jsonwebtoken'

const JWT_SECRET    = process.env.JWT_SECRET    || 'xo-jwt-secret-change-me'
const ADMIN_TOKEN   = process.env.XO_ADMIN_TOKEN || process.env.ADMIN_TOKEN || ''

export const requireAdmin = (req, res, next) => {
  // ── Path 1: plain shared-secret token sent by system_backend proxy ──
  const xAdminToken = req.headers['x-admin-token'] || ''
  if (ADMIN_TOKEN && xAdminToken && xAdminToken === ADMIN_TOKEN) {
    req.admin = { id: 0, username: 'system_proxy' }
    return next()
  }

  // ── Path 2: JWT Bearer token (admin frontend / direct calls) ──────────
  const authHeader = req.headers['authorization'] || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.admin = payload
    next()
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' })
  }
}

export const signAdminToken = (admin) => {
  return jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: '12h' }
  )
}