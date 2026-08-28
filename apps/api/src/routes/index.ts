import { Router } from 'express'

// Auth
import { authRouter } from './auth.js'

// Admin (staff-facing)
import { membersRouter } from './members.js'
import { subscriptionsRouter } from './subscriptions.js'
import { paymentsRouter } from './payments.js'
import { classesRouter } from './classes.js'
import { checkinRouter } from './checkin.js'
import { analyticsRouter } from './analytics.js'
import { settingsRouter } from './settings.js'
import { dayPassesRouter } from './day-passes.js'
import { announcementsRouter } from './announcements.js'

// Member-facing
import { memberMeRouter } from './member-me.js'

// Public (no auth)
import { publicRouter } from './public.js'

// Webhooks
import { webhooksRouter } from './webhooks.js'

// Onboarding
import { onboardingRouter } from './onboarding.js'

// SuperAdmin
import { superadminRouter } from './superadmin.js'

export const router = Router()

// ─── Public (no auth, no tenant required for some) ───────────────────────────
router.use('/public', publicRouter)
router.use('/webhooks', webhooksRouter)

// ─── Auth ────────────────────────────────────────────────────────────────────
router.use('/auth', authRouter)

// ─── Onboarding (pre-tenant, uses owner JWT) ─────────────────────────────────
router.use('/onboarding', onboardingRouter)

// ─── Member self-service ─────────────────────────────────────────────────────
router.use('/member/me', memberMeRouter)

// Alias so mobile payments screen URL works too
router.use('/members/me', memberMeRouter)

// ─── Admin / Staff ───────────────────────────────────────────────────────────
router.use('/members', membersRouter)
router.use('/subscriptions', subscriptionsRouter)
router.use('/payments', paymentsRouter)
router.use('/classes', classesRouter)
router.use('/checkin', checkinRouter)
router.use('/analytics', analyticsRouter)
router.use('/settings', settingsRouter)
router.use('/day-passes', dayPassesRouter)
router.use('/announcements', announcementsRouter)

// ─── SuperAdmin ───────────────────────────────────────────────────────────────
router.use('/superadmin', superadminRouter)
