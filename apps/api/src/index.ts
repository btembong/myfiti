import 'dotenv/config'
import { validateEnv } from './lib/env.js'
validateEnv()

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'

import { tenantMiddleware } from './middleware/tenant.js'
import { errorHandler } from './middleware/error.js'
import { rateLimitApi } from './middleware/rate-limit.js'
import { router } from './routes/index.js'
import { globalQuery } from './db/client.js'
// Start BullMQ workers (side-effect import — workers begin listening on load)
import './jobs/index.js'
import { startSubscriptionCron } from './jobs/subscription-cron.js'
import { startBillingCron } from './jobs/billing-cron.js'
import { startMotivationCron } from './jobs/motivation-cron.js'
import { startWalletReconcileCron } from './jobs/wallet-reconcile-cron.js'
import { migrateAllTenants, migrateGlobalSchema } from './db/provision.js'

const app = express()
app.set('etag', false) // disable 304 caching — mobile clients always need fresh data
const PORT = process.env.PORT ?? 4000

// ─── Security & logging ──────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
  credentials: true,
  maxAge: 86400,
}))
app.use(morgan('dev'))

// ─── Raw body for webhook signature verification ─────────────────────────────
app.use('/api/webhooks', express.raw({ type: 'application/json' }))

// ─── JSON body for everything else ───────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', rateLimitApi)

// ─── Tenant resolution ───────────────────────────────────────────────────────
app.use('/api', tenantMiddleware)

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', router)

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  ok: true,
  uptime: Math.round(process.uptime()),
  timestamp: new Date().toISOString(),
}))

// ─── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`GymFlow API running on port ${PORT}`)
  migrateGlobalSchema()
    .then(() => migrateAllTenants())
    .then(() => {
      startSubscriptionCron()
      startBillingCron()
      startMotivationCron()
      startWalletReconcileCron()
    })

  // Keep Neon DB alive — free tier pauses after ~5 min of inactivity
  // Pings every 4 minutes so the kiosk never hits a cold-start timeout
  setInterval(async () => {
    try { await globalQuery('SELECT 1') }
    catch { /* ignore — just a keepalive */ }
  }, 4 * 60 * 1000)
})

export default app
