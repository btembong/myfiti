import QRCode from 'qrcode'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemberReceiptData {
  type: 'subscription'
  receiptNo: string
  gymName: string
  gymAddress?: string
  memberName: string
  memberEmail?: string
  memberPhone?: string
  planName: string
  startDate: string       // YYYY-MM-DD
  expiresDate: string     // YYYY-MM-DD
  amount: number
  currency: string
  provider: string        // cash, momo, bank_transfer, tranzak
  providerRef?: string
  paidAt: string          // ISO date string
  verifyUrl?: string      // URL to encode in QR
}

export interface DayPassReceiptData {
  type: 'day_pass'
  receiptNo: string
  gymName: string
  gymAddress?: string
  guestName: string
  guestPhone?: string
  passType: string
  validDate: string       // YYYY-MM-DD
  amount: number
  currency: string
  paymentMethod: string
  paymentRef?: string
  issuedAt: string        // ISO date string
  qrToken?: string        // JWT to put in QR
}

export type ReceiptData = MemberReceiptData | DayPassReceiptData

// ─── QR Code ─────────────────────────────────────────────────────────────────

async function generateQRDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
    color: { dark: '#1e1b4b', light: '#ffffff' },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    momo: 'Mobile Money',
    mtn_momo: 'MTN MoMo',
    orange_money: 'Orange Money',
    bank_transfer: 'Bank Transfer',
    tranzak: 'Tranzak',
    card: 'Card',
  }
  return map[provider.toLowerCase()] ?? provider
}

