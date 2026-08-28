'use client'

import { useState, useEffect, use } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', growth_plus: 'Growth+', enterprise: 'Enterprise',
}

// Design tokens — mirror email template & superadmin palette
const C = {
  bg: '#000000', card: '#0a0a0a', border: '#1a1a1a', surface: '#0d0d0d',
  pri: '#f0f0f0', sec: '#888888', mut: '#444444', dim: '#282828',
  ok: '#4ade80', okBg: 'rgba(74,222,128,0.10)',
  err: '#f87171', errBg: 'rgba(248,113,113,0.10)',
  warn: '#fbbf24', warnBg: 'rgba(251,191,36,0.10)',
  btnBg: '#f0f0f0', btnText: '#0a0a0a',
}

interface Invoice {
  id: string
  invoice_number: string
  amount_xaf: number
  status: string
  plan: string
  period_start: string
  period_end: string
  due_date: string
  paid_at: string | null
  gym_name: string
  owner_name: string
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtAmt(n: number): string {
  return `XAF ${n.toLocaleString('fr-CM')}`
}

export default function PayInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params)

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [paying, setPaying]   = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  // Check for ?payment=success return from Tranzak
  const isSuccess = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('payment') === 'success'

  useEffect(() => {
    fetch(`${API_URL}/api/public/invoice/${invoiceId}`)
      .then(r => r.json())
      .then(d => {
        if (d.invoice) setInvoice(d.invoice)
        else setError(d.error ?? 'Invoice not found.')
      })
      .catch(() => setError('Failed to load invoice.'))
      .finally(() => setLoading(false))
  }, [invoiceId])

  async function handlePay() {
    if (!invoice) return
    setPaying(true)
    setPayError(null)
    try {
      const res = await fetch(`${API_URL}/api/public/invoice/${invoiceId}/pay`, { method: 'POST' })
      const data = await res.json() as { ok?: boolean; payment_url?: string; error?: string }
      if (!res.ok || !data.payment_url) throw new Error(data.error ?? 'Payment initiation failed.')
      window.location.href = data.payment_url
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : 'Payment initiation failed.')
      setPaying(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '44px 20px 60px',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 32 }}>
        <div style={{
          width: 22, height: 22, background: '#fff', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#000', letterSpacing: '-0.03em' }}>m</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.pri, letterSpacing: '-0.02em' }}>myfiti</span>
        <span style={{
          fontSize: 10, fontWeight: 500, color: C.mut, background: '#111',
          border: '1px solid #1e1e1e', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.02em',
        }}>Billing</span>
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Loading */}
        {loading && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '48px 32px', textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: C.mut }}>Loading invoice…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: '40px 32px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: C.err }}>Invoice not found</p>
            <p style={{ margin: 0, fontSize: 13, color: C.mut }}>{error}</p>
          </div>
        )}

        {/* Success return from Tranzak */}
        {!loading && !error && invoice && isSuccess && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
          }}>
            {/* Success header */}
            <div style={{ padding: '32px 32px 0' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 500, color: C.mut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Payment submitted
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 38, fontWeight: 700, color: C.ok, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {fmtAmt(invoice.amount_xaf)}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: C.sec }}>
                {invoice.plan} &nbsp;·&nbsp; Invoice {invoice.invoice_number}
              </p>
            </div>

            {/* Success callout */}
            <div style={{ padding: '24px 32px' }}>
              <div style={{
                background: C.okBg, border: `1px solid rgba(74,222,128,0.2)`,
                borderRadius: 10, padding: '14px 18px',
              }}>
                <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: C.ok }}>
                  Payment processing
                </p>
                <p style={{ margin: 0, fontSize: 12, color: C.sec, lineHeight: 1.6 }}>
                  Your payment is being processed by Tranzak. It may take a few minutes to confirm.
                  Your invoice status will update automatically once settled.
                </p>
              </div>
            </div>

            <div style={{ padding: '0 32px 32px' }}>
              <p style={{ margin: 0, fontSize: 12, color: C.mut }}>
                Questions? Email us at{' '}
                <a href="mailto:billing@myfiti.app" style={{ color: C.sec, textDecoration: 'none' }}>
                  billing@myfiti.app
                </a>
              </p>
            </div>

            {/* Card footer */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 32px' }}>
              <p style={{ margin: 0, fontSize: 11, color: C.mut }}>
                &copy; {new Date().getFullYear()} myfiti &nbsp;·&nbsp;
                <a href="https://myfiti.app" style={{ color: C.mut, textDecoration: 'none' }}>myfiti.app</a>
              </p>
            </div>
          </div>
        )}

        {/* Main pay card */}
        {!loading && !error && invoice && !isSuccess && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden',
          }}>

            {/* Already paid */}
            {invoice.status === 'paid' && (
              <>
                <div style={{ padding: '32px 32px 0' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 500, color: C.mut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Already paid
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 38, fontWeight: 700, color: C.ok, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {fmtAmt(invoice.amount_xaf)}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: C.sec }}>
                    {invoice.plan} &nbsp;·&nbsp; Paid {fmtDate(invoice.paid_at)}
                  </p>
                </div>
                <div style={{ padding: '24px 32px' }}>
                  <div style={{ background: C.okBg, border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '14px 18px' }}>
                    <p style={{ margin: 0, fontSize: 12, color: C.sec }}>This invoice has been settled. No further action required.</p>
                  </div>
                </div>
              </>
            )}

            {/* Pending / overdue — main pay flow */}
            {(invoice.status === 'pending' || invoice.status === 'overdue') && (
              <>
                {/* Amount header */}
                <div style={{ padding: '32px 32px 0' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 500, color: C.mut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Invoice due
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 38, fontWeight: 700, color: C.pri, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {fmtAmt(invoice.amount_xaf)}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: C.sec }}>
                    {invoice.plan} &nbsp;·&nbsp; Due {fmtDate(invoice.due_date)}
                  </p>
                </div>

                {/* Overdue warning */}
                {invoice.status === 'overdue' && (
                  <div style={{ padding: '20px 32px 0' }}>
                    <div style={{
                      display: 'flex', gap: 12,
                      background: C.errBg, border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 16px',
                    }}>
                      <div style={{ width: 2, background: '#7f1d1d', borderRadius: 2, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: 13, color: C.err, lineHeight: 1.5 }}>
                        This invoice is overdue. Pay now to avoid gym suspension.
                      </p>
                    </div>
                  </div>
                )}

                {/* Detail table */}
                <div style={{ padding: '24px 32px 0' }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                    {[
                      ['Invoice', invoice.invoice_number],
                      ['Gym', invoice.gym_name],
                      ['Plan', invoice.plan],
                      ['Period', `${fmtDate(invoice.period_start)} – ${fmtDate(invoice.period_end)}`],
                      ['Amount due', fmtAmt(invoice.amount_xaf)],
                      ['Due date', fmtDate(invoice.due_date)],
                    ].map(([label, value], i) => (
                      <div key={label} style={{
                        display: 'flex', background: i % 2 === 0 ? '#111' : C.card,
                        borderBottom: `1px solid ${C.border}`,
                      }}>
                        <div style={{ padding: '10px 16px', fontSize: 12, color: C.sec, width: '38%', flexShrink: 0 }}>{label}</div>
                        <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: C.pri }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Pay error */}
                  {payError && (
                    <div style={{
                      display: 'flex', gap: 12, marginBottom: 16,
                      background: C.errBg, border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 16px',
                    }}>
                      <div style={{ width: 2, background: '#7f1d1d', borderRadius: 2, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: 13, color: C.err }}>{payError}</p>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    style={{
                      display: 'block', width: '100%',
                      background: paying ? '#ccc' : C.btnBg,
                      color: C.btnText,
                      fontSize: 14, fontWeight: 700,
                      padding: '13px 22px', border: 'none', borderRadius: 10,
                      cursor: paying ? 'default' : 'pointer',
                      letterSpacing: '-0.01em', transition: 'opacity 0.15s',
                    }}
                  >
                    {paying ? 'Redirecting to payment…' : `Pay ${fmtAmt(invoice.amount_xaf)} via Mobile Money →`}
                  </button>

                  <p style={{ margin: '12px 0 0', fontSize: 11, color: C.mut, textAlign: 'center' }}>
                    Secure payment via Tranzak &nbsp;·&nbsp; MTN / Orange Money accepted
                  </p>
                </div>
              </>
            )}

            {/* Cancelled */}
            {invoice.status === 'cancelled' && (
              <div style={{ padding: '32px 32px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: C.mut }}>Invoice cancelled</p>
                <p style={{ margin: 0, fontSize: 13, color: C.mut }}>This invoice has been cancelled and is no longer payable.</p>
              </div>
            )}

            {/* Spacer */}
            <div style={{ height: 24 }} />

            {/* Card footer */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 32px' }}>
              <p style={{ margin: 0, fontSize: 11, color: C.mut }}>
                &copy; {new Date().getFullYear()} myfiti &nbsp;·&nbsp;
                <a href="mailto:billing@myfiti.app" style={{ color: C.mut, textDecoration: 'none' }}>billing@myfiti.app</a>
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
