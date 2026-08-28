import { v4 as uuid } from 'uuid'
import { globalQuery } from '../db/client.js'
import { buildInvoicePDF } from '../lib/pdf.js'
import {
  sendInvoiceNotificationEmail,
  sendTrialEndingEmail,
  sendTrialExpiredEmail,
  sendRenewalReminderEmail,
} from '../lib/email.js'

/**
 * Platform billing cron — hybrid auto + manual invoice management.
 *
 * Auto jobs (no human required):
 *   1. Monthly invoice generation  — runs on the 1st of each month
 *   2. Overdue detection           — runs daily, flips past-due pending invoices
 *
 * Manual override always available:
 *   - Superadmin can hit POST /api/superadmin/invoices/generate at any time
 *   - Superadmin can manually mark any invoice paid via PATCH /api/superadmin/invoices/:id
 *   - All auto operations are idempotent — running twice is safe
 */

const PLAN_PRICE_XAF: Record<string, number> = {
  starter: 0, growth: 9900, growth_plus: 19900, enterprise: 49900,
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
}

function invoiceNumber(tenantSlug: string, date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `INV-${y}-${m}-${tenantSlug.toUpperCase().slice(0, 6)}`
}

// ─── Job 1: Generate monthly platform invoices ────────────────────────────────
// Idempotent — safe to run multiple times in the same month.

