import { Router } from 'express'
import crypto from 'crypto'
import { v4 as uuid } from 'uuid'
import Expo from 'expo-server-sdk'
import { db, globalQuery, tenantQuery, globalSchema, eq } from '../db/client.js'
import { paymentQueue } from '../jobs/index.js'
import { invalidateSubscriptionCache } from '../lib/redis.js'
import { buildInvoicePDF } from '../lib/pdf.js'
import { sendPaymentReceiptEmail } from '../lib/email.js'
import { decryptSecret } from '../lib/crypto.js'
import { logFinancialEvent } from '../lib/audit.js'

const expo = new Expo()

export const webhooksRouter = Router()

// ─── Tranzak webhook auth verification ───────────────────────────────────────
// Tranzak sends an `authKey` field inside the JSON payload body.
// Compare it with your stored webhook secret (simple equality, not HMAC).

function verifyTranzakAuthKey(authKey: string | undefined, secret: string): boolean {
  if (!authKey) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(authKey), Buffer.from(secret))
  } catch {
    return false
  }
}

// ─── POST /api/webhooks/tranzak ───────────────────────────────────────────────
// Receives payment status updates from Tranzak for both member payments
// and tenant billing payments.

webhooksRouter.post('/tranzak', async (req, res) => {
  // Raw body is a Buffer (set by express.raw in index.ts)
  const rawBody = req.body as Buffer

  // Parse body
  let payload: TranzakWebhookPayload
  try {
    payload = JSON.parse(rawBody.toString()) as TranzakWebhookPayload
  } catch {
    return res.status(400).json({ error: 'invalid_json' })
  }

  // Official Tranzak webhook structure:
  // { eventType: "REQUEST.COMPLETED", resourceId, authKey, resource: { mchTransactionRef, status, amount, ... } }
  const resource = payload.resource
  if (!resource) return res.status(400).json({ error: 'missing_resource' })

  const merchantTransactionId = resource.mchTransactionRef
  const status      = resource.status
  const amount      = resource.amount
  const currencyCode= resource.currencyCode
  const completedAt = resource.transactionTime ?? null

  if (!merchantTransactionId) {
    return res.status(400).json({ error: 'missing_mchTransactionRef' })
  }

  // Context comes from either:
  //  a) query params embedded in callbackUrl  (?ctx=daypass&tenant=korafit&id=xxx)
  //  b) mchTransactionRef prefix fallback
  const qCtx    = req.query.ctx    as string | undefined
  const qTenant = req.query.tenant as string | undefined
  const qId     = req.query.id     as string | undefined

  const context = (qCtx ?? (
    merchantTransactionId.startsWith('mem-') ? 'member'
    : merchantTransactionId.startsWith('dp-')  ? 'daypass'
    : merchantTransactionId.startsWith('ten-') ? 'tenant'
    : merchantTransactionId.startsWith('wlt-') ? 'wallet'
    : merchantTransactionId.startsWith('csh-') ? 'cashout'
    : 'unknown'
  )) as 'member' | 'daypass' | 'tenant' | 'wallet' | 'cashout' | 'unknown'

  if (context === 'unknown') {
    return res.status(200).json({ ok: true, ignored: true })
  }

  // ── Verify authKey ────────────────────────────────────────────────────────
  // Tranzak sends an authKey string field in the payload body (not an HMAC header).
  let webhookSecret: string | undefined

  if (context === 'tenant') {
    webhookSecret = process.env.TRANZAK_WEBHOOK_SECRET
  } else if (qTenant) {
    const { rows } = await globalQuery<{ tranzak_app_secret: string }>(
      `SELECT tranzak_app_secret FROM tenants WHERE slug = $1 LIMIT 1`,
      [qTenant],
    )
    // M1: decrypt secret if stored encrypted (AES-256-GCM via encryptSecret())
    const raw = rows[0]?.tranzak_app_secret
    webhookSecret = raw ? decryptSecret(raw) : process.env.TRANZAK_WEBHOOK_SECRET
  }

  // C1: auth is ALWAYS required — never skip if secret is not configured
  if (!webhookSecret) {
    console.error('[webhooks/tranzak] webhook secret not configured — rejecting unauthenticated request')
    return res.status(503).json({ error: 'webhook_not_configured' })
  }
  if (!verifyTranzakAuthKey(payload.authKey, webhookSecret)) {
    console.warn('[webhooks/tranzak] authKey mismatch for', merchantTransactionId)
    return res.status(401).json({ error: 'invalid_authKey' })
  }

  // ── C2: Atomic idempotency via UNIQUE INDEX on transaction_ref ───────────
  // INSERT … ON CONFLICT DO NOTHING is atomic — no TOCTOU race possible.
  // The unique index was added in migrateGlobalSchema().
  const eventId = uuid()
  const { rows: insertedRows } = await globalQuery<{ id: string }>(
    `INSERT INTO webhook_events (id, provider, event_type, payload, status, transaction_ref, created_at)
     VALUES ($1, 'tranzak', $2, $3, 'pending', $4, NOW())
     ON CONFLICT (transaction_ref) DO NOTHING
     RETURNING id`,
    [eventId, `payment.${status.toLowerCase()}`, JSON.stringify(payload), merchantTransactionId],
  )

  if (insertedRows.length === 0) {
    // Duplicate delivery — safely ignored
    return res.status(200).json({ ok: true, duplicate: true })
  }

  // Derive context from query params (embedded in callbackUrl) or fall back to mchTransactionRef prefix
  const contextData = {
    tenantSlug: qTenant ?? '',
    resourceId: qId     ?? '',
  }

  // ── Cashout payouts must handle both success AND failure (for reversal) ────
  // Process cashout before the SUCCESSFUL-only guard below.
  if (context === 'cashout') {
    try {
      await handleWalletCashout({ merchantTransactionId, contextData, status })
      await globalQuery(`UPDATE webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`, [eventId])
    } catch (err) {
      console.error('[webhooks/tranzak] cashout processing error:', err)
      await globalQuery(`UPDATE webhook_events SET status = 'failed' WHERE id = $1`, [eventId])
    }
    return res.status(200).json({ ok: true })
  }

  // ── Only act on successful payments (for all other contexts) ─────────────
  if (status !== 'SUCCESSFUL') {
    await globalQuery(`UPDATE webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`, [eventId])
    return res.status(200).json({ ok: true })
  }

  // M4: audit every confirmed incoming payment before processing
  if (qTenant) {
    void logFinancialEvent({
      tenantSlug: qTenant,
      actorId:    'webhook:tranzak',
      action:     'webhook.payment.received',
      amount,
      currency:   currencyCode,
      reference:  merchantTransactionId,
      metadata:   { context, eventId },
    })
  }

  try {
    if (context === 'member') {
      await handleMemberPayment({ merchantTransactionId, amount, currencyCode, completedAt, contextData, eventId })
    } else if (context === 'daypass') {
      await handleDayPassPayment({ merchantTransactionId, amount, currencyCode, completedAt, contextData, eventId })
    } else if (context === 'tenant') {
      await handleTenantPayment({ merchantTransactionId, amount, currencyCode, completedAt, contextData, eventId })
    } else if (context === 'wallet') {
      await handleWalletTopup({ merchantTransactionId, amount, currencyCode, completedAt, contextData })
    }

    await globalQuery(`UPDATE webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`, [eventId])
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[webhooks/tranzak] processing error:', err)
    await globalQuery(`UPDATE webhook_events SET status = 'failed' WHERE id = $1`, [eventId])
    res.status(500).json({ error: 'processing_failed' })
  }
})

