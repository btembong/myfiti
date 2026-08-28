import { Worker, type Job } from 'bullmq'
import { globalQuery, tenantQuery } from '../../db/client.js'
import { sendPaymentReceiptEmail } from '../../lib/email.js'
import { buildInvoicePDF, buildReceiptPDF, type InvoiceData, type ReceiptData } from '../../lib/pdf.js'
import { sendWhatsAppDocument } from '../../lib/whatsapp.js'
import { buildConnection } from '../index.js'

const connection = buildConnection()!

async function getGymDetails(tenantSlug: string): Promise<{
  name: string; owner_email: string
  logo_url: string | null; primary_color: string | null
}> {
  const { rows } = await globalQuery<{
    name: string; owner_email: string
    logo_url: string | null; primary_color: string | null
  }>(
    `SELECT name, owner_email, logo_url, primary_color FROM tenants WHERE slug = $1 LIMIT 1`,
    [tenantSlug],
  )
  return rows[0] ?? { name: tenantSlug, owner_email: '', logo_url: null, primary_color: null }
}

// ─── Invoice number generator ─────────────────────────────────────────────────

function invoiceNo(id: string): string {
  const year = new Date().getFullYear()
  return `INV-${year}-${id.slice(0, 8).toUpperCase()}`
}

function receiptNo(id: string): string {
  return `REC-${id.slice(0, 8).toUpperCase()}`
}

function dayPassNo(id: string): string {
  return `DP-${id.slice(0, 8).toUpperCase()}`
}

