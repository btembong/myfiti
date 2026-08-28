/**
 * Test script — sends 3 email types with real data
 * Run: cd apps/api && npx tsx scripts/test-emails.mts
 */
import 'dotenv/config'
import { globalQuery } from '../src/db/client.js'
import {
  sendOtpEmail,
  sendInvoiceNotificationEmail,
  sendTrialEndingEmail,
} from '../src/lib/email.js'
import { buildInvoicePDF } from '../src/lib/pdf.js'

const TO = { email: 'ndanwemarcel@gmail.com', name: 'Marcel Ndanwe' }

// ── 1. OTP email ─────────────────────────────────────────────────────────────
console.log('Sending OTP email…')
await sendOtpEmail(TO, '847 293')
console.log('  OTP sent.')

// ── 2. Invoice notification with real PDF ────────────────────────────────────
console.log('Fetching latest platform invoice…')
const { rows: invRows } = await globalQuery<{
  invoice_number: string; amount_xaf: number; plan: string; status: string
  period_start: string; period_end: string; due_date: string; paid_at: string | null
  owner_name: string; account_number: string | null
}>(
  `SELECT i.invoice_number, i.amount_xaf, i.plan, i.status,
          i.period_start, i.period_end, i.due_date, i.paid_at,
          t.owner_name, t.account_number
   FROM platform_invoices i
   JOIN tenants t ON t.id = i.tenant_id
   ORDER BY i.created_at DESC LIMIT 1`,
)

if (invRows[0]) {
  const inv = invRows[0]
  const PLAN_LABEL: Record<string, string> = {
    starter: 'Starter', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
  }
  const planLabel   = PLAN_LABEL[inv.plan] ?? inv.plan
  const periodStart = new Date(inv.period_start)
  const periodEnd   = new Date(inv.period_end)
  const dueDate     = new Date(inv.due_date)
  const fmtGB       = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const pdfBuffer = await buildInvoicePDF({
    invoiceNo:      inv.invoice_number,
    issuedAt:       fmtGB(new Date()),
    dueAt:          fmtGB(dueDate),
    status:         inv.status === 'paid' ? 'PAID' : inv.status === 'overdue' ? 'OVERDUE' : 'PENDING',
    gymName:        'myfiti',
    gymEmail:       'billing@myfiti.app',
    memberName:     inv.owner_name,
    memberNo:       inv.account_number ?? undefined,
    currency:       'XAF',
    subtotal:       inv.amount_xaf,
    total:          inv.amount_xaf,
    membershipCard: false,
    items: [{
      description: `${planLabel} Plan — Monthly Subscription`,
      subtitle:    `${fmtGB(periodStart)} – ${fmtGB(periodEnd)}`,
      qty:         1,
      unitPrice:   inv.amount_xaf,
      total:       inv.amount_xaf,
    }],
    qrContent: `myfiti:invoice:${inv.invoice_number}`,
    ...(inv.paid_at ? { paidAt: fmtGB(new Date(inv.paid_at)) } : {}),
  })

  console.log(`Sending invoice email for ${inv.invoice_number}…`)
  await sendInvoiceNotificationEmail({
    to:            TO,
    invoiceNumber: inv.invoice_number,
    planLabel,
    amountXaf:     inv.amount_xaf,
    periodStart,
    periodEnd,
    dueDate,
    pdfBuffer,
  })
  console.log('  Invoice email sent.')
} else {
  console.log('  No invoices found — skipping invoice email.')
}

// ── 3. Trial ending email ────────────────────────────────────────────────────
console.log('Sending trial ending email…')
const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
await sendTrialEndingEmail(TO, 'korafit', trialEndsAt)
console.log('  Trial ending email sent.')

console.log('\nAll 3 emails sent. Check ndanwemarcel@gmail.com.')
process.exit(0)