// ─── Handler: Member subscription payment ────────────────────────────────────

async function handleMemberPayment(args: {
  merchantTransactionId: string
  amount: number
  currencyCode: string
  completedAt: string | null
  contextData: { tenantSlug: string; resourceId: string }
  eventId: string
}) {
  const { merchantTransactionId, amount, currencyCode, completedAt, contextData } = args
  // tenantSlug + paymentId come from callbackUrl query params (set at payment creation time)
  const tenantSlug = contextData.tenantSlug || ''
  const paymentId  = contextData.resourceId || merchantTransactionId.replace('mem-', '')

  // Look up member from the payment record (we don't receive member_id from Tranzak)
  const { rows: payRows } = await tenantQuery<{ member_id: string; subscription_id: string | null }>(
    tenantSlug,
    `SELECT member_id, subscription_id FROM payments WHERE id = $1 LIMIT 1`,
    [paymentId],
  )
  const memberId       = payRows[0]?.member_id ?? ''
  const subscriptionId = payRows[0]?.subscription_id ?? undefined

  if (!tenantSlug || !memberId) {
    throw new Error(`[member-payment] could not resolve tenant or member for ref: ${merchantTransactionId}`)
  }

  // Upsert payment record as completed
  await tenantQuery(
    tenantSlug,
    `INSERT INTO payments (id, member_id, subscription_id, amount, currency, provider, tranzak_ref, status, payment_type, paid_at, created_at)
     VALUES ($1, $2, $3, $4, $5, 'tranzak', $6, 'completed', 'subscription', $7, NOW())
     ON CONFLICT (id) DO UPDATE SET status = 'completed', tranzak_ref = $6, paid_at = $7`,
    [
      paymentId,
      memberId,
      subscriptionId ?? null,
      amount,
      currencyCode,
      merchantTransactionId,
      completedAt ?? new Date().toISOString(),
    ],
  )

  // Activate subscription if pending
  if (subscriptionId) {
    await tenantQuery(
      tenantSlug,
      `UPDATE subscriptions SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [subscriptionId],
    )

    // Fetch tenant id for cache invalidation
    const { rows } = await globalQuery<{ id: string }>(`SELECT id FROM tenants WHERE slug = $1 LIMIT 1`, [tenantSlug])
    const tenantId = rows[0]?.id
    if (tenantId) await invalidateSubscriptionCache(tenantId, memberId)
  }

  // Enqueue email receipt
  await paymentQueue.add('member-payment-receipt', {
    tenantSlug,
    paymentId,
    memberId,
    subscriptionId,
    amount,
    currency: currencyCode,
    provider: 'tranzak',
    providerRef: merchantTransactionId,
    paidAt: completedAt ?? new Date().toISOString(),
  })

  // ── Referral reward: fire once on first successful payment ──────────────
  await grantReferralRewardIfEligible(tenantSlug, memberId)

  console.log(`[webhooks/tranzak] member payment confirmed: ${merchantTransactionId}`)
}

// ─── Handler: Day pass payment ────────────────────────────────────────────────

async function handleDayPassPayment(args: {
  merchantTransactionId: string
  amount: number
  currencyCode: string
  completedAt: string | null
  contextData: { tenantSlug: string; resourceId: string }
  eventId: string
}) {
  const { merchantTransactionId, amount, currencyCode, completedAt, contextData } = args
  const tenantSlug = contextData.tenantSlug || ''
  const dayPassId  = contextData.resourceId || merchantTransactionId.replace('dp-', '')
  const guestEmail: string | undefined = undefined  // no longer available from Tranzak (was in customData)

  if (!tenantSlug) throw new Error(`[day-pass-payment] missing tenant slug for ref: ${merchantTransactionId}`)

  // Mark day pass as paid
  await tenantQuery(
    tenantSlug,
    `UPDATE day_passes SET payment_ref = $1, status = 'active' WHERE id = $2`,
    [merchantTransactionId, dayPassId],
  )

  // Fetch day pass details for receipt
  const { rows } = await tenantQuery<{
    guest_name: string; guest_phone: string; pass_type: string
    valid_date: string; amount: number; currency: string
    payment_method: string; qr_token: string; created_at: string
  }>(
    tenantSlug,
    `SELECT guest_name, guest_phone, pass_type, valid_date, amount, currency, payment_method, qr_token, created_at FROM day_passes WHERE id = $1 LIMIT 1`,
    [dayPassId],
  )

  const pass = rows[0]
  if (pass && guestEmail) {
    await paymentQueue.add('day-pass-receipt', {
      tenantSlug,
      dayPassId,
      guestName: pass.guest_name,
      guestPhone: pass.guest_phone,
      guestEmail,
      passType: pass.pass_type,
      validDate: pass.valid_date,
      amount: pass.amount ?? amount,
      currency: pass.currency ?? currencyCode,
      paymentMethod: pass.payment_method,
      paymentRef: merchantTransactionId,
      qrToken: pass.qr_token,
      issuedAt: completedAt ?? pass.created_at,
    })
  }

  console.log(`[webhooks/tranzak] day pass payment confirmed: ${merchantTransactionId}`)
}

// ─── Handler: Tenant billing payment (gym pays myfiti) ───────────────────────

const PLAN_LABELS: Record<string, string> = {
  starter:    'myfiti Starter Plan',
  growth:     'myfiti Growth Plan',
  growth_plus:'myfiti Growth+ Plan',
  enterprise: 'myfiti Enterprise Plan',
}

const PLAN_PRICES: Record<string, number> = {
  starter: 0, growth: 9900, growth_plus: 19900, enterprise: 49900,
}

async function handleTenantPayment(args: {
  merchantTransactionId: string
  amount: number
  currencyCode: string
  completedAt: string | null
  contextData: { tenantSlug: string; resourceId: string }
  eventId: string
}) {
  const { merchantTransactionId, amount, currencyCode, completedAt } = args
  // For tenant billing, mchTransactionRef = ten-{tenantId}
  const tenantId = merchantTransactionId.replace('ten-', '')

  if (!tenantId) throw new Error('[tenant-payment] could not extract tenantId from mchTransactionRef')

  const paidAtDate = completedAt ? new Date(completedAt) : new Date()
  const paidAt     = paidAtDate.toISOString()
  const renewalAt  = new Date(paidAtDate)
  renewalAt.setMonth(renewalAt.getMonth() + 1)

  // Activate tenant + record renewal date
  await db.update(globalSchema.tenants)
    .set({ status: 'active', subscription_renewal_at: renewalAt, updated_at: new Date() } as Record<string, unknown>)
    .where(eq(globalSchema.tenants.id, tenantId))

  // Mark matching platform invoice as paid (current month, this tenant)
  await globalQuery(
    `UPDATE platform_invoices
     SET status = 'paid', paid_at = $1, updated_at = NOW()
     WHERE tenant_id = $2
       AND status IN ('pending', 'overdue')
       AND period_start >= date_trunc('month', NOW())
       AND period_start <  date_trunc('month', NOW()) + INTERVAL '1 month'`,
    [paidAt, tenantId],
  )

  // Fetch tenant details for invoice
  const { rows } = await globalQuery<{
    name: string; owner_email: string; owner_name: string
    plan: string; currency: string; account_number: string | null
  }>(
    `SELECT name, owner_email, owner_name, plan, currency, account_number FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId],
  )
  const tenant = rows[0]
  if (!tenant?.owner_email) {
    console.warn(`[tenant-payment] no owner_email for tenant ${tenantId}, skipping invoice`)
    return
  }

  const invNo     = `MYFITI-${new Date().getFullYear()}-${merchantTransactionId.replace('ten-', '').slice(0, 8).toUpperCase()}`
  const planLabel = PLAN_LABELS[tenant.plan] ?? `myfiti ${tenant.plan} Plan`
  const planPrice = amount ? amount : (PLAN_PRICES[tenant.plan] ?? 0)
  const currency  = currencyCode || tenant.currency

  const pdfBuffer = await buildInvoicePDF({
    invoiceNo: invNo,
    issuedAt:  paidAt,
    dueAt:     paidAt,
    status:    'PAID',

    gymName:    'myfiti',
    gymAddress: 'Douala, Cameroon',
    gymEmail:   'billing@myfiti.app',

    memberName:  tenant.owner_name,
    memberNo:    tenant.account_number ?? undefined,
    memberEmail: tenant.owner_email,

    items: [{
      description: planLabel,
      qty:         1,
      unitPrice:   planPrice,
      total:       planPrice,
    }],

    currency,
    subtotal: planPrice,
    total:    planPrice,

    paymentMethod: 'mtn_momo',
    paymentRef:    merchantTransactionId,
    paidAt,

    qrContent: `myfiti:invoice:${invNo}`,
  })

  await sendPaymentReceiptEmail({
    to:          { email: tenant.owner_email, name: tenant.owner_name },
    gymName:     'myfiti',
    amount:      planPrice,
    currency,
    description: planLabel,
    receiptNo:   invNo,
    pdfBuffer,
    pdfFileName: `${invNo}.pdf`,
    isInvoice:   true,
  })

  console.log(`[webhooks/tranzak] tenant billing invoice sent → ${tenant.owner_email} (${invNo})`)
}

