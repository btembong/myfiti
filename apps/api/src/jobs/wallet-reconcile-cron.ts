import { globalQuery, tenantQuery } from '../db/client.js'

const CRON_INTERVAL = 24 * 60 * 60 * 1000 // nightly

/**
 * Wallet balance reconciliation cron.
 *
 * The `wallet_accounts.balance` column is a cached running total that is
 * updated atomically on every credit/debit. This job recomputes the
 * correct balance from the ledger (wallet_transactions) and patches any
 * rows that have drifted — e.g. due to a crash mid-transaction or a
 * bug that touched balance without writing a transaction record.
 *
 * Safe to run any number of times — fully idempotent.
 */
export async function runWalletReconcile(): Promise<{
  tenantsChecked: number
  accountsChecked: number
  corrected: number
  discrepancies: Array<{ tenant: string; memberId: string; stored: number; computed: number; delta: number }>
}> {
  console.log('[wallet-reconcile] starting reconciliation...')

  const { rows: tenants } = await globalQuery<{ id: string; slug: string }>(
    `SELECT id, slug FROM tenants WHERE status != 'suspended'`,
  )

  let accountsChecked = 0
  let corrected       = 0
  const discrepancies: Array<{ tenant: string; memberId: string; stored: number; computed: number; delta: number }> = []

  for (const tenant of tenants) {
    try {
      // Compute correct balance for every wallet in this tenant from completed transactions
      const { rows } = await tenantQuery<{
        member_id: string
        stored_balance: string
        computed_balance: string
      }>(
        tenant.slug,
        `SELECT
           wa.member_id,
           wa.balance::TEXT                              AS stored_balance,
           COALESCE(
             SUM(
               CASE
                 WHEN wt.type IN ('topup', 'credit', 'referral_credit') THEN wt.amount
                 ELSE -wt.amount
               END
             ) FILTER (WHERE wt.status = 'completed'),
             0
           )::TEXT                                       AS computed_balance
         FROM wallet_accounts wa
         LEFT JOIN wallet_transactions wt ON wt.member_id = wa.member_id
         GROUP BY wa.member_id, wa.balance`,
      )

      accountsChecked += rows.length

      for (const row of rows) {
        const stored   = parseFloat(row.stored_balance)
        const computed = parseFloat(row.computed_balance)
        const delta    = Math.abs(stored - computed)

        // Allow 0.001 floating-point tolerance
        if (delta < 0.001) continue

        discrepancies.push({ tenant: tenant.slug, memberId: row.member_id, stored, computed, delta })

        // Patch balance to computed value
        await tenantQuery(
          tenant.slug,
          `UPDATE wallet_accounts
           SET balance = $1, updated_at = NOW()
           WHERE member_id = $2`,
          [computed, row.member_id],
        )

        corrected++
        console.warn(
          `[wallet-reconcile] DRIFT in ${tenant.slug} member=${row.member_id}` +
          ` stored=${stored} computed=${computed} delta=${delta > 0 ? '+' : ''}${(computed - stored).toFixed(2)} — corrected`,
        )
      }
    } catch (err) {
      console.error(`[wallet-reconcile] error processing tenant ${tenant.slug}:`, err)
    }
  }

  const summary = {
    tenantsChecked: tenants.length,
    accountsChecked,
    corrected,
    discrepancies,
  }

  if (corrected > 0) {
    console.warn(`[wallet-reconcile] done — ${corrected} balance(s) corrected across ${tenants.length} tenants`)
  } else {
    console.log(`[wallet-reconcile] done — all ${accountsChecked} wallet(s) across ${tenants.length} tenants are clean`)
  }

  return summary
}

export function startWalletReconcileCron() {
  console.log('[wallet-reconcile] scheduled to run every 24 hours')

  // Delay first run by 30 s to let the server finish booting
  setTimeout(() => {
    runWalletReconcile().catch(err => console.error('[wallet-reconcile] initial run error:', err))
  }, 30_000)

  setInterval(() => {
    runWalletReconcile().catch(err => console.error('[wallet-reconcile] error:', err))
  }, CRON_INTERVAL)
}