function passTypeLabel(type: string): string {
  const m: Record<string, string> = {
    standard: 'Standard Day Pass', peak: 'Peak Hours Pass',
    off_peak: 'Off-Peak Pass', student: 'Student Pass', bundle_10: '10-Session Bundle',
  }
  return m[type] ?? type
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const paymentWorker = new Worker(
  'payments',
  async (job: Job) => {
    const { tenantSlug } = job.data as { tenantSlug: string }

    switch (job.name) {

      // ── Member subscription payment → enterprise invoice PDF ─────────────

      case 'member-payment-receipt': {
        const {
          paymentId, memberId, subscriptionId,
          amount, currency, provider, providerRef, paidAt,
        } = job.data as {
          paymentId: string
          memberId: string
          subscriptionId?: string
          amount: number
          currency: string
          provider: string
          providerRef?: string
          paidAt: string
        }

        const [gym, memberRows, subRows, attendanceRows] = await Promise.all([
          getGymDetails(tenantSlug),
          tenantQuery<{ name: string; email: string; phone: string }>(
            tenantSlug,
            `SELECT name, email, phone FROM members WHERE id = $1 LIMIT 1`,
            [memberId],
          ),
          subscriptionId
            ? tenantQuery<{ expires_at: string; start_date: string; plan_name: string; price: number }>(
                tenantSlug,
                `SELECT s.expires_at, s.start_date, mp.name as plan_name, mp.price
                 FROM subscriptions s
                 LEFT JOIN membership_plans mp ON mp.id = s.plan_id
                 WHERE s.id = $1 LIMIT 1`,
                [subscriptionId],
              )
            : Promise.resolve({ rows: [] as Array<{ expires_at: string; start_date: string; plan_name: string; price: number }> }),
          tenantQuery<{ visits: string }>(
            tenantSlug,
            `SELECT COUNT(*) AS visits FROM check_ins
             WHERE member_id = $1 AND checked_in_at >= date_trunc('month', NOW())`,
            [memberId],
          ),
        ])

        const member = memberRows.rows[0]
        if (!member?.email) {
          console.warn(`[payment.worker] no email for member ${memberId}, skipping`)
          return
        }

        const sub     = subRows.rows[0]
        const invNo   = invoiceNo(paymentId)
        const visits  = parseInt(attendanceRows.rows[0]?.visits ?? '0', 10)

        const startFmt = sub?.start_date
          ? new Date(sub.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : ''
        const endFmt = sub?.expires_at
          ? new Date(sub.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : ''

        // Next billing = one month after the subscription start date
        const nextBillingDate = sub?.expires_at ?? undefined

        const invoiceData: InvoiceData = {
          invoiceNo: invNo,
          issuedAt: paidAt,
          dueAt: paidAt,
          status: 'PAID',

          gymName:    gym.name,
          gymEmail:   gym.owner_email,
          gymLogoUrl: gym.logo_url ?? undefined,
          gymColor:   gym.primary_color ?? undefined,

          memberName:  member.name,
          memberEmail: member.email,
          memberPhone: member.phone,

          items: [{
            description: sub?.plan_name ?? 'Membership',
            subtitle: startFmt && endFmt ? `Valid: ${startFmt} – ${endFmt}` : undefined,
            qty: 1,
            unitPrice: amount,
            total: amount,
          }],

          currency,
          subtotal: amount,
          total: amount,

          membershipCard: !!(startFmt && endFmt),
          attendanceSummary: visits > 0 ? { visits, period: 'this month' } : undefined,

          paymentMethod: provider,
          paymentRef: providerRef,
          paidAt,

          qrContent: `myfiti:invoice:${invNo}`,
        }

        const pdfBuffer = await buildInvoicePDF(invoiceData)
        const pdfFileName = `${invNo}.pdf`

        await sendPaymentReceiptEmail({
          to: { email: member.email, name: member.name },
          gymName: gym.name,
          amount,
          currency,
          description: sub?.plan_name ?? 'Membership',
          receiptNo: invNo,
          pdfBuffer,
          pdfFileName,
          isInvoice: true,
        })

        // WhatsApp delivery (no-op if WHATSAPP_TOKEN not set)
        if (member.phone) {
          await sendWhatsAppDocument({
            to: member.phone,
            caption: `Your ${gym.name} invoice #${invNo} is ready. Amount: ${currency} ${amount.toLocaleString('en-CM')}. Thank you!`,
            filename: pdfFileName,
            pdfBuffer,
          })
        }

        console.log(`[payment.worker] invoice sent → ${member.email} (${invNo})`)
        break
      }

      // ── Day pass → enterprise receipt PDF ────────────────────────────────

      case 'day-pass-receipt': {
        const {
          dayPassId, guestName, guestPhone, guestEmail,
          passType, validDate, amount, currency, paymentMethod, paymentRef, qrToken, issuedAt,
        } = job.data as {
          dayPassId: string
          guestName: string
          guestPhone?: string
          guestEmail?: string
          passType: string
          validDate: string
          amount: number
          currency: string
          paymentMethod: string
          paymentRef?: string
          qrToken: string
          issuedAt: string
        }

        if (!guestEmail) {
          console.warn(`[payment.worker] no email for day pass ${dayPassId}, skipping`)
          return
        }

        const gym = await getGymDetails(tenantSlug)
        const recNo = dayPassNo(dayPassId)
        const validFmt = new Date(validDate).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        })

        const receiptData: ReceiptData = {
          receiptNo: recNo,
          issuedAt,
          gymName:    gym.name,
          gymLogoUrl: gym.logo_url ?? undefined,
          gymColor:   gym.primary_color ?? undefined,
          guestName,
          guestPhone,
          description: `${passTypeLabel(passType)} · Valid ${validFmt}`,
          passType,
          amount,
          currency,
          paymentMethod,
          paymentRef,
          qrContent: qrToken,
        }

        const pdfBuffer  = await buildReceiptPDF(receiptData)
        const pdfFileName = `${recNo}.pdf`

        await sendPaymentReceiptEmail({
          to: { email: guestEmail, name: guestName },
          gymName: gym.name,
          amount,
          currency,
          description: `${passTypeLabel(passType)} · Valid ${validFmt}`,
          receiptNo: recNo,
          pdfBuffer,
          pdfFileName,
          isInvoice: false,
        })

        // WhatsApp delivery (no-op if WHATSAPP_TOKEN not set)
        if (guestPhone) {
          await sendWhatsAppDocument({
            to: guestPhone,
            caption: `Your ${gym.name} day pass receipt #${recNo}. Valid: ${validFmt}. Scan the QR inside to enter. Thank you!`,
            filename: pdfFileName,
            pdfBuffer,
          })
        }

        console.log(`[payment.worker] day-pass receipt sent → ${guestEmail} (${recNo})`)
        break
      }

      default:
        console.warn(`[payment.worker] unknown job name: ${job.name}`)
    }
  },
  {
    connection,
    concurrency: 5,
  },
)

paymentWorker.on('failed', (job, err) => {
  console.error(`[payment.worker] job ${job?.id} (${job?.name}) failed:`, err)
})
