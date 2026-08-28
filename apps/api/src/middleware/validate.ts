import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

/**
 * Express middleware that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (sanitised) data.
 * On failure, returns 400 with structured field errors.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of (result.error as ZodError).issues) {
        const path = issue.path.join('.')
        fieldErrors[path || '_root'] = issue.message
      }
      return res.status(400).json({ error: 'Validation failed', fields: fieldErrors })
    }
    req.body = result.data
    next()
  }
}
