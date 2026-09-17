import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'xo-jwt-secret-change-me'

export const requireAdmin = (req, res, next) => {
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
