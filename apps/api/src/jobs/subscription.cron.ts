import type { QueryResultRow } from 'pg'
import { globalQuery, tenantQuery } from '../db/client.js'
import { subscriptionQueue } from './index.js'
import { setCachedSubscriptionStatus } from '../lib/redis.js'

interface SubscriptionRow extends QueryResultRow {
  id: string
  member_id: string
  expires_at: string
  grace_expires_at: string
}

interface TenantRow extends QueryResultRow {
  grace_period_days: number
}

/**
 * Runs daily (midnight, per-tenant timezone via BullMQ cron).
 * Drives the full subscription state machine:
 *
 * active + 7d until expiry  → expiring_soon  (send reminders)
 * expiring_soon + expired   → grace_period   (start grace countdown)
 * grace_period + elapsed    → suspended      (revoke access)
 */
export async function runSubscriptionCron(tenantSlug: string, tenantId: string) {
  // 1. active → expiring_soon (expires within 7 days)
  const { rows: expiringSoon } = await tenantQuery<SubscriptionRow>(
    tenantSlug,
    `UPDATE subscriptions
     SET status = 'expiring_soon', updated_at = now()
     WHERE status = 'active'
       AND expires_at <= now() + interval '7 days'
       AND expires_at > now()
     RETURNING id, member_id, expires_at`
  )

  for (const sub of expiringSoon) {
    await setCachedSubscriptionStatus(tenantId, sub.member_id, 'expiring_soon')
    await subscriptionQueue.add('send-expiry-reminder', {
      tenantId, tenantSlug, memberId: sub.member_id, subscriptionId: sub.id,
      daysLeft: Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000),
    })
  }

  // 2. expiring_soon / active → grace_period (now expired)
  const { rows: tenantRows } = await globalQuery<TenantRow>(
    `SELECT grace_period_days FROM tenants WHERE id = $1`, [tenantId]
  )
  const graceDays = tenantRows[0]?.grace_period_days ?? 3

  const { rows: graceEntries } = await tenantQuery<SubscriptionRow>(
    tenantSlug,
    `UPDATE subscriptions
     SET status = 'grace_period',
         grace_expires_at = now() + ($1 || ' days')::interval,
         updated_at = now()
     WHERE status IN ('active', 'expiring_soon')
       AND expires_at <= now()
     RETURNING id, member_id, grace_expires_at`,
    [graceDays]
  )

  for (const sub of graceEntries) {
    await setCachedSubscriptionStatus(tenantId, sub.member_id, 'grace_period')
    await subscriptionQueue.add('send-grace-alert', {
      tenantId, tenantSlug, memberId: sub.member_id, subscriptionId: sub.id,
    })
  }

  // 3. grace_period → suspended (grace elapsed)
  const { rows: suspended } = await tenantQuery<SubscriptionRow>(
    tenantSlug,
    `UPDATE subscriptions
     SET status = 'suspended', updated_at = now()
     WHERE status = 'grace_period'
       AND grace_expires_at <= now()
     RETURNING id, member_id`
  )

  for (const sub of suspended) {
    await setCachedSubscriptionStatus(tenantId, sub.member_id, 'suspended')
    await subscriptionQueue.add('send-suspension-notice', {
      tenantId, tenantSlug, memberId: sub.member_id, subscriptionId: sub.id,
    })
  }

  console.log(`[cron] ${tenantSlug}: ${expiringSoon.length} expiring, ${graceEntries.length} grace, ${suspended.length} suspended`)
}
