import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import Expo from 'expo-server-sdk'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'
import { chargeMobileWallet, disburseMobile } from '../lib/tranzak.js'
import { rateLimitWallet, rateLimitWalletLookup } from '../middleware/rate-limit.js'
import { logFinancialEvent } from '../lib/audit.js'
import { redis } from '../lib/redis.js'

const expo = new Expo()

export const walletRouter = Router()

walletRouter.use(requireAuth)
walletRouter.use(requireRole('member'))

// H2: Daily spending limits (in gym currency, e.g. XAF)
const MAX_DAILY_CASHOUT  = 500_000
const MAX_DAILY_TRANSFER = 200_000

// M5: Idempotency key TTL — cache response for 24 hours
const IDEMPOTENCY_TTL = 60 * 60 * 24

/**
 * M5: Idempotency middleware for wallet mutation endpoints.
 * If the client sends an Idempotency-Key header and we've seen it before,
 * return the cached response without re-processing.
 */
async function checkIdempotency(
  req: import('express').Request,
  res: import('express').Response,
  tenantSlug: string,
  memberId: string,
): Promise<boolean> {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim()
  if (!key) return false

  const cacheKey = `idempotency:${tenantSlug}:${memberId}:${key}`

  const cached = await redis.get<string>(cacheKey).catch(() => null)
  if (cached) {
    res.status(200).json(JSON.parse(cached))
    return true  // caller should return immediately
  }

  // Attach cache key to res.locals so the route handler can store the response
  res.locals.idempotencyCacheKey = cacheKey
  return false
}

async function storeIdempotencyResponse(res: import('express').Response, body: object) {
  const cacheKey = res.locals.idempotencyCacheKey as string | undefined
  if (!cacheKey) return
  await redis.set(cacheKey, JSON.stringify(body), { ex: IDEMPOTENCY_TTL }).catch(() => {})
}

interface MemberAuth {
  sub: string
  role: 'member'
  tenant_id: string
  tenant_slug: string
}

// ─── Ensure wallet account exists for member (upsert helper) ─────────────────

async function ensureWallet(tenantSlug: string, memberId: string, currency: string) {
  await tenantQuery(
    tenantSlug,
    `INSERT INTO wallet_accounts (id, member_id, balance, currency)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (member_id) DO NOTHING`,
    [uuid(), memberId, currency],
  )
}

// ─── GET /api/member/wallet/lookup?phone=XXX ─────────────────────────────────
// Resolve a phone number to a member in the same tenant (for Send flow).