export async function generateMonthlyInvoices(): Promise<{ created: number; skipped: number }> {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const dueDate     = new Date(now.getFullYear(), now.getMonth(), 15)

  const { rows: tenants } = await globalQuery<{
    id: string; slug: string; plan: string; owner_email: string; owner_name: string
  }>(
    `SELECT id, slug, plan, owner_email, owner_name
     FROM tenants
     WHERE status IN ('active', 'trialing')`,
  )

  const billable = tenants.filter(t => (PLAN_PRICE_XAF[t.plan] ?? 0) > 0)

  let created = 0
  let skipped = 0

  for (const tenant of billable) {
    const invNo = invoiceNumber(tenant.slug, now)

    const { rows: existing } = await globalQuery(
      `SELECT id FROM platform_invoices WHERE invoice_number = $1 LIMIT 1`,
      [invNo],
    )

    if (existing.length > 0) {
      skipped++
      continue
    }

    const amountXaf = PLAN_PRICE_XAF[tenant.plan]
    const invoiceId = uuid()

    await globalQuery(
      `INSERT INTO platform_invoices
         (id, tenant_id, invoice_number, amount_xaf, status, plan, period_start, period_end, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, NOW(), NOW())`,
      [invoiceId, tenant.id, invNo, amountXaf, tenant.plan, periodStart.toISOString(), periodEnd.toISOString(), dueDate.toISOString()],
    )

    created++
    console.log(`[billing-cron] generated invoice ${invNo} for ${tenant.slug} (₣${amountXaf})`)

    // Send invoice notification email with PDF attachment
    try {
      const pdfBuffer = await buildInvoicePDF({
        invoiceNo:   invNo,
        issuedAt:    now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        dueAt:       dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        status:      'PENDING',
        gymName:     'myfiti',
        gymEmail:    'billing@myfiti.app',
        memberName:  tenant.owner_name,
        memberEmail: tenant.owner_email,
        currency:    'XAF',
        subtotal:    amountXaf,
        total:       amountXaf,
        membershipCard: false,
        items: [{
          description: `${PLAN_LABEL[tenant.plan] ?? tenant.plan} Plan — Monthly Subscription`,
          subtitle:    `${periodStart.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })} – ${periodEnd.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          qty:         1,
          unitPrice:   amountXaf,
          total:       amountXaf,
        }],
        qrContent: `myfiti:invoice:${invNo}`,
      })

      await sendInvoiceNotificationEmail({
        to:          { email: tenant.owner_email, name: tenant.owner_name },
        invoiceId,
        invoiceNumber: invNo,
        planLabel:   PLAN_LABEL[tenant.plan] ?? tenant.plan,
        amountXaf,
        periodStart,
        periodEnd,
        dueDate,
        pdfBuffer,
      })

      console.log(`[billing-cron] invoice email sent → ${tenant.owner_email}`)
    } catch (emailErr) {
      // Email failure must not block invoice creation
      console.error(`[billing-cron] email failed for ${tenant.slug}:`, emailErr)
    }
  }

  console.log(`[billing-cron] invoice generation: ${created} created, ${skipped} already existed`)
  return { created, skipped }
}

// ─── Job 2: Mark overdue invoices ────────────────────────────────────────────
// Flips pending invoices whose due_date has passed to 'overdue'.
// Runs daily — safe to run multiple times.

export async function markOverdueInvoices(): Promise<number> {
  const { rows } = await globalQuery<{ id: string; invoice_number: string; tenant_id: string }>(
    `UPDATE platform_invoices
     SET status = 'overdue', updated_at = NOW()
     WHERE status = 'pending'
       AND due_date < NOW()
     RETURNING id, invoice_number, tenant_id`,
  )

  if (rows.length > 0) {
    console.log(`[billing-cron] marked ${rows.length} invoice(s) overdue: ${rows.map(r => r.invoice_number).join(', ')}`)
  }

  return rows.length
}

// ─── Job 3: Trial lifecycle ───────────────────────────────────────────────────
// Sends a 7-day warning email, then transitions trialing → past_due when the
// trial has expired. Uses a 6h window so the warning fires once per run cycle.

export async function processTrialLifecycle(): Promise<void> {
  // ── 7-day warning (fires once: within a 6h window of exactly 7 days before expiry)
  const { rows: warnTargets } = await globalQuery<{
    id: string; slug: string; owner_email: string; owner_name: string; trial_ends_at: string
  }>(
    `SELECT id, slug, owner_email, owner_name, trial_ends_at::text
     FROM tenants
     WHERE status = 'trialing'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at BETWEEN NOW() + INTERVAL '6 days 18 hours'
                              AND NOW() + INTERVAL '7 days 6 hours'`,
  )

  for (const t of warnTargets) {
    try {
      await sendTrialEndingEmail({ email: t.owner_email, name: t.owner_name }, t.slug, t.trial_ends_at)
      console.log(`[billing-cron] trial warning email sent → ${t.owner_email}`)
    } catch (err) {
      console.error(`[billing-cron] trial warning email failed for ${t.slug}:`, err)
    }
  }

  // ── Trial expired → past_due
  const { rows: expired } = await globalQuery<{
    id: string; slug: string; owner_email: string; owner_name: string
  }>(
    `UPDATE tenants
     SET status = 'past_due', updated_at = NOW()
     WHERE status = 'trialing'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at < NOW()
     RETURNING id, slug, owner_email, owner_name`,
  )

  for (const t of expired) {
    console.log(`[billing-cron] trial expired → past_due: ${t.slug}`)
    try {
      await sendTrialExpiredEmail({ email: t.owner_email, name: t.owner_name }, t.slug)
    } catch (err) {
      console.error(`[billing-cron] trial expired email failed for ${t.slug}:`, err)
    }
  }
}

// ─── Job 4: Overdue invoice → tenant access lifecycle ────────────────────────
// active + overdue invoice past grace period → past_due
// past_due for > 7 days (no payment) → suspended

export async function processOverdueLifecycle(): Promise<void> {
  // ── Step 1: active tenants with overdue invoice past their grace period → past_due
  const { rows: pastDue } = await globalQuery<{
    id: string; slug: string; owner_email: string; owner_name: string
  }>(
    `UPDATE tenants t
     SET status = 'past_due', updated_at = NOW()
     WHERE t.status = 'active'
       AND EXISTS (
         SELECT 1 FROM platform_invoices pi
         WHERE pi.tenant_id = t.id
           AND pi.status = 'overdue'
           AND pi.due_date < NOW() - (t.grace_period_days || ' days')::interval
       )
     RETURNING id, slug, owner_email, owner_name`,
  )

  for (const t of pastDue) {
    console.log(`[billing-cron] overdue invoice past grace → past_due: ${t.slug}`)
  }

  // ── Step 2: past_due tenants with no payment for > 7 additional days → suspended
  const { rows: suspended } = await globalQuery<{
    id: string; slug: string; owner_email: string; owner_name: string
  }>(
    `UPDATE tenants
     SET status = 'suspended', updated_at = NOW()
     WHERE status = 'past_due'
       AND updated_at < NOW() - INTERVAL '7 days'
     RETURNING id, slug, owner_email, owner_name`,
  )

  for (const t of suspended) {
    console.log(`[billing-cron] past_due > 7 days → suspended: ${t.slug}`)
  }
}

// ─── Job 5: Renewal reminders ─────────────────────────────────────────────────
// Sends a reminder email 7 days before subscription_renewal_at.
// Uses a 6h window to fire once per cycle without duplicate sends.

export async function processRenewalReminders(): Promise<void> {
  const { rows } = await globalQuery<{
    id: string; slug: string; plan: string; owner_email: string; owner_name: string
    subscription_renewal_at: string
  }>(
    `SELECT id, slug, plan, owner_email, owner_name, subscription_renewal_at::text
     FROM tenants
     WHERE status = 'active'
       AND subscription_renewal_at IS NOT NULL
       AND subscription_renewal_at BETWEEN NOW() + INTERVAL '6 days 18 hours'
                                       AND NOW() + INTERVAL '7 days 6 hours'`,
  )

  for (const t of rows) {
    const planLabel  = PLAN_LABEL[t.plan] ?? t.plan
    const amountXaf  = PLAN_PRICE_XAF[t.plan] ?? 0
    if (amountXaf === 0) continue  // skip free plan

    try {
      await sendRenewalReminderEmail(
        { email: t.owner_email, name: t.owner_name },
        t.slug,
        t.subscription_renewal_at,
        planLabel,
        amountXaf,
      )
      console.log(`[billing-cron] renewal reminder sent → ${t.owner_email} (${t.slug}, renews ${t.subscription_renewal_at})`)
    } catch (err) {
      console.error(`[billing-cron] renewal reminder email failed for ${t.slug}:`, err)
    }
  }
}

// ─── Hybrid scheduler ────────────────────────────────────────────────────────

let lastGenerationMonth = -1  // track which month we last auto-generated

function isFirstOfMonth(): boolean {
  return new Date().getDate() === 1
}

async function billingTick() {
  const now = new Date()
  const currentMonth = now.getFullYear() * 100 + now.getMonth()

  // Auto-generate once per month on the 1st
  if (isFirstOfMonth() && lastGenerationMonth !== currentMonth) {
    console.log('[billing-cron] 1st of month detected — auto-generating invoices')
    try {
      await generateMonthlyInvoices()
      lastGenerationMonth = currentMonth
    } catch (err) {
      console.error('[billing-cron] invoice generation error:', err)
      // Do not update lastGenerationMonth so it retries on the next tick
    }
  }

  // Mark overdue daily (every tick, the UPDATE is a no-op if nothing is past-due)
  try {
    await markOverdueInvoices()
  } catch (err) {
    console.error('[billing-cron] overdue check error:', err)
  }

  // Trial lifecycle: send 7-day warning, expire trialing tenants
  try {
    await processTrialLifecycle()
  } catch (err) {
    console.error('[billing-cron] trial lifecycle error:', err)
  }

  // Overdue invoice → past_due → suspended lifecycle
  try {
    await processOverdueLifecycle()
  } catch (err) {
    console.error('[billing-cron] overdue lifecycle error:', err)
  }

  // Renewal reminders: 7 days before subscription_renewal_at
  try {
    await processRenewalReminders()
  } catch (err) {
    console.error('[billing-cron] renewal reminder error:', err)
  }
}

const TICK_INTERVAL = 6 * 60 * 60 * 1000  // every 6 hours

export function startBillingCron() {
  console.log('[billing-cron] started — checks every 6h (auto-generates on the 1st, marks overdue daily)')

  // Initial run on server start (catches up if server was down on the 1st)
  billingTick().catch(err => console.error('[billing-cron] initial tick error:', err))

  setInterval(() => {
    billingTick().catch(err => console.error('[billing-cron] tick error:', err))
  }, TICK_INTERVAL)
}
