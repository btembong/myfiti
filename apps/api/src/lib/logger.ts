type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  msg: string
  [key: string]: unknown
}

function formatLog(entry: LogEntry): string {
  const { level, msg, ...meta } = entry
  const ts = new Date().toISOString()
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
  return `${ts} [${level.toUpperCase()}] ${msg}${metaStr}`
}

export const logger = {
  info(msg: string, meta: Record<string, unknown> = {}) {
    console.log(formatLog({ level: 'info', msg, ...meta }))
  },
  warn(msg: string, meta: Record<string, unknown> = {}) {
    console.warn(formatLog({ level: 'warn', msg, ...meta }))
  },
  error(msg: string, meta: Record<string, unknown> = {}) {
    console.error(formatLog({ level: 'error', msg, ...meta }))
  },
  debug(msg: string, meta: Record<string, unknown> = {}) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(formatLog({ level: 'debug', msg, ...meta }))
    }
  },
}
