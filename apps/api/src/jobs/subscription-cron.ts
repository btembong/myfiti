import { v4 as uuid } from 'uuid'
import Expo from 'expo-server-sdk'
import { globalQuery, tenantQuery } from '../db/client.js'
import { subscriptionQueue } from './index.js'

const expo = new Expo()

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

      // 2a. Wallet auto-renew — try to renew expired subscriptions from wallet BEFORE
      //     transitioning them to grace_period. If the wallet has sufficient balance
      //     the debit succeeds and the subscription stays active (bypassing grace).
      const { rows: aboutToGrace } = await tenantQuery<{ id: string; member_id: string; plan_id: string }>(
        tenant.slug,
        `SELECT id, member_id, plan_id FROM subscriptions
         WHERE status IN ('active', 'expiring_soon')
           AND expires_at <= NOW()
           AND (grace_expires_at IS NULL OR grace_expires_at > NOW())`,
      )
      const autoRenewed = new Set<string>()
      for (const sub of aboutToGrace) {
        try {
          const { rows: planRows } = await tenantQuery<{ price: string; duration_days: number; name: string }>(
            tenant.slug,
            `SELECT price, duration_days, name FROM membership_plans WHERE id = $1`,
            [sub.plan_id],
          )
          if (!planRows[0]) continue
          const price = parseFloat(planRows[0].price)
          if (price <= 0) continue

          // Atomic debit — only succeeds when balance >= price
          const { rows: debitRows } = await tenantQuery<{ balance: string }>(
            tenant.slug,
            `UPDATE wallet_accounts SET balance = balance - $1
             WHERE member_id = $2 AND balance >= $1
             RETURNING balance`,
            [price, sub.member_id],
          )
          if (!debitRows[0]) continue // insufficient balance → will enter grace_period

          const newExpiry = new Date()
          newExpiry.setDate(newExpiry.getDate() + (planRows[0].duration_days ?? 30))

          await Promise.all([
            tenantQuery(
              tenant.slug,
              `UPDATE subscriptions
               SET status = 'active', started_at = NOW(), expires_at = $1,
                   grace_expires_at = NULL, updated_at = NOW()
               WHERE id = $2`,
              [newExpiry.toISOString(), sub.id],
            ),
            tenantQuery(
              tenant.slug,
              `UPDATE members SET status = 'active', updated_at = NOW() WHERE id = $1`,
              [sub.member_id],
            ),
            tenantQuery(
              tenant.slug,
              `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status)
               VALUES ($1, $2, 'debit', $3, $4, 'completed')`,
              [uuid(), sub.member_id, price, `Auto-renewal — ${planRows[0].name}`],
            ),
          ])

          autoRenewed.add(sub.id)
          console.log(
            `[subscription-cron] ${tenant.slug}: auto-renewed member=${sub.member_id}` +
            ` plan="${planRows[0].name}" via wallet (${price}) → expires ${newExpiry.toDateString()}`,
          )

          // Push notification — fire and forget
          tenantQuery<{ push_token: string | null }>(
            tenant.slug,
            `SELECT push_token FROM members WHERE id = $1 LIMIT 1`,
            [sub.member_id],
          ).then(({ rows }) => {
            const token = rows[0]?.push_token
            if (token && Expo.isExpoPushToken(token)) {
              expo.sendPushNotificationsAsync([{
                to: token,
                sound: 'default',
                title: 'Membership auto-renewed',
                body: `Your ${planRows[0].name} was renewed via your wallet. Valid until ${newExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
                data: { type: 'wallet_auto_renewal' },
              }]).catch(() => {})
            }
          }).catch(() => {})
        } catch (e) {
          console.error(`[subscription-cron] wallet auto-renew error for sub=${sub.id}:`, e)
        }
      }

      // 2b. Expiring Soon → Grace Period (past expiry date, not auto-renewed)
      const { rows: graced } = await tenantQuery<{ id: string; member_id: string }>(
        tenant.slug,
        `UPDATE subscriptions
         SET status = 'grace_period', updated_at = NOW()
         WHERE status IN ('active', 'expiring_soon')
           AND expires_at <= NOW()
           AND (grace_expires_at IS NULL OR grace_expires_at > NOW())
         RETURNING id, member_id`,
      )
      // Exclude any subscription that was just auto-renewed (status is now 'active')
      const gracedFiltered = graced.filter(s => !autoRenewed.has(s.id))
      for (const sub of gracedFiltered) {
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

      const count = expiring.length + gracedFiltered.length + suspended.length + autoRenewed.size
      if (count > 0) {
        console.log(`[subscription-cron] ${tenant.slug}: ${expiring.length} expiring, ${gracedFiltered.length} grace, ${suspended.length} suspended, ${autoRenewed.size} wallet-auto-renewed`)
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
