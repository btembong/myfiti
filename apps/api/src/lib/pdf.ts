/**
 * Enterprise PDF generator — invoices & receipts.
 *
 * Design: Starlink / enterprise style.
 *   - Pure white, black text, typography hierarchy
 *   - Gym logo top-left (optional), brand color accent line
 *   - Two-column header: billing info | document meta
 *   - Membership card credential section (invoice only)
 *   - Savings callout + next billing date
 *   - QR code + payment details + attendance summary + thank-you
 *   - "Verified by myfiti" footer
 *
 * Library: pdfkit (pure Node.js, no Chromium)
 */

import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

// ─── Page geometry ────────────────────────────────────────────────────────────
const W    = 595.28
const H    = 841.89
const ML   = 50
const MR   = 50
const MT   = 48
const BODY = W - ML - MR

const TC_DESC  = ML
const TC_QTY   = ML + 310
const TC_QTY_W = 70
const TC_AMT   = ML + 390
const TC_AMT_W = W - MR - TC_AMT

// ─── Palette ──────────────────────────────────────────────────────────────────
const INK    = '#000000'
const MUTED  = '#555555'
const LIGHT  = '#888888'
const RULE_C = '#cccccc'
const ALT_BG = '#f9f9f9'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceData {
  invoiceNo: string
  issuedAt:  string
  dueAt:     string
  status:    'PAID' | 'PENDING' | 'OVERDUE'

  // Issuer (gym or myfiti)
  gymName:            string
  gymAddress?:        string
  gymEmail?:          string
  gymPhone?:          string
  gymLogoUrl?:        string   // remote image URL
  gymColor?:          string   // brand hex, e.g. '#4f46e5'
  gymRegistrationNo?: string   // e.g. 'RC-12345'

  // Bill-to
  memberName:   string
  memberNo?:    string   // e.g. 'GYM-000042' — shown as Customer Account on invoices
  memberEmail?: string
  memberPhone?: string

  items: Array<{
    description: string
    subtitle?:   string   // e.g. "Valid: 04 Jul 2026 – 03 Aug 2026"
    qty:         number
    unitPrice:   number
    total:       number
  }>

  currency: string
  subtotal: number
  tax?:     number
  total:    number

  membershipCard?: boolean   // render the credential card section (subscription invoices only)

  savings?: {
    amount:      number
    description: string   // e.g. "vs monthly billing"
  }
  nextBillingDate?: string   // ISO

  attendanceSummary?: {
    visits: number
    period: string   // e.g. "this month"
  }

  paymentMethod?: string
  paymentRef?:    string
  paidAt?:        string

  qrContent: string
}

export interface ReceiptData {
  receiptNo:  string
  issuedAt:   string

  gymName:            string
  gymAddress?:        string
  gymEmail?:          string
  gymLogoUrl?:        string
  gymColor?:          string
  gymRegistrationNo?: string

  memberName?:  string
  memberEmail?: string
  guestName?:   string
  guestPhone?:  string

  description: string
  passType?:   string

  amount:    number
  currency:  string

  paymentMethod: string
  paymentRef?:   string

