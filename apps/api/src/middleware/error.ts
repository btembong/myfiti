import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)

  const status = (err as { status?: number }).status ?? 500
  const isProd = process.env.NODE_ENV === 'production'

  res.status(status).json({
    error: status === 500 ? 'internal_error' : 'request_error',
    message: isProd && status === 500 ? 'Something went wrong.' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  })
}
