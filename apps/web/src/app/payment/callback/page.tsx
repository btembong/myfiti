'use client'

import { useEffect } from 'react'

// This page is loaded inside an iframe after Tranzak redirects post-payment.
// It signals the parent dashboard to close the modal and refresh billing.
export default function PaymentCallbackPage() {
  useEffect(() => {
    try {
      window.parent.postMessage('payment_complete', '*')
    } catch {
      // If not in an iframe (e.g. direct navigation), redirect to billing
      window.location.href = '/settings/billing'
    }
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif',
      gap: 12, color: '#374151',
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" stroke="#10b981" strokeWidth="2" />
        <path d="M7 12.5l3.5 3.5 6-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Payment complete</p>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Returning to dashboard…</p>
    </div>
  )
}
