import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface KioskTokenPayload {
  type: 'kiosk'
  tenant: string
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      kiosk?: { tenant: string }
    }
  }
}

/**
 * Validates kiosk JWT tokens passed as `?t=` query param or `X-Kiosk-Token` header.
 * Falls through if no kiosk token is present (allows shared routes to work with staff auth too).
 */
export function optionalKioskAuth(req: Request, _res: Response, next: NextFunction) {
  const token = (req.query.t as string) || (req.headers['x-kiosk-token'] as string)
  if (!token) return next()

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as KioskTokenPayload
    if (payload.type !== 'kiosk') return next()
    req.kiosk = { tenant: payload.tenant }
  } catch {
    // Invalid kiosk token — just continue without kiosk context
  }
  next()
}

/**
 * Requires a valid kiosk token. Use on endpoints that should only be accessible from a kiosk.
 */
export function requireKioskAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.query.t as string) || (req.headers['x-kiosk-token'] as string)
  if (!token) {
    return res.status(401).json({ error: 'Kiosk token required.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as KioskTokenPayload
    if (payload.type !== 'kiosk') {
      return res.status(403).json({ error: 'Invalid kiosk token.' })
    }
    req.kiosk = { tenant: payload.tenant }
    next()
  } catch {
    return res.status(401).json({ error: 'Kiosk token expired or invalid.' })
  }
}