walletRouter.get('/lookup', rateLimitWalletLookup, async (req, res) => {
  try {
    const { sub: senderId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const phone = (req.query.phone as string | undefined)?.trim()

    if (!phone) return res.status(400).json({ error: 'phone is required.' })

    const { rows } = await tenantQuery<{ id: string; first_name: string; last_name: string }>(
      tenantSlug,
      `SELECT id, first_name, last_name FROM members
       WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') = REPLACE(REPLACE($1, ' ', ''), '+', '')
         AND id != $2
       LIMIT 1`,
      [phone, senderId],
    )

    if (!rows[0]) return res.status(404).json({ error: 'No member found with that number.' })

    const m = rows[0]
    res.json({ id: m.id, name: `${m.first_name} ${m.last_name}`.trim() })
  } catch (err) {
    console.error('[wallet lookup]', err)
    res.status(500).json({ error: 'Lookup failed.' })
  }
})

// ─── GET /api/member/wallet ───────────────────────────────────────────────────

walletRouter.get('/', async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    // Get gym currency
    const { rows: gymRows } = await tenantQuery<{ currency: string }>(
      tenantSlug,
      `SELECT currency FROM gym_settings LIMIT 1`,
    )
    const currency = gymRows[0]?.currency ?? 'XAF'

    await ensureWallet(tenantSlug, memberId, currency)

    const { rows: walletRows } = await tenantQuery<{ balance: string; currency: string }>(
      tenantSlug,
      `SELECT balance, currency FROM wallet_accounts WHERE member_id = $1`,
      [memberId],
    )

    const { rows: txRows } = await tenantQuery<{
      id: string; type: string; amount: string; description: string
      status: string; created_at: string
    }>(
      tenantSlug,
      `SELECT id, type, amount, description, status, created_at
       FROM wallet_transactions
       WHERE member_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [memberId],
    )

    res.json({
      balance: parseFloat(walletRows[0]?.balance ?? '0'),
      currency: walletRows[0]?.currency ?? currency,
      transactions: txRows.map(t => ({ ...t, amount: parseFloat(t.amount) })),
    })
  } catch (err) {
    console.error('[wallet GET]', err)
    res.status(500).json({ error: 'Failed to load wallet.' })
  }
})

// ─── POST /api/member/wallet/topup ───────────────────────────────────────────
// Initiates a USSD push charge. Tranzak sends a prompt to the member's phone.
// On approval, Tranzak fires the webhook which credits the wallet.

walletRouter.post('/topup', rateLimitWallet, async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { amount, phone } = req.body as { amount: number; phone: string }

    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Minimum top-up is 100.' })
    }
    if (!phone?.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' })
    }

    // M5: Idempotency check
    if (await checkIdempotency(req, res, tenantSlug, memberId)) return

    // Get gym currency
    const { rows: gymRows } = await tenantQuery<{ currency: string }>(
      tenantSlug,
      `SELECT currency FROM gym_settings LIMIT 1`,
    )
    const currency = gymRows[0]?.currency ?? 'XAF'

    await ensureWallet(tenantSlug, memberId, currency)

    const reference = `wlt-${uuid()}`
    const APP_URL   = process.env.APP_URL ?? 'https://app.myfiti.app'
    const callbackUrl = `${APP_URL}/api/webhooks/tranzak?ctx=wallet&tenant=${tenantSlug}&id=${memberId}`

    // Create pending wallet transaction first (idempotent webhook)
    // H3: Store expected_amount so the webhook can verify the received amount matches.
    const txId = uuid()
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, expected_amount, description, tranzak_ref, status)
       VALUES ($1, $2, 'topup', $3, $3, $4, $5, 'pending')`,
      [txId, memberId, amount, `Wallet top-up via Mobile Money`, reference],
    )

    // Fire USSD push — member gets a prompt on their handset
    const { requestId } = await chargeMobileWallet({
      amount,
      currency,
      phone: phone.trim(),
      reference,
      description: 'Wallet top-up — GymFlow',
      payerNote: `Add ${currency} ${amount.toLocaleString()} to your gym wallet`,
      callbackUrl,
    })

    // Store requestId so webhook can match by tranzak_ref
    await tenantQuery(
      tenantSlug,
      `UPDATE wallet_transactions SET tranzak_ref = $1 WHERE id = $2`,
      [requestId, txId],
    )

    // M4: audit initiation
    void logFinancialEvent({
      tenantSlug, actorId: memberId, action: 'wallet.topup.initiated',
      amount, currency, reference: requestId, metadata: { txId },
    })

    const body = { ok: true, requestId, reference }
    await storeIdempotencyResponse(res, body)
    res.json(body)
  } catch (err) {
    console.error('[wallet topup]', err)
    res.status(500).json({ error: 'Failed to initiate top-up. Please try again.' })
  }
})

// ─── POST /api/member/wallet/pay-subscription ─────────────────────────────────
// Debits the wallet and extends the member's active subscription by one period.