function passTypeLabel(type: string): string {
  const map: Record<string, string> = {
    standard: 'Standard Day Pass',
    peak: 'Peak Hours Pass',
    off_peak: 'Off-Peak Pass',
    student: 'Student Pass',
    bundle_10: '10-Session Bundle',
  }
  return map[type] ?? type
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-CM')}`
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Base email template ──────────────────────────────────────────────────────

function emailBase(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#1e1b4b;padding:24px 32px;">
              <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">myfiti</span>
              <span style="font-size:11px;color:#818cf8;margin-left:8px;">The gym OS for Africa</span>
            </td>
          </tr>
          <!-- Body -->
          <tr><td style="padding:32px;">${body}</td></tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f3f4f6;padding:16px 32px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                © ${new Date().getFullYear()} myfiti · Built for Africa · <a href="https://myfiti.app" style="color:#9ca3af;">myfiti.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Member payment receipt HTML email ───────────────────────────────────────

export async function buildMemberReceiptEmail(data: MemberReceiptData): Promise<string> {
  const qrContent = data.verifyUrl ?? `myfiti:receipt:${data.receiptNo}`
  const qrDataUrl = await generateQRDataUrl(qrContent)

  const body = `
    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1e1b4b;">Payment receipt</p>
    <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">from ${data.gymName}</p>

    <!-- Amount block -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:12px;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Amount paid</p>
          <p style="margin:0;font-size:36px;font-weight:900;color:#1e1b4b;letter-spacing:-1px;">${formatAmount(data.amount, data.currency)}</p>
        </td>
        <td style="padding:20px 24px;" align="right">
          <img src="${qrDataUrl}" width="80" height="80" alt="Receipt QR" style="border-radius:8px;" />
        </td>
      </tr>
    </table>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Member', data.memberName)}
      ${data.memberEmail ? row('Email', data.memberEmail) : ''}
      ${data.memberPhone ? row('Phone', data.memberPhone) : ''}
      ${row('Plan', data.planName)}
      ${row('Valid from', formatDate(data.startDate))}
      ${row('Expires', formatDate(data.expiresDate))}
      ${row('Payment method', providerLabel(data.provider))}
      ${data.providerRef ? row('Reference', data.providerRef) : ''}
      ${row('Paid at', formatDate(data.paidAt))}
      ${row('Receipt No.', data.receiptNo)}
    </table>

    <p style="margin:0 0 8px;font-size:13px;color:#374151;">
      Hi <strong>${data.memberName.split(' ')[0]}</strong>, your membership at <strong>${data.gymName}</strong> is confirmed.
      Show this receipt or your QR code at the kiosk for check-in.
    </p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">Keep this email for your records.</p>
  `

  return emailBase(`Payment receipt — ${data.gymName}`, body)
}

// ─── Day pass receipt HTML email ──────────────────────────────────────────────

export async function buildDayPassReceiptEmail(data: DayPassReceiptData): Promise<string> {
  const qrContent = data.qrToken ?? `myfiti:daypass:${data.receiptNo}`
  const qrDataUrl = await generateQRDataUrl(qrContent)

  const body = `
    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1e1b4b;">Day pass receipt</p>
    <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">from ${data.gymName}</p>

    <!-- Amount block -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:12px;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Amount paid</p>
          <p style="margin:0;font-size:36px;font-weight:900;color:#1e1b4b;letter-spacing:-1px;">${formatAmount(data.amount, data.currency)}</p>
        </td>
        <td style="padding:20px 24px;" align="right">
          <img src="${qrDataUrl}" width="80" height="80" alt="Day pass QR" style="border-radius:8px;" />
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px;font-size:13px;color:#374151;">
      Hi <strong>${data.guestName.split(' ')[0]}</strong>, here is your day pass for <strong>${data.gymName}</strong>.
      Show this QR code at the entrance.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('Guest', data.guestName)}
      ${data.guestPhone ? row('Phone', data.guestPhone) : ''}
      ${row('Pass type', passTypeLabel(data.passType))}
      ${row('Valid date', formatDate(data.validDate))}
      ${row('Payment method', providerLabel(data.paymentMethod))}
      ${data.paymentRef ? row('Reference', data.paymentRef) : ''}
      ${row('Issued at', formatDate(data.issuedAt))}
      ${row('Receipt No.', data.receiptNo)}
    </table>

    <p style="margin:0;font-size:12px;color:#9ca3af;">This pass is valid for one entry on the date shown above only.</p>
  `

  return emailBase(`Day pass — ${data.gymName}`, body)
}

// ─── Thermal receipt (plain HTML for window.print() — 80mm paper) ─────────────

export async function buildThermalReceiptHTML(data: ReceiptData): Promise<string> {
  const isMember = data.type === 'subscription'
  const qrContent = isMember
    ? ((data as MemberReceiptData).verifyUrl ?? `myfiti:receipt:${data.receiptNo}`)
    : ((data as DayPassReceiptData).qrToken ?? `myfiti:daypass:${data.receiptNo}`)

  const qrDataUrl = await generateQRDataUrl(qrContent)

  const lines: string[] = []

  if (isMember) {
    const d = data as MemberReceiptData
    lines.push(
      `<div class="label">Member</div><div class="val">${d.memberName}</div>`,
      `<div class="label">Plan</div><div class="val">${d.planName}</div>`,
      `<div class="label">Valid from</div><div class="val">${formatDate(d.startDate)}</div>`,
      `<div class="label">Expires</div><div class="val">${formatDate(d.expiresDate)}</div>`,
      `<div class="label">Payment</div><div class="val">${providerLabel(d.provider)}</div>`,
      d.providerRef ? `<div class="label">Ref</div><div class="val">${d.providerRef}</div>` : '',
    )
  } else {
    const d = data as DayPassReceiptData
    lines.push(
      `<div class="label">Guest</div><div class="val">${d.guestName}</div>`,
      d.guestPhone ? `<div class="label">Phone</div><div class="val">${d.guestPhone}</div>` : '',
      `<div class="label">Pass type</div><div class="val">${passTypeLabel(d.passType)}</div>`,
      `<div class="label">Valid</div><div class="val">${formatDate(d.validDate)}</div>`,
      `<div class="label">Payment</div><div class="val">${providerLabel(d.paymentMethod)}</div>`,
      (d as DayPassReceiptData).paymentRef ? `<div class="label">Ref</div><div class="val">${(d as DayPassReceiptData).paymentRef}</div>` : '',
    )
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      width: 72mm;
      margin: 0 auto;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .gym-name { font-size: 15px; font-weight: bold; }
    .powered { font-size: 9px; color: #555; margin-top: 2px; }
    .receipt-title { font-size: 13px; font-weight: bold; text-align: center; margin: 6px 0; letter-spacing: 1px; }
    .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; }
    .label { color: #444; flex-shrink: 0; width: 36mm; }
    .val { text-align: right; font-weight: bold; word-break: break-all; }
    .amount-line {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      margin: 8px 0;
      border: 1px dashed #000;
      padding: 4px;
    }
    .qr { text-align: center; margin: 8px 0; }
    .qr img { width: 60mm; height: 60mm; }
    .footer { text-align: center; font-size: 9px; color: #555; margin-top: 8px; }
    @media print {
      html, body { width: 72mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="gym-name">${isMember ? (data as MemberReceiptData).gymName : (data as DayPassReceiptData).gymName}</div>
    <div class="powered">powered by myfiti.app</div>
  </div>

  <div class="receipt-title">${isMember ? '*** MEMBERSHIP RECEIPT ***' : '*** DAY PASS RECEIPT ***'}</div>
  <hr class="divider" />

  <div class="amount-line">
    ${isMember
      ? formatAmount((data as MemberReceiptData).amount, (data as MemberReceiptData).currency)
      : formatAmount((data as DayPassReceiptData).amount, (data as DayPassReceiptData).currency)
    }
  </div>

  <hr class="divider" />

  ${lines.filter(Boolean).map(l => `<div class="row">${l}</div>`).join('\n  ')}

  <div class="row">
    <div class="label">Receipt No.</div>
    <div class="val">${data.receiptNo}</div>
  </div>

  <hr class="divider" />
  <div class="qr">
    <img src="${qrDataUrl}" alt="QR code" />
    <div style="font-size:9px;margin-top:3px;">Scan at entrance</div>
  </div>
  <hr class="divider" />

  <div class="footer">
    Thank you for visiting!<br/>
    ${new Date().toLocaleString('en-GB')}
  </div>
</body>
</html>`
}

// ─── Inline helper ────────────────────────────────────────────────────────────

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:5px 0;font-size:12px;color:#6b7280;width:40%;">${label}</td>
    <td style="padding:5px 0;font-size:12px;color:#111827;font-weight:600;text-align:right;">${value}</td>
  </tr>`
}
