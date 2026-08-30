'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import {
  SaleTag01Icon,
  FloppyDiskIcon,
  InformationCircleIcon,
} from 'hugeicons-react'

const PASS_LABELS: Record<string, { label: string; description: string }> = {
  standard:  { label: 'Standard',        description: 'Regular daytime access' },
  peak:      { label: 'Peak',            description: 'Weekday morning / evening rush hours' },
  off_peak:  { label: 'Off-peak',        description: 'Midday or weekend quiet hours' },
  student:   { label: 'Student',         description: 'Valid student ID required' },
  bundle_10: { label: '10-pass bundle',  description: 'Pre-paid bundle of 10 entries' },
}

type Prices = Record<string, number>

export default function DayPassPricingPage() {
  const [prices, setPrices] = useState<Prices>({
    standard: 2000,
    peak: 2500,
    off_peak: 1500,
    student: 1000,
    bundle_10: 18000,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ pricing: Prices | null }>('/api/settings/day-pass-pricing')
      .then(({ pricing }) => {
        if (pricing) setPrices(p => ({ ...p, ...pricing }))
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const update = (key: string, value: string) => {
    const num = parseInt(value, 10)
    setPrices(p => ({ ...p, [key]: isNaN(num) ? 0 : num }))
    setSaved(false)
  }

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await api.put('/api/settings/day-pass-pricing', prices)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [prices])

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <SaleTag01Icon size={18} style={{ color: '#6366f1' }} />
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Day Pass Prices</h1>
        </div>
        <p className="text-sm" style={{ color: '#6b7280' }}>
          Set the price for each day pass type sold at your kiosk. Prices are in your gym&apos;s
          default currency (XAF). Changes take effect immediately.
        </p>
      </div>

      {/* Price cards */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#edeef4' }}>
        {Object.entries(PASS_LABELS).map(([key, { label, description }], idx, arr) => (
          <div
            key={key}
            className="flex items-center gap-4 px-5 py-4"
            style={{
              background: '#fff',
              borderBottom: idx < arr.length - 1 ? '1px solid #edeef4' : undefined,
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>{label}</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: '#6b7280' }}>XAF</span>
              <input
                type="number"
                min={0}
                step={100}
                value={prices[key] ?? 0}
                onChange={e => update(key, e.target.value)}
                disabled={loading}
                className="w-28 text-right rounded-xl px-3 py-2 text-sm font-semibold outline-none transition-all"
                style={{
                  background: '#f4f5f9',
                  border: '1px solid #edeef4',
                  color: '#111827',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onBlur={e => (e.currentTarget.style.borderColor = '#edeef4')}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 rounded-xl p-4"
        style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <InformationCircleIcon size={15} style={{ color: '#0284c7', marginTop: 1 }} />
        <p className="text-xs" style={{ color: '#0369a1' }}>
          The kiosk fetches prices live from the server each time it loads — no reload needed after saving.
          Prices are also used for staff-issued passes and mobile wallet deductions.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm rounded-xl px-4 py-3"
          style={{ background: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </p>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: saved ? '#dcfce7' : '#6366f1',
            color: saved ? '#16a34a' : '#fff',
            opacity: saving || loading ? 0.6 : 1,
            cursor: saving || loading ? 'not-allowed' : 'pointer',
          }}
        >
          <FloppyDiskIcon size={14} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save prices'}
        </button>
      </div>

    </div>
  )
}
