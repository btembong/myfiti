/**
 * Validate required environment variables on boot.
 * Throws with a clear message listing all missing vars.
 */
export function validateEnv() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
  ]

  const optional = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'BREVO_API_KEY',
    'TRANZAK_APP_ID',
    'TRANZAK_APP_KEY',
    'AT_API_KEY',
    'BULLMQ_REDIS_HOST',
  ]

  const missing = required.filter(k => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  const unset = optional.filter(k => !process.env[k])
  if (unset.length > 0) {
    console.warn(`[env] Optional vars not set (features may be limited): ${unset.join(', ')}`)
  }
}