// ─── Referral reward ──────────────────────────────────────────────────────────
// Called after first successful member payment. If the member was referred,
// credits the referrer's wallet and marks the referral as converted.

const REFERRAL_REWARD_XAF = 500 // wallet credit granted to referrer

async function grantReferralRewardIfEligible(tenantSlug: string, memberId: string) {
  try {
    // Only fire on first-ever payment for this member
    const { rows: paymentCount } = await tenantQuery<{ count: string }>(
      tenantSlug,
      `SELECT COUNT(*)::TEXT AS count FROM payments WHERE member_id = $1 AND status = 'completed'`,
      [memberId],
    )
    if (parseInt(paymentCount[0]?.count ?? '0') !== 1) return // not first payment

    // L1: Atomic referral gate — UPDATE WHERE status = 'pending' RETURNING id.
    // Only one concurrent call can win this UPDATE; all others see 0 rows and exit.
    // This prevents double-reward even if the webhook fires multiple times in quick succession.
    const { rows: claimedRows } = await tenantQuery<{ id: string; referrer_id: string }>(
      tenantSlug,
      `UPDATE referrals
       SET status = 'converted', converted_at = NOW(),
           reward_amount = $1, reward_applied_at = NOW()
       WHERE referred_id = $2 AND status = 'pending'
       RETURNING id, referrer_id`,
      [REFERRAL_REWARD_XAF, memberId],
    )
    if (!claimedRows[0]) return  // no pending referral, or already converted

    const { id: referralId, referrer_id: referrerId } = claimedRows[0]

    // Get gym currency
    const { rows: gymRows } = await tenantQuery<{ currency: string }>(
      tenantSlug, `SELECT currency FROM gym_settings LIMIT 1`,
    )
    const currency = gymRows[0]?.currency ?? 'XAF'

    // Ensure referrer has a wallet and credit it
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_accounts (id, member_id, balance, currency)
       VALUES ($1, $2, 0, $3) ON CONFLICT (member_id) DO NOTHING`,
      [uuid(), referrerId, currency],
    )
    await tenantQuery(
      tenantSlug,
      `UPDATE wallet_accounts SET balance = balance + $1, updated_at = NOW() WHERE member_id = $2`,
      [REFERRAL_REWARD_XAF, referrerId],
    )

    // Record wallet transaction
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status, created_at)
       VALUES ($1, $2, 'referral_credit', $3, 'Referral reward — friend joined', 'completed', NOW())`,
      [uuid(), referrerId, REFERRAL_REWARD_XAF],
    )

    // M4: audit referral reward
    void logFinancialEvent({
      tenantSlug,
      actorId:   'system',
      action:    'referral.reward.granted',
      amount:    REFERRAL_REWARD_XAF,
      currency,
      reference: referralId,
      metadata:  { referrerId, referredId: memberId },
    })

    // Push notification to referrer
    const { rows: referrerRows } = await tenantQuery<{ push_token: string | null; name: string }>(
      tenantSlug,
      `SELECT push_token, name FROM members WHERE id = $1 LIMIT 1`,
      [referrerId],
    )
    const referrer = referrerRows[0]
    if (referrer?.push_token && Expo.isExpoPushToken(referrer.push_token)) {
      await expo.sendPushNotificationsAsync([{
        to: referrer.push_token,
        sound: 'default',
        title: 'Referral reward earned!',
        body: `${currency} ${REFERRAL_REWARD_XAF.toLocaleString()} added to your wallet — your friend just joined.`,
        data: { type: 'referral_reward' },
      }]).catch(() => {})
    }

    console.log(`[referral] reward granted: ${REFERRAL_REWARD_XAF} ${currency} → referrer ${referrerId}`)
  } catch (err) {
    console.warn('[referral] reward failed (non-fatal):', err)
  }
}