walletRouter.post('/pay-subscription', rateLimitWallet, async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth

    // M5: Idempotency check
    if (await checkIdempotency(req, res, tenantSlug, memberId)) return

    // Load wallet balance
    const { rows: walletRows } = await tenantQuery<{ id: string; balance: string; currency: string }>(
      tenantSlug,
      `SELECT id, balance, currency FROM wallet_accounts WHERE member_id = $1`,
      [memberId],
    )
    if (!walletRows[0]) {
      return res.status(400).json({ error: 'No wallet found. Top up first.' })
    }

    const balance = parseFloat(walletRows[0].balance)

    // Load active / most recent subscription with plan details
    const { rows: subRows } = await tenantQuery<{
      id: string; plan_id: string; expires_at: string; amount: string; plan_name: string; duration_days: number
    }>(
      tenantSlug,
      `SELECT s.id, s.plan_id, s.expires_at, mp.price AS amount, mp.name AS plan_name, mp.duration_days
       FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.member_id = $1
       ORDER BY s.expires_at DESC
       LIMIT 1`,
      [memberId],
    )
    if (!subRows[0]) {
      return res.status(400).json({ error: 'No subscription found to renew.' })
    }

    const sub = subRows[0]
    const amount = parseFloat(sub.amount)
    const durationDays = sub.duration_days ?? 30

    if (balance < amount) {
      return res.status(400).json({
        error: `Insufficient wallet balance. Need ${walletRows[0].currency} ${amount.toLocaleString()}, have ${walletRows[0].currency} ${balance.toLocaleString()}.`,
      })
    }

    // Atomic debit + subscription extension
    const txId = uuid()
    const now = new Date()
    const currentEnd = new Date(sub.expires_at)
    const baseDate = currentEnd > now ? currentEnd : now
    const newEndDate = new Date(baseDate)
    newEndDate.setDate(newEndDate.getDate() + durationDays)

    // Debit wallet (atomic — reject if balance would go negative)
    const { rows: debitRows } = await tenantQuery<{ balance: string }>(
      tenantSlug,
      `UPDATE wallet_accounts
       SET balance = balance - $1
       WHERE member_id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, memberId],
    )
    if (!debitRows[0]) {
      return res.status(400).json({ error: 'Insufficient balance (concurrent update detected).' })
    }

    // Record wallet transaction
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status)
       VALUES ($1, $2, 'debit', $3, $4, 'completed')`,
      [txId, memberId, amount, `Subscription renewal — ${sub.plan_name}`],
    )

    // Extend or upsert subscription
    await tenantQuery(
      tenantSlug,
      `UPDATE subscriptions
       SET started_at = CASE WHEN expires_at < NOW() THEN NOW() ELSE started_at END,
           expires_at  = $1,
           status      = 'active',
           updated_at  = NOW()
       WHERE id = $2`,
      [newEndDate.toISOString(), sub.id],
    )

    // M4: audit
    void logFinancialEvent({
      tenantSlug, actorId: memberId, action: 'wallet.pay_subscription',
      amount, currency: walletRows[0].currency, reference: txId,
      metadata: { subscriptionId: sub.id, planName: sub.plan_name },
    })

    const body = { ok: true, newBalance: parseFloat(debitRows[0].balance), newEndDate: newEndDate.toISOString() }
    await storeIdempotencyResponse(res, body)
    res.json(body)
  } catch (err) {
    console.error('[wallet pay-subscription]', err)
    res.status(500).json({ error: 'Payment failed. Please try again.' })
  }
})

// ─── POST /api/member/wallet/pay-plan ────────────────────────────────────────
// Debit the wallet and create/extend a subscription for a specific plan.
// Used from the mobile Plans screen to purchase any plan directly with wallet balance.