  qrContent: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function docToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

async function qrPng(content: string, size = 110): Promise<Buffer> {
  return QRCode.toBuffer(content, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

function fmtLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}


function fmtDT(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-CM')}`
}

function payLabel(method: string): string {
  const m: Record<string, string> = {
    cash: 'Cash', momo: 'Mobile Money', mtn_momo: 'MTN MoMo',
    mtn: 'MTN MoMo', orange_money: 'Orange Money', orange: 'Orange Money',
    bank_transfer: 'Bank Transfer', tranzak: 'Tranzak', card: 'Card',
  }
  return m[method.toLowerCase()] ?? method
}

function rule(doc: InstanceType<typeof PDFDocument>, y: number, weight = 0.5) {
  doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(weight).strokeColor(RULE_C).stroke()
}

function thinRule(doc: InstanceType<typeof PDFDocument>, y: number) {
  doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.3).strokeColor('#e0e0e0').stroke()
}

// ─── INVOICE PDF ──────────────────────────────────────────────────────────────

export async function buildInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
    Title:   `Invoice ${data.invoiceNo}`,
    Author:  data.gymName,
    Subject: `Invoice — ${data.gymName}`,
  }})

  let lY = MT
  let rY = MT
  const LEFT_W  = 260
  const RIGHT_X = W - MR - 215
  const RIGHT_W = 215

  // ── Gym logo ───────────────────────────────────────────────────────────────
  if (data.gymLogoUrl) {
    const logoBuffer = await fetchImageBuffer(data.gymLogoUrl)
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, ML, lY, { fit: [90, 32] })
        lY += 40
      } catch { /* fall through to text name */ }
    }
  }

  // ── Gym name & contact ─────────────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK)
    .text(data.gymName.toUpperCase(), ML, lY, { width: LEFT_W, lineBreak: false })
  lY += 18

  if (data.gymAddress) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(data.gymAddress, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }
  if (data.gymEmail) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(data.gymEmail, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }
  if (data.gymPhone) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(data.gymPhone, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }
  if (data.gymRegistrationNo) {
    doc.fontSize(8.5).font('Helvetica').fillColor(LIGHT)
      .text(`Reg. No.: ${data.gymRegistrationNo}`, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }

  lY += 10

  // ── Bill-to ────────────────────────────────────────────────────────────────
  doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
    .text('Attn:', ML, lY, { continued: true })
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(INK)
    .text(` ${data.memberName}`, { lineBreak: false })
  lY += 13
  if (data.memberEmail) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(data.memberEmail, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }
  if (data.memberPhone) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(data.memberPhone, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }

  // ── Heading top-right ──────────────────────────────────────────────────────
  doc.fontSize(32).font('Helvetica-Bold').fillColor(INK)
    .text('Invoice', RIGHT_X, rY - 6, { width: RIGHT_W, align: 'right', lineBreak: false })
  rY += 34

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(INK)
    .text(data.invoiceNo, RIGHT_X, rY, { width: RIGHT_W, align: 'right', lineBreak: false })
  rY += 20

  const metaRows: [string, string][] = [
    ['Invoice Date:',     fmtLong(data.issuedAt)],
    ['Payment Due Date:', fmtLong(data.dueAt)],
    ['Customer Account:', data.memberNo ?? data.memberEmail ?? data.memberName],
  ]
  metaRows.forEach(([label, val]) => {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(`${label} `, RIGHT_X, rY, { continued: true })
    doc.font('Helvetica').fillColor(INK)
      .text(val, { width: RIGHT_W - (doc.widthOfString(`${label} `)), lineBreak: false })
    rY += 13
  })

  // ── Brand color accent line ────────────────────────────────────────────────
  let y = Math.max(lY, rY) + 14
  if (data.gymColor) {
    doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(2.5).strokeColor(data.gymColor).stroke()
    y += 5
  }

  rule(doc, y); y += 20

  // ── Table header ──────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text('Product Description', TC_DESC, y, { width: TC_QTY - TC_DESC - 8, lineBreak: false })
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text('Qty', TC_QTY, y, { width: TC_QTY_W, align: 'center', lineBreak: false })
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text('Amount', TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 8; thinRule(doc, y); y += 12

  // ── Line items ────────────────────────────────────────────────────────────
  data.items.forEach((item, i) => {
    const rowH = item.subtitle ? 40 : 26
    if (i % 2 === 1) {
      doc.rect(ML, y, BODY, rowH).fill(ALT_BG)
    }
    doc.fontSize(10).font('Helvetica').fillColor(INK)
      .text(item.description, TC_DESC, y + 5, { width: TC_QTY - TC_DESC - 8, lineBreak: false })
    if (item.subtitle) {
      doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
        .text(item.subtitle, TC_DESC, y + 19, { width: TC_QTY - TC_DESC - 8, lineBreak: false })
    }
    doc.fontSize(10).font('Helvetica').fillColor(INK)
      .text(String(item.qty), TC_QTY, y + 5, { width: TC_QTY_W, align: 'center', lineBreak: false })
    doc.fontSize(10).font('Helvetica').fillColor(INK)
      .text(money(item.total, data.currency), TC_AMT, y + 5, { width: TC_AMT_W, align: 'right', lineBreak: false })
    y += rowH
    thinRule(doc, y); y += 2
  })

  y += 10

  // ── Subtotal ──────────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica').fillColor(MUTED)
    .text('Subtotal', TC_DESC, y, { lineBreak: false })
  doc.fontSize(10).font('Helvetica').fillColor(INK)
    .text(money(data.subtotal, data.currency), TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 18

  if (data.tax) {
    const pct = Math.round((data.tax / data.subtotal) * 100)
    doc.fontSize(10).font('Helvetica').fillColor(MUTED)
      .text(`Total Tax (${pct}%)`, TC_DESC, y, { lineBreak: false })
    doc.fontSize(10).font('Helvetica').fillColor(INK)
      .text(money(data.tax, data.currency), TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
    y += 18
  }

  y += 6; rule(doc, y); y += 18

  // ── Total Charges + Payment ───────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK)
    .text('Total Charges', TC_DESC, y, { lineBreak: false })
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK)
    .text(money(data.total, data.currency), TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 22

  if (data.paymentMethod) {
    const payStr = data.status === 'PAID'
      ? `${payLabel(data.paymentMethod)}  (PAID ✓)`
      : `${payLabel(data.paymentMethod)}  (Pending)`
    doc.fontSize(10).font('Helvetica').fillColor(INK)
      .text('Payment', TC_DESC, y, { lineBreak: false })
    doc.fontSize(10).font('Helvetica').fillColor(data.status === 'PAID' ? INK : MUTED)
      .text(payStr, TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
    y += 18
  }

  y += 6; rule(doc, y, 0.8); y += 20

  // ── TOTAL DUE — visual anchor ─────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').fillColor(INK)
    .text('Total Due', ML, y, { lineBreak: false })
  doc.fontSize(16).font('Helvetica-Bold').fillColor(INK)
    .text(money(data.total, data.currency), 0, y, { width: W - MR, align: 'right', lineBreak: false })
  y += 36

  rule(doc, y); y += 22

  // ── Membership card (subscription invoices only) ─────────────────────────
  const cardSubtitle = data.items[0]?.subtitle
  if (data.membershipCard && cardSubtitle) {
    const cardH      = 104
    const PAD        = 16
    const innerX     = ML + PAD
    const innerW     = BODY - PAD * 2
    const brandColor = data.gymColor ?? '#111111'

    // Card border — subtle gray only, no tinted background
    doc.roundedRect(ML, y, BODY, cardH, 6)
      .lineWidth(0.5).strokeColor(RULE_C).stroke()

    // "MEMBERSHIP" label — top-left
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(LIGHT)
      .text('MEMBERSHIP', innerX, y + 14, { lineBreak: false })

    // Status pill badge — brand color background, white text
    const pillW = 44
    const pillH = 14
    const pillX = W - MR - PAD - pillW
    doc.roundedRect(pillX, y + 11, pillW, pillH, 3).fill(brandColor)
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
      .text(data.status === 'PAID' ? 'ACTIVE' : data.status, pillX, y + 14.5, { width: pillW, align: 'center', lineBreak: false })

    // Member name — hero
    doc.fontSize(16).font('Helvetica-Bold').fillColor(INK)
      .text(data.memberName, innerX, y + 32, { width: innerW, lineBreak: false })

    // Internal divider
    doc.moveTo(innerX, y + 54)
      .lineTo(W - MR - PAD, y + 54)
      .lineWidth(0.3).strokeColor('#d1d5db').stroke()

    // Plan name — bold
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(INK)
      .text(data.items[0].description, innerX, y + 62, { width: innerW, lineBreak: false })

    // Validity dates — strip "Valid: " prefix
    const validityText = cardSubtitle.replace(/^Valid:\s*/i, '')
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(validityText, innerX, y + 78, { width: innerW, lineBreak: false })

    // Gym name — bottom-left, brand color
    doc.fontSize(8).font('Helvetica-Bold').fillColor(brandColor)
      .text(data.gymName.toUpperCase(), innerX, y + 92, { lineBreak: false })

    y += cardH + 22
    rule(doc, y); y += 26
  }

  // ── QR + payment details + attendance + thank-you ─────────────────────────
  const qr = await qrPng(data.qrContent, 120)
  const QR = 90

  doc.image(qr, ML, y, { width: QR, height: QR })

  const DETAIL_X = ML + QR + 22
  const DETAIL_W = W - MR - DETAIL_X
  let dy = y

  const detailPairs: [string, string][] = []
  if (data.paymentRef)    detailPairs.push(['Payment Reference', data.paymentRef])
  if (data.paymentMethod) detailPairs.push(['Payment Method',    payLabel(data.paymentMethod)])
  if (data.paidAt)        detailPairs.push(['Paid On',           fmtDT(data.paidAt)])
  detailPairs.push(['Receipt No.', data.invoiceNo])

  detailPairs.forEach(([label, val]) => {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(MUTED)
      .text(label, DETAIL_X, dy, { width: 120, lineBreak: false })
    doc.fontSize(8.5).font('Helvetica').fillColor(INK)
      .text(val, DETAIL_X + 124, dy, { width: DETAIL_W - 124, lineBreak: false })
    dy += 14
  })

  dy += 8

  // Attendance callout
  if (data.attendanceSummary) {
    const { visits, period } = data.attendanceSummary
    doc.fontSize(9).font('Helvetica-Bold').fillColor(INK)
      .text(
        `${visits} visit${visits !== 1 ? 's' : ''} ${period} — keep it up!`,
        DETAIL_X, dy, { width: DETAIL_W }
      )
    dy += 16
  }

  // Thank-you message
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text(`Thank you for your membership at ${data.gymName}!`, DETAIL_X, dy, { width: DETAIL_W })
  dy += 16
  doc.fontSize(9).font('Helvetica').fillColor(MUTED)
    .text(
      'We look forward to welcoming you. Please keep this invoice for your records.',
      DETAIL_X, dy, { width: DETAIL_W }
    )

  y = Math.max(y + QR, dy) + 28

  rule(doc, y); y += 18

  // ── Footer ────────────────────────────────────────────────────────────────
  if (data.gymEmail) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(
        `Questions about this invoice? Contact ${data.gymEmail}.`,
        ML, y, { width: BODY, align: 'center' }
      )
    y += 13
  }

  doc.fontSize(8).font('Helvetica').fillColor(LIGHT)
    .text(
      `Verified by myfiti · myfiti.app · The gym OS for Africa · Generated ${fmtDT(new Date().toISOString())}`,
      ML, y, { width: BODY, align: 'center' }
    )

  return docToBuffer(doc)
}

// ─── RECEIPT PDF ──────────────────────────────────────────────────────────────

export async function buildReceiptPDF(data: ReceiptData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
    Title:   `Receipt ${data.receiptNo}`,
    Author:  data.gymName,
    Subject: `Receipt — ${data.gymName}`,
  }})

  let lY = MT
  let rY = MT
  const LEFT_W  = 260
  const RIGHT_X = W - MR - 215
  const RIGHT_W = 215

  const displayName  = data.guestName  ?? data.memberName  ?? 'Guest'
  const displayPhone = data.guestPhone ?? data.memberEmail ?? ''

  // ── Gym logo ───────────────────────────────────────────────────────────────
  if (data.gymLogoUrl) {
    const logoBuffer = await fetchImageBuffer(data.gymLogoUrl)
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, ML, lY, { fit: [90, 32] })
        lY += 40
      } catch { /* fall through */ }
    }
  }

  // ── Gym name & contact ─────────────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK)
    .text(data.gymName.toUpperCase(), ML, lY, { width: LEFT_W, lineBreak: false })
  lY += 18

  if (data.gymAddress) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(data.gymAddress, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }
  if (data.gymEmail) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(data.gymEmail, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }
  if (data.gymRegistrationNo) {
    doc.fontSize(8.5).font('Helvetica').fillColor(LIGHT)
      .text(`Reg. No.: ${data.gymRegistrationNo}`, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }

  lY += 10
  doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
    .text('Attn: ', ML, lY, { continued: true })
  doc.font('Helvetica-Bold').fillColor(INK)
    .text(displayName, { lineBreak: false })
  lY += 13
  if (displayPhone) {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(displayPhone, ML, lY, { width: LEFT_W, lineBreak: false })
    lY += 13
  }

  // ── Heading top-right ──────────────────────────────────────────────────────
  doc.fontSize(32).font('Helvetica-Bold').fillColor(INK)
    .text('Receipt', RIGHT_X, rY - 6, { width: RIGHT_W, align: 'right', lineBreak: false })
  rY += 34

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(INK)
    .text(data.receiptNo, RIGHT_X, rY, { width: RIGHT_W, align: 'right', lineBreak: false })
  rY += 20

  const metaRows: [string, string][] = [
    ['Invoice Date:',     fmtLong(data.issuedAt)],
    ['Payment Due Date:', fmtLong(data.issuedAt)],
    ['Customer Account:', data.memberEmail ?? displayName],
  ]
  metaRows.forEach(([label, val]) => {
    doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
      .text(`${label} `, RIGHT_X, rY, { continued: true })
    doc.font('Helvetica').fillColor(INK)
      .text(val, { width: RIGHT_W - (doc.widthOfString(`${label} `)), lineBreak: false })
    rY += 13
  })

  // ── Brand color accent line ────────────────────────────────────────────────
  let y = Math.max(lY, rY) + 14
  if (data.gymColor) {
    doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(2.5).strokeColor(data.gymColor).stroke()
    y += 5
  }

  rule(doc, y); y += 20

  // ── Table ─────────────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text('Product Description', TC_DESC, y, { width: TC_QTY - TC_DESC - 8, lineBreak: false })
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text('Qty', TC_QTY, y, { width: TC_QTY_W, align: 'center', lineBreak: false })
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text('Amount', TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 8; thinRule(doc, y); y += 12

  doc.fontSize(10).font('Helvetica').fillColor(INK)
    .text(data.description, TC_DESC, y + 5, { width: TC_QTY - TC_DESC - 8, lineBreak: false })
  doc.fontSize(10).font('Helvetica').fillColor(INK)
    .text('1', TC_QTY, y + 5, { width: TC_QTY_W, align: 'center', lineBreak: false })
  doc.fontSize(10).font('Helvetica').fillColor(INK)
    .text(money(data.amount, data.currency), TC_AMT, y + 5, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 28; thinRule(doc, y); y += 12

  // ── Subtotal ──────────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica').fillColor(MUTED)
    .text('Subtotal', TC_DESC, y, { lineBreak: false })
  doc.fontSize(10).font('Helvetica').fillColor(INK)
    .text(money(data.amount, data.currency), TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 18

  y += 6; rule(doc, y); y += 18

  // ── Total Charges + Payment ───────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK)
    .text('Total Charges', TC_DESC, y, { lineBreak: false })
  doc.fontSize(11).font('Helvetica-Bold').fillColor(INK)
    .text(money(data.amount, data.currency), TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 22

  doc.fontSize(10).font('Helvetica').fillColor(INK)
    .text('Payment', TC_DESC, y, { lineBreak: false })
  doc.fontSize(10).font('Helvetica').fillColor(INK)
    .text(`${payLabel(data.paymentMethod)}  (PAID ✓)`, TC_AMT, y, { width: TC_AMT_W, align: 'right', lineBreak: false })
  y += 18

  y += 6; rule(doc, y, 0.8); y += 20

  // ── TOTAL DUE ─────────────────────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').fillColor(INK)
    .text('Total Due', ML, y, { lineBreak: false })
  doc.fontSize(16).font('Helvetica-Bold').fillColor(INK)
    .text(money(data.amount, data.currency), 0, y, { width: W - MR, align: 'right', lineBreak: false })
  y += 36

  rule(doc, y); y += 26

  // ── QR + payment details + thank-you ──────────────────────────────────────
  const qr = await qrPng(data.qrContent, 120)
  const QR = 90

  doc.image(qr, ML, y, { width: QR, height: QR })

  const DETAIL_X = ML + QR + 22
  const DETAIL_W = W - MR - DETAIL_X
  let dy = y

  const pairs: [string, string][] = []
  if (data.paymentRef) pairs.push(['Payment Reference', data.paymentRef])
  pairs.push(['Payment Method', payLabel(data.paymentMethod)])
  pairs.push(['Issued On',      fmtDT(data.issuedAt)])
  pairs.push(['Receipt No.',    data.receiptNo])

  pairs.forEach(([label, val]) => {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(MUTED)
      .text(label, DETAIL_X, dy, { width: 120, lineBreak: false })
    doc.fontSize(8.5).font('Helvetica').fillColor(INK)
      .text(val, DETAIL_X + 124, dy, { width: DETAIL_W - 124, lineBreak: false })
    dy += 14
  })

  dy += 10
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text(`Thank you for visiting ${data.gymName}!`, DETAIL_X, dy, { width: DETAIL_W })
  dy += 16
  doc.fontSize(9).font('Helvetica').fillColor(MUTED)
    .text(
      'Show this receipt or scan the QR code at the entrance gate to verify your payment.',
      DETAIL_X, dy, { width: DETAIL_W }
    )

  y = Math.max(y + QR, dy) + 28

  rule(doc, y); y += 18

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.fontSize(8.5).font('Helvetica').fillColor(MUTED)
    .text(
      'This receipt is valid for the service shown above. Present this document or QR code for entry.',
      ML, y, { width: BODY, align: 'center' }
    )
  y += 13

  doc.fontSize(8).font('Helvetica').fillColor(LIGHT)
    .text(
      `Verified by myfiti · myfiti.app · The gym OS for Africa · Generated ${fmtDT(new Date().toISOString())}`,
      ML, y, { width: BODY, align: 'center' }
    )

  return docToBuffer(doc)
}
