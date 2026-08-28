import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthTokenPayload, StaffRole } from '@gymflow/types'

declare global {
  namespace Express {
    interface Request {
      auth: AuthTokenPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing auth token.' })
  }

  try {
    const token = header.slice(7)
    const raw = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>

    // Reject superadmin tokens on tenant routes — they must use /superadmin/* endpoints
    if (raw.role === 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'Superadmin tokens cannot access tenant routes.' })
    }

    req.auth = raw as unknown as AuthTokenPayload
    next()
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token.' })
  }
}

export function requireRole(...roles: Array<StaffRole | 'member'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions.' })
    }
    next()
  }
}
