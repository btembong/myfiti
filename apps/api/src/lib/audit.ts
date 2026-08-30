import { v4 as uuid } from 'uuid'
import { tenantQuery } from '../db/client.js'

// ─── Financial audit log ──────────────────────────────────────────────────────
// Every wallet mutation and incoming webhook payment is recorded here.
// Required for PCI DSS Req 10 (audit trails) and fraud investigation.
//
// Table: financial_audit_log (provisioned per tenant in provision.ts)
// IMPORTANT: This function is fire-and-forget — it never throws.
//            A log failure must never block a financial operation.

export type FinancialAction =
  | 'wallet.topup.initiated'
  | 'wallet.topup.confirmed'
  | 'wallet.transfer'
  | 'wallet.cashout.initiated'
  | 'wallet.cashout.confirmed'
  | 'wallet.cashout.reversed'
  | 'wallet.pay_subscription'
  | 'wallet.pay_plan'
  | 'webhook.payment.received'
  | 'referral.reward.granted'
  | 'daily_limit.rejected'

interface AuditEntry {
  tenantSlug  : string
  actorId     : string          // member_id, 'system', or 'webhook:tranzak'
  actorIp    ?: string | null
  action      : FinancialAction
  amount     ?: number  | null
  currency   ?: string  | null
  reference  ?: string  | null  // tranzak_ref, wallet_tx_id, etc.
  metadata   ?: Record<string, unknown>
}

export async function logFinancialEvent(entry: AuditEntry): Promise<void> {
  try {
    await tenantQuery(
      entry.tenantSlug,
      `INSERT INTO financial_audit_log
         (id, actor_id, actor_ip, action, amount, currency, reference, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuid(),
        entry.actorId,
        entry.actorIp    ?? null,
        entry.action,
        entry.amount     ?? null,
        entry.currency   ?? null,
        entry.reference  ?? null,
        entry.metadata   ? JSON.stringify(entry.metadata) : null,
      ],
    )
  } catch (err) {
    console.error('[audit] failed to write financial_audit_log:', err)
  }
}