// ─── Handler: Wallet top-up ───────────────────────────────────────────────────

async function handleWalletTopup(args: {
  merchantTransactionId: string
  amount: number
  currencyCode: string
  completedAt: string | null
  contextData: { tenantSlug: string; resourceId: string }
}) {
  const { merchantTransactionId, amount, currencyCode, contextData } = args
  const tenantSlug = contextData.tenantSlug

  if (!tenantSlug) {
    throw new Error(`[wallet-topup] missing tenant for ref: ${merchantTransactionId}`)
  }

  // H4: Look up member and expected amount from DB — do NOT trust req.query.id.
  // The tranzak_ref is the only anchor we can trust (it was set by our own code at topup initiation).
  const { rows: txRows } = await tenantQuery<{ id: string; member_id: string; expected_amount: string | null }>(
    tenantSlug,
    `SELECT id, member_id, expected_amount FROM wallet_transactions
     WHERE tranzak_ref = $1 AND status = 'pending'
     LIMIT 1`,
    [merchantTransactionId],
  )

  if (txRows.length === 0) {
    console.warn(`[wallet-topup] no pending tx found for ref ${merchantTransactionId}`)
    return
  }

  const { id: txId, member_id: memberId, expected_amount: rawExpected } = txRows[0]

  // H3: Verify received amount matches what we originally requested.
  // Reject if webhook amount differs by more than 1 XAF (floating point tolerance).
  const expectedAmount = rawExpected !== null ? parseFloat(rawExpected) : null
  if (expectedAmount !== null && Math.abs(amount - expectedAmount) > 1) {
    console.error(
      `[wallet-topup] AMOUNT MISMATCH for ref ${merchantTransactionId}: ` +
      `expected=${expectedAmount}, received=${amount}. Possible fraud — rejecting.`
    )
    await tenantQuery(tenantSlug, `UPDATE wallet_transactions SET status = 'failed' WHERE id = $1`, [txId])
    throw new Error(`Amount mismatch: expected ${expectedAmount}, got ${amount}`)
  }

  // Credit the wallet balance (atomic)
  await tenantQuery(
    tenantSlug,
    `UPDATE wallet_accounts
     SET balance = balance + $1, updated_at = NOW()
     WHERE member_id = $2`,
    [amount, memberId],
  )

  // Mark transaction completed
  await tenantQuery(
    tenantSlug,
    `UPDATE wallet_transactions SET status = 'completed' WHERE id = $1`,
    [txId],
  )

  // M4: Financial audit log
  void logFinancialEvent({
    tenantSlug,
    actorId:   memberId,
    action:    'wallet.topup.confirmed',
    amount,
    currency:  currencyCode,
    reference: merchantTransactionId,
    metadata:  { txId },
  })

  // Send push notification
  const { rows: memberRows } = await tenantQuery<{ push_token: string | null; name: string }>(
    tenantSlug,
    `SELECT push_token, name FROM members WHERE id = $1 LIMIT 1`,
    [memberId],
  )

  const member = memberRows[0]
  if (member?.push_token && Expo.isExpoPushToken(member.push_token)) {
    try {
      await expo.sendPushNotificationsAsync([{
        to: member.push_token,
        sound: 'default',
        title: 'Wallet topped up',
        body: `${currencyCode} ${amount.toLocaleString('fr-CM')} added to your gym wallet.`,
        data: { type: 'wallet_topup' },
      }])
    } catch { /* non-fatal */ }
  }

  console.log(`[webhooks/tranzak] wallet top-up confirmed: ${amount} ${currencyCode} → member ${memberId}`)
}

