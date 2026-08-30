'use client'

import { useEffect, useState, useCallback } from 'react'
import QRCode from 'react-qr-code'
import { api } from '@/lib/api'
import { getTenantSlug } from '@/lib/auth'
import {
  Tv01Icon,
  Copy01Icon,
  CheckmarkCircle01Icon,
  InformationCircleIcon,
  PrinterIcon,
} from 'hugeicons-react'

interface GymSettings {
  gym_name: string
  primary_color: string
}

export default function KioskSetupPage() {
  const [settings, setSettings] = useState<GymSettings | null>(null)
  const [copied, setCopied] = useState(false)

  const slug = getTenantSlug() ?? ''
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.myfiti.app'
  const kioskUrl = `${origin}/kiosk?slug=${slug}`

  useEffect(() => {
    api.get<GymSettings>('/api/settings/public').then(setSettings).catch(() => null)
  }, [])

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(kioskUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [kioskUrl])

  const print = () => {
    const win = window.open('', '_blank', 'width=600,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kiosk QR — ${settings?.gym_name ?? slug}</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 32px; box-sizing: border-box; }
            h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
            p { color: #6b7280; font-size: 14px; margin: 0 0 24px; }
            .qr { padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; }
            .url { margin-top: 16px; font-size: 12px; color: #6b7280; word-break: break-all; text-align: center; max-width: 360px; }
            .powered { margin-top: 32px; font-size: 11px; color: #c0c5d0; }
          </style>
        </head>
        <body>
          <h1>${settings?.gym_name ?? slug} Kiosk</h1>
          <p>Scan to open the self-service kiosk</p>
          <div class="qr" id="qr"></div>
          <div class="url">${kioskUrl}</div>
          <div class="powered">Powered by myfiti.app</div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"><\/script>
          <script>
            QRCode.toCanvas(document.createElement('canvas'), '${kioskUrl}', { width: 240 }, function(err, canvas) {
              if (!err) document.getElementById('qr').appendChild(canvas)
              window.print()
            })
          <\/script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Tv01Icon size={18} style={{ color: '#6366f1' }} />
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>Kiosk Setup</h1>
        </div>
        <p className="text-sm" style={{ color: '#6b7280' }}>
          Deploy the self-service kiosk on any tablet or screen in your gym. Members and guests can
          check in, buy day passes, and look up their accounts without staff assistance.
        </p>
      </div>

      {/* QR Card */}
      <div className="rounded-2xl border p-8 flex flex-col items-center gap-6"
        style={{ borderColor: '#edeef4', background: '#fff' }}>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-semibold" style={{ color: '#374151' }}>
            {settings?.gym_name ?? slug} — Self-Service Kiosk
          </p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Scan with any phone to open the kiosk on a browser</p>
        </div>

        <div className="p-4 rounded-xl border" style={{ borderColor: '#edeef4', background: '#fafbfc' }}>
          <QRCode
            value={kioskUrl}
            size={200}
            fgColor={settings?.primary_color ?? '#6366f1'}
            bgColor="transparent"
          />
        </div>

        {/* URL + copy */}
        <div className="w-full flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ background: '#f4f5f9', border: '1px solid #edeef4' }}>
          <span className="flex-1 text-xs font-mono truncate" style={{ color: '#374151' }}>
            {kioskUrl}
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: copied ? '#dcfce7' : '#fff', color: copied ? '#16a34a' : '#6b7280', border: '1px solid #e5e7eb' }}
          >
            {copied
              ? <><CheckmarkCircle01Icon size={13} /> Copied</>
              : <><Copy01Icon size={13} /> Copy</>}
          </button>
        </div>

        <button
          onClick={print}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          style={{ background: '#f4f5f9', color: '#374151', border: '1px solid #edeef4' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#edeef4')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f4f5f9')}
        >
          <PrinterIcon size={14} />
          Print / Save QR poster
        </button>
      </div>

      {/* Setup instructions */}
      <div className="rounded-2xl border p-6 space-y-4"
        style={{ borderColor: '#edeef4', background: '#fff' }}>
        <h2 className="text-sm font-bold" style={{ color: '#111827' }}>Setup instructions</h2>
        <ol className="space-y-3">
          {[
            { step: '1', text: 'Mount a tablet or any device with a browser in your gym reception area.' },
            { step: '2', text: 'Open the kiosk URL on that device (or scan the QR above to navigate).' },
            { step: '3', text: 'Enable "kiosk mode" or full-screen in the browser so the address bar is hidden (F11 on desktop, Guided Access on iPad).' },
            { step: '4', text: 'The kiosk stays authenticated via the URL — no login required. Bookmark it.' },
            { step: '5', text: 'Configure day pass prices in the "Day Pass Prices" settings tab to match your pricing.' },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: '#eef2ff', color: '#6366f1' }}>
                {step}
              </span>
              <span className="text-sm" style={{ color: '#4b5563' }}>{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 rounded-xl p-4"
        style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
        <InformationCircleIcon size={16} style={{ color: '#d97706', marginTop: 1 }} />
        <p className="text-xs" style={{ color: '#92400e' }}>
          The kiosk URL contains your gym slug and is safe to share or bookmark publicly. It does not
          grant admin access. Staff check-in features on the kiosk use a separate PIN-protected flow.
        </p>
      </div>

    </div>
  )
}
