import type { PaymentLink, PaymentVerification, PaymentProviderClient } from '@gymflow/types'

const BASE_URL = process.env.TRANZAK_ENV === 'live'
  ? 'https://dsapi.tranzak.me'
  : 'https://sandbox.dsapi.tranzak.me'

async function getAuthToken(appId?: string, appKey?: string): Promise<string> {
  const resolvedAppId  = appId  ?? process.env.TRANZAK_APP_ID  ?? ''
  const resolvedAppKey = appKey ?? process.env.TRANZAK_APP_KEY ?? ''
  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: resolvedAppId, appKey: resolvedAppKey }),
  })
  const rawText = await res.text()
  if (!res.ok) throw new Error(`Tranzak auth failed: ${res.status} — ${rawText}`)
  const body = JSON.parse(rawText) as Record<string, unknown>
  // Support both { data: { token } } and { token } response shapes
  const token = (body.data as Record<string, unknown> | undefined)?.token ?? body.token
  if (!token) throw new Error(`Tranzak auth error: ${rawText}`)
  return token as string
}

async function tranzakFetch<T>(path: string, options: RequestInit = {}, creds?: { appId: string; appKey: string }): Promise<T> {
  const token = await getAuthToken(creds?.appId, creds?.appKey)
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tranzak API error [${res.status}]: ${err}`)
  }
  return res.json() as Promise<T>
}

export const tranzak: PaymentProviderClient = {
  async initializeTransaction({ amount, currency, reference, callback_url, metadata }) {
    const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'

    // Build a per-request callbackUrl so the webhook handler gets tenant context
    // even without customData (which is not a Tranzak API field).
    const ctx    = metadata?.ctx    as string | undefined
    const tenant = metadata?.tenant as string | undefined
    const id     = metadata?.id     as string | undefined
    const callbackUrl = (ctx && tenant && id)
      ? `${APP_URL}/api/webhooks/tranzak?ctx=${ctx}&tenant=${tenant}&id=${id}`
      : `${APP_URL}/api/webhooks/tranzak`

    // Response: { data: { requestId, status, links: { paymentAuthUrl }, ... }, success: true }
    const body = await tranzakFetch<{
      data: { requestId: string; links: { paymentAuthUrl: string; returnUrl?: string } }
      success: boolean
    }>(
      '/xp021/v1/request/create',
      {
        method: 'POST',
        body: JSON.stringify({
          amount,
          currencyCode: currency,
          description: `GymFlow payment — ref: ${reference}`,
          mchTransactionRef: reference,            // correct field name
          callbackUrl,                              // server webhook notification
          returnUrl: callback_url ?? `${APP_URL}/payment/success`,  // browser redirect
        }),
      }
    )

    if (!body.success) throw new Error('Tranzak create: success=false')

    return {
      payment_url:  body.data.links.paymentAuthUrl,
      reference,
      provider:     'tranzak',
      request_id:   body.data.requestId,           // store so caller can poll status
    } satisfies PaymentLink
  },

  async verifyTransaction(requestId) {
    // Fetch by Tranzak requestId (returned from create). NOT by mchTransactionRef.
    const body = await tranzakFetch<{
      data: {
        requestId: string
        status: string
        amount: number
        currencyCode: string
        transactionTime: string | null
        mchTransactionRef: string
      }
      success: boolean
    }>(`/xp021/v1/request/details?requestId=${requestId}`)

    const statusMap: Record<string, 'pending' | 'successful' | 'failed'> = {
      SUCCESSFUL:             'successful',
      FAILED:                 'failed',
      CANCELLED:              'failed',
      CANCELLED_BY_PAYER:     'failed',
      PENDING:                'pending',
      PAYMENT_IN_PROGRESS:    'pending',
      PAYER_REDIRECT_REQUIRED:'pending',
    }

    const d = body.data
    return {
      reference:  d.mchTransactionRef,
      status:     statusMap[d.status] ?? 'pending',
      amount:     d.amount,
      currency:   d.currencyCode,
      paid_at:    d.transactionTime,
      metadata:   {},
    } satisfies PaymentVerification
  },
}

// ─── Direct mobile wallet charge (S2S — no redirect required) ────────────────
// Triggers a USSD push on the payer's phone. They approve on their handset.
// Docs: POST /xp021/v1/request/create-mobile-wallet-charge
export async function chargeMobileWallet({
  amount,
  currency,
  phone,
  reference,
  description,
  payerNote,
  callbackUrl,
}: {
  amount: number
  currency: string
  phone: string           // e.g. "237655123456"
  reference: string
  description?: string
  payerNote?: string
  callbackUrl?: string
}): Promise<{ requestId: string; status: string }> {
  const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'

  const body = await tranzakFetch<{
    data: { requestId: string; status: string }
    success: boolean
    errorMsg?: string
  }>(
    '/xp021/v1/request/create-mobile-wallet-charge',
    {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currencyCode:      currency,
        description:       description ?? `GymFlow payment — ref: ${reference}`,
        payerNote:         payerNote   ?? 'Gym membership payment',
        mchTransactionRef: reference,
        mobileWalletNumber: phone,
        callbackUrl:       callbackUrl ?? `${APP_URL}/api/webhooks/tranzak`,
      }),
    },
  )

  if (!body.success) throw new Error(`Tranzak mobile charge failed: ${body.errorMsg ?? 'unknown'}`)
  return { requestId: body.data.requestId, status: body.data.status }
}

// ─── Low-level helper for tenant-specific credentials ────────────────────────
// Used by day-passes route which has per-tenant Tranzak credentials.
export { getAuthToken, tranzakFetch, BASE_URL }