// ─── Handler: Wallet cashout (Tranzak payout to mobile) ──────────────────────
// On SUCCESSFUL: mark the pending cashout transaction as completed.
// On FAILED/CANCELLED: reverse the debit — refund the wallet balance.

async function handleWalletCashout(args: {
  merchantTransactionId: string
  contextData: { tenantSlug: string; resourceId: string }
  status: string
}) {
  const { merchantTransactionId, contextData, status } = args
  const tenantSlug = contextData.tenantSlug

  if (!tenantSlug) {
    throw new Error(`[wallet-cashout] missing tenant for ref: ${merchantTransactionId}`)
  }

  // H4: Look up member from stored transaction — do NOT trust contextData.resourceId (req.query.id).
  const { rows: txRows } = await tenantQuery<{ id: string; member_id: string; amount: string }>(
    tenantSlug,
    `SELECT id, member_id, amount FROM wallet_transactions
     WHERE tranzak_ref = $1 AND type = 'cashout' AND status = 'pending'
     LIMIT 1`,
    [merchantTransactionId],
  )

  if (txRows.length === 0) {
    console.warn(`[wallet-cashout] no pending cashout tx for ref ${merchantTransactionId}`)
    return
  }

  const { id: txId, member_id: memberId, amount: rawAmount } = txRows[0]
  const amount = parseFloat(rawAmount)

  if (status === 'SUCCESSFUL') {
    // Mark transaction completed
    await tenantQuery(
      tenantSlug,
      `UPDATE wallet_transactions SET status = 'completed' WHERE id = $1`,
      [txId],
    )

    // Push confirmation
    const { rows: memberRows } = await tenantQuery<{ push_token: string | null }>(
      tenantSlug,
      `SELECT push_token FROM members WHERE id = $1 LIMIT 1`,
      [memberId],
    )
    const pushToken = memberRows[0]?.push_token
    if (pushToken && Expo.isExpoPushToken(pushToken)) {
      await expo.sendPushNotificationsAsync([{
        to: pushToken,
        sound: 'default',
        title: 'Cashout successful',
        body: `Your withdrawal has been sent to your Mobile Money account.`,
        data: { type: 'wallet_cashout' },
      }]).catch(() => {})
    }

    // M4: audit confirmed cashout
    void logFinancialEvent({
      tenantSlug,
      actorId:   memberId,
      action:    'wallet.cashout.confirmed',
      amount,
      reference: merchantTransactionId,
      metadata:  { txId },
    })

    console.log(`[webhooks/tranzak] cashout confirmed: ref=${merchantTransactionId}`)
  } else {
    // FAILED / CANCELLED — reverse the debit
    await tenantQuery(
      tenantSlug,
      `UPDATE wallet_accounts SET balance = balance + $1, updated_at = NOW() WHERE member_id = $2`,
      [amount, memberId],
    )
    await tenantQuery(
      tenantSlug,
      `UPDATE wallet_transactions SET status = 'failed' WHERE id = $1`,
      [txId],
    )

    // Add a credit reversal entry so the member sees it in their history
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status)
       VALUES ($1, $2, 'credit', $3, 'Cashout reversed — transfer failed', 'completed')`,
      [uuid(), memberId, amount],
    )

    // M4: audit reversal
    void logFinancialEvent({
      tenantSlug,
      actorId:   memberId,
      action:    'wallet.cashout.reversed',
      amount,
      reference: merchantTransactionId,
      metadata:  { txId, failStatus: status },
    })

    console.log(`[webhooks/tranzak] cashout reversed (status=${status}): ref=${merchantTransactionId}`)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Official Tranzak webhook shape (eventType: "REQUEST.COMPLETED")
interface TranzakWebhookPayload {
  eventType:        string
  resourceId:       string
  webhookId?:       string
  appId?:           string
  authKey?:         string   // verify against your stored webhook secret
  creationDateTime?: string
  resource: {
    requestId:         string
    mchTransactionRef: string
    status:            'SUCCESSFUL' | 'FAILED' | 'CANCELLED' | 'CANCELLED_BY_PAYER' | 'PENDING' | 'PAYMENT_IN_PROGRESS' | 'PAYER_REDIRECT_REQUIRED' | string
    amount:            number
    currencyCode:      string
    transactionTime:   string | null
    transactionId?:    string
    fee?:              number
    description?:      string
    payer?:            Record<string, unknown>
    merchant?:         Record<string, unknown>
    links?:            Record<string, unknown>
  }
}
