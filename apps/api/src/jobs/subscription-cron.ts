import { globalQuery, tenantQuery } from '../db/client.js'
import { subscriptionQueue } from './index.js'

/**
 * Subscription lifecycle cron — runs periodically to transition statuses:
 *  active → expiring_soon (7 days before expiry)
 *  expiring_soon → grace_period (after expiry, within grace window)
 *  grace_period → suspended (after grace window expires)
 *
 * Also enqueues email notifications for each transition.
 */
export async function runSubscriptionCron() {
  console.log('[subscription-cron] starting scan...')

  // Get all active tenants
  const { rows: tenants } = await globalQuery<{ id: string; slug: string }>(
    `SELECT id, slug FROM tenants WHERE status != 'suspended'`,
  )

  let totalTransitions = 0

  for (const tenant of tenants) {
    try {
      // 1. Active → Expiring Soon (expires in ≤ 7 days)
      const { rows: expiring } = await tenantQuery<{ id: string; member_id: string }>(
        tenant.slug,
        `UPDATE subscriptions
         SET status = 'expiring_soon', updated_at = NOW()
         WHERE status = 'active'
           AND expires_at <= NOW() + INTERVAL '7 days'
           AND expires_at > NOW()
         RETURNING id, member_id`,
      )
      for (const sub of expiring) {
        await subscriptionQueue.add('send-expiry-reminder', {
          tenantSlug: tenant.slug,
          tenantId: tenant.id,
          memberId: sub.member_id,
          subscriptionId: sub.id,
          daysLeft: 7,
        }).catch(() => {})
      }

      // 2. Expiring Soon → Grace Period (past expiry date)
      const { rows: graced } = await tenantQuery<{ id: string; member_id: string }>(
        tenant.slug,
        `UPDATE subscriptions
         SET status = 'grace_period', updated_at = NOW()
         WHERE status IN ('active', 'expiring_soon')
           AND expires_at <= NOW()
           AND (grace_expires_at IS NULL OR grace_expires_at > NOW())
         RETURNING id, member_id`,
      )
      for (const sub of graced) {
        await subscriptionQueue.add('send-grace-alert', {
          tenantSlug: tenant.slug,
          tenantId: tenant.id,
          memberId: sub.member_id,
          subscriptionId: sub.id,
        }).catch(() => {})

        // Update member status
        await tenantQuery(
          tenant.slug,
          `UPDATE members SET status = 'grace_period', updated_at = NOW() WHERE id = $1`,
          [sub.member_id],
        )
      }

      // 3. Grace Period → Suspended (past grace window)
      const { rows: suspended } = await tenantQuery<{ id: string; member_id: string }>(
        tenant.slug,
        `UPDATE subscriptions
         SET status = 'suspended', updated_at = NOW()
         WHERE status = 'grace_period'
           AND grace_expires_at <= NOW()
         RETURNING id, member_id`,
      )
      for (const sub of suspended) {
        await subscriptionQueue.add('send-suspension-notice', {
          tenantSlug: tenant.slug,
          tenantId: tenant.id,
          memberId: sub.member_id,
          subscriptionId: sub.id,
        }).catch(() => {})

        await tenantQuery(
          tenant.slug,
          `UPDATE members SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
          [sub.member_id],
        )
      }

      const count = expiring.length + graced.length + suspended.length
      if (count > 0) {
        console.log(`[subscription-cron] ${tenant.slug}: ${expiring.length} expiring, ${graced.length} grace, ${suspended.length} suspended`)
      }
      totalTransitions += count
    } catch (err) {
      console.error(`[subscription-cron] error processing ${tenant.slug}:`, err)
    }
  }

  console.log(`[subscription-cron] done. ${totalTransitions} transitions across ${tenants.length} tenants.`)
}

// Run every hour when called as a standalone script or from a scheduler
const CRON_INTERVAL = 60 * 60 * 1000 // 1 hour

export function startSubscriptionCron() {
  console.log('[subscription-cron] scheduled to run every hour')
  // Run immediately, then repeat
  runSubscriptionCron().catch(err => console.error('[subscription-cron] initial run error:', err))
  setInterval(() => {
    runSubscriptionCron().catch(err => console.error('[subscription-cron] error:', err))
  }, CRON_INTERVAL)
}