walletRouter.post('/pay-plan', rateLimitWallet, async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { planId } = req.body as { planId: string }

    if (!planId?.trim()) return res.status(400).json({ error: 'planId is required.' })

    // M5: Idempotency check
    if (await checkIdempotency(req, res, tenantSlug, memberId)) return

    // Load plan
    const { rows: planRows } = await tenantQuery<{
      id: string; name: string; price: string; duration_days: number
    }>(
      tenantSlug,
      `SELECT id, name, price, duration_days FROM membership_plans WHERE id = $1 AND is_active = true`,
      [planId],
    )
    if (!planRows[0]) return res.status(404).json({ error: 'Plan not found.' })
    const plan = planRows[0]
    const amount = parseFloat(plan.price)

    // Load wallet
    const { rows: walletRows } = await tenantQuery<{ balance: string; currency: string }>(
      tenantSlug,
      `SELECT balance, currency FROM wallet_accounts WHERE member_id = $1`,
      [memberId],
    )
    if (!walletRows[0]) return res.status(400).json({ error: 'No wallet found. Top up first.' })

    const currency = walletRows[0].currency

    // Atomic debit
    const { rows: debitRows } = await tenantQuery<{ balance: string }>(
      tenantSlug,
      `UPDATE wallet_accounts SET balance = balance - $1 WHERE member_id = $2 AND balance >= $1 RETURNING balance`,
      [amount, memberId],
    )
    if (!debitRows[0]) {
      return res.status(400).json({
        error: `Insufficient wallet balance. Need ${currency} ${amount.toLocaleString()}, have ${currency} ${parseFloat(walletRows[0].balance).toLocaleString()}.`,
      })
    }

    const now = new Date()
    const newEndDate = new Date(now)
    newEndDate.setDate(newEndDate.getDate() + (plan.duration_days ?? 30))

    // Update existing subscription to new plan, or create a new one
    const { rows: existingRows } = await tenantQuery<{ id: string }>(
      tenantSlug,
      `SELECT id FROM subscriptions WHERE member_id = $1 ORDER BY expires_at DESC LIMIT 1`,
      [memberId],
    )

    if (existingRows[0]) {
      await tenantQuery(
        tenantSlug,
        `UPDATE subscriptions
         SET plan_id = $1, started_at = NOW(), expires_at = $2,
             status = 'active', grace_expires_at = NULL, updated_at = NOW()
         WHERE id = $3`,
        [planId, newEndDate.toISOString(), existingRows[0].id],
      )
    } else {
      await tenantQuery(
        tenantSlug,
        `INSERT INTO subscriptions (id, member_id, plan_id, started_at, expires_at, status)
         VALUES ($1, $2, $3, NOW(), $4, 'active')`,
        [uuid(), memberId, planId, newEndDate.toISOString()],
      )
    }

    // Record wallet debit
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status)
       VALUES ($1, $2, 'debit', $3, $4, 'completed')`,
      [uuid(), memberId, amount, `Plan purchase — ${plan.name}`],
    )

    // Activate member
    await tenantQuery(tenantSlug, `UPDATE members SET status = 'active', updated_at = NOW() WHERE id = $1`, [memberId])

    // M4: audit
    void logFinancialEvent({
      tenantSlug, actorId: memberId, action: 'wallet.pay_plan',
      amount, currency, reference: planId,
      metadata: { planName: plan.name, newEndDate: newEndDate.toISOString() },
    })

    const body = { ok: true, newBalance: parseFloat(debitRows[0].balance), newEndDate: newEndDate.toISOString() }
    await storeIdempotencyResponse(res, body)
    res.json(body)
  } catch (err) {
    console.error('[wallet pay-plan]', err)
    res.status(500).json({ error: 'Payment failed. Please try again.' })
  }
})

// ─── POST /api/member/wallet/transfer ────────────────────────────────────────
// Transfers balance from the authenticated member to another member in the same gym.

walletRouter.post('/transfer', rateLimitWallet, async (req, res) => {
  try {
    const { sub: senderId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { recipientId, amount, note } = req.body as {
      recipientId: string
      amount: number
      note?: string
    }

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Minimum transfer is 1.' })
    }
    if (!recipientId?.trim()) {
      return res.status(400).json({ error: 'Recipient is required.' })
    }
    if (recipientId === senderId) {
      return res.status(400).json({ error: 'Cannot transfer to yourself.' })
    }

    // M5: Idempotency check
    if (await checkIdempotency(req, res, tenantSlug, senderId)) return

    // H2: Daily transfer limit — sum all transfers initiated today
    const { rows: dailyRows } = await tenantQuery<{ total: string }>(
      tenantSlug,
      `SELECT COALESCE(SUM(amount), 0)::TEXT AS total
       FROM wallet_transactions
       WHERE member_id = $1 AND type = 'debit'
         AND description LIKE 'Transfer to%'
         AND created_at >= date_trunc('day', NOW())`,
      [senderId],
    )
    const dailyTotal = parseFloat(dailyRows[0]?.total ?? '0')
    if (dailyTotal + amount > MAX_DAILY_TRANSFER) {
      void logFinancialEvent({ tenantSlug, actorId: senderId, action: 'daily_limit.rejected',
        amount, metadata: { type: 'transfer', dailyTotal, limit: MAX_DAILY_TRANSFER } })
      return res.status(400).json({
        error: `Daily transfer limit of ${MAX_DAILY_TRANSFER.toLocaleString()} reached. Try again tomorrow.`,
      })
    }

    // Verify recipient exists in same tenant
    const { rows: recipRows } = await tenantQuery<{ id: string; first_name: string; last_name: string }>(
      tenantSlug,
      `SELECT id, first_name, last_name FROM members WHERE id = $1`,
      [recipientId],
    )
    if (!recipRows[0]) {
      return res.status(404).json({ error: 'Recipient not found.' })
    }
    const recipientName = `${recipRows[0].first_name} ${recipRows[0].last_name}`

    // Load sender name
    const { rows: senderRows } = await tenantQuery<{ first_name: string; last_name: string }>(
      tenantSlug,
      `SELECT first_name, last_name FROM members WHERE id = $1`,
      [senderId],
    )
    const senderName = `${senderRows[0]?.first_name ?? ''} ${senderRows[0]?.last_name ?? ''}`.trim()

    // Get gym currency and ensure recipient wallet exists
    const { rows: gymRows } = await tenantQuery<{ currency: string }>(
      tenantSlug,
      `SELECT currency FROM gym_settings LIMIT 1`,
    )
    const currency = gymRows[0]?.currency ?? 'XAF'
    await ensureWallet(tenantSlug, recipientId, currency)

    // Atomic debit sender
    const { rows: debitRows } = await tenantQuery<{ balance: string }>(
      tenantSlug,
      `UPDATE wallet_accounts
       SET balance = balance - $1
       WHERE member_id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, senderId],
    )
    if (!debitRows[0]) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' })
    }

    // Credit recipient
    const { rows: creditRows } = await tenantQuery<{ balance: string }>(
      tenantSlug,
      `UPDATE wallet_accounts
       SET balance = balance + $1
       WHERE member_id = $2
       RETURNING balance`,
      [amount, recipientId],
    )

    const description = note?.trim()
      ? `Transfer from ${senderName} — ${note.trim()}`
      : `Transfer from ${senderName}`

    // Record both legs
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, description, status) VALUES
       ($1, $2, 'debit',  $3, $4, 'completed'),
       ($5, $6, 'credit', $3, $7, 'completed')`,
      [
        uuid(), senderId,    amount, `Transfer to ${recipientName}${note ? ` — ${note}` : ''}`,
        uuid(), recipientId, description,
      ],
    )

    // M4: audit
    void logFinancialEvent({
      tenantSlug, actorId: senderId, action: 'wallet.transfer',
      amount, currency, metadata: { recipientId, note },
    })

    const body = {
      ok: true,
      senderBalance:    parseFloat(debitRows[0].balance),
      recipientBalance: parseFloat(creditRows[0]?.balance ?? '0'),
      recipientName,
    }
    await storeIdempotencyResponse(res, body)
    res.json(body)

    // Push notification to recipient (fire-and-forget)
    tenantQuery<{ push_token: string | null }>(
      tenantSlug,
      `SELECT push_token FROM members WHERE id = $1 LIMIT 1`,
      [recipientId],
    ).then(({ rows }) => {
      const token = rows[0]?.push_token
      if (token && Expo.isExpoPushToken(token)) {
        expo.sendPushNotificationsAsync([{
          to: token,
          sound: 'default',
          title: 'Wallet credit received',
          body: `${senderName} sent you ${currency} ${amount.toLocaleString('fr-CM')}${note ? ` — "${note}"` : ''}.`,
          data: { type: 'wallet_transfer' },
        }]).catch(() => {})
      }
    }).catch(() => {})
  } catch (err) {
    console.error('[wallet transfer]', err)
    res.status(500).json({ error: 'Transfer failed. Please try again.' })
  }
})

// ─── POST /api/member/wallet/cashout ─────────────────────────────────────────
// Withdraws wallet balance to the member's mobile money account via Tranzak payout.
// Wallet is debited immediately; completion is confirmed via webhook.

walletRouter.post('/cashout', rateLimitWallet, async (req, res) => {
  try {
    const { sub: memberId, tenant_slug: tenantSlug } = req.auth as unknown as MemberAuth
    const { amount, phone } = req.body as { amount: number; phone: string }

    if (!amount || amount < 500) {
      return res.status(400).json({ error: 'Minimum cashout is 500.' })
    }
    if (!phone?.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' })
    }

    // M5: Idempotency check
    if (await checkIdempotency(req, res, tenantSlug, memberId)) return

    // Get gym currency
    const { rows: gymRows } = await tenantQuery<{ currency: string }>(
      tenantSlug,
      `SELECT currency FROM gym_settings LIMIT 1`,
    )
    const currency = gymRows[0]?.currency ?? 'XAF'

    // H2: Daily cashout limit
    const { rows: dailyRows } = await tenantQuery<{ total: string }>(
      tenantSlug,
      `SELECT COALESCE(SUM(amount), 0)::TEXT AS total
       FROM wallet_transactions
       WHERE member_id = $1 AND type = 'cashout'
         AND status IN ('pending', 'completed')
         AND created_at >= date_trunc('day', NOW())`,
      [memberId],
    )
    const dailyTotal = parseFloat(dailyRows[0]?.total ?? '0')
    if (dailyTotal + amount > MAX_DAILY_CASHOUT) {
      void logFinancialEvent({ tenantSlug, actorId: memberId, action: 'daily_limit.rejected',
        amount, currency, metadata: { type: 'cashout', dailyTotal, limit: MAX_DAILY_CASHOUT } })
      return res.status(400).json({
        error: `Daily cashout limit of ${currency} ${MAX_DAILY_CASHOUT.toLocaleString()} reached. Try again tomorrow.`,
      })
    }

    // Atomic debit (prevents double-spend)
    const { rows: debitRows } = await tenantQuery<{ balance: string }>(
      tenantSlug,
      `UPDATE wallet_accounts
       SET balance = balance - $1
       WHERE member_id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, memberId],
    )
    if (!debitRows[0]) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' })
    }

    const reference = `csh-${uuid()}`
    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'
    const callbackUrl = `${APP_URL}/api/webhooks/tranzak?ctx=cashout&tenant=${tenantSlug}&id=${memberId}`

    // Record as pending (webhook will mark completed or reverse)
    const txId = uuid()
    await tenantQuery(
      tenantSlug,
      `INSERT INTO wallet_transactions (id, member_id, type, amount, description, tranzak_ref, status)
       VALUES ($1, $2, 'cashout', $3, $4, $5, 'pending')`,
      [txId, memberId, amount, `Cashout to ${phone.trim()}`, reference],
    )

    let requestId: string
    try {
      const result = await disburseMobile({
        amount,
        currency,
        phone: phone.trim(),
        reference,
        description: `Wallet cashout — GymFlow`,
        callbackUrl,
      })
      requestId = result.requestId

      // Update tranzak_ref with actual requestId for webhook matching
      await tenantQuery(
        tenantSlug,
        `UPDATE wallet_transactions SET tranzak_ref = $1 WHERE id = $2`,
        [requestId, txId],
      )
    } catch (disbErr) {
      // Reverse the debit if Tranzak call fails
      await tenantQuery(
        tenantSlug,
        `UPDATE wallet_accounts SET balance = balance + $1 WHERE member_id = $2`,
        [amount, memberId],
      )
      await tenantQuery(
        tenantSlug,
        `UPDATE wallet_transactions SET status = 'failed' WHERE id = $1`,
        [txId],
      )
      throw disbErr
    }

    // M4: audit cashout initiation
    void logFinancialEvent({
      tenantSlug, actorId: memberId, action: 'wallet.cashout.initiated',
      amount, currency, reference: requestId,
      metadata: { txId, phone: phone.trim() },
    })

    const body = { ok: true, requestId, newBalance: parseFloat(debitRows[0].balance) }
    await storeIdempotencyResponse(res, body)
    res.json(body)
  } catch (err) {
    console.error('[wallet cashout]', err)
    res.status(500).json({ error: 'Cashout failed. Please try again.' })
  }
})
