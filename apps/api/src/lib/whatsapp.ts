/**
 * WhatsApp document delivery via Meta Cloud API (WhatsApp Business API).
 *
 * Required env vars (gracefully does nothing if absent):
 *   WHATSAPP_TOKEN     — permanent system user token from Meta Business
 *   WHATSAPP_PHONE_ID  — phone number ID from Meta WABA dashboard
 *
 * Flow:
 *   1. Upload PDF to Meta media endpoint → get media_id
 *   2. Send document message with media_id to recipient
 */

const GRAPH = 'https://graph.facebook.com/v19.0'

export async function sendWhatsAppDocument(opts: {
  to: string           // E.164 format, e.g. "+237677123456"
  caption: string      // message text shown above the document
  filename: string     // e.g. "INV-2026-00042.pdf"
  pdfBuffer: Buffer
}): Promise<void> {
  const token   = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return   // graceful no-op when not configured

  const { to, caption, filename, pdfBuffer } = opts

  // ── 1. Upload PDF media ───────────────────────────────────────────────────
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'application/pdf')
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename)

  const uploadRes = await fetch(`${GRAPH}/${phoneId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    console.warn(`[whatsapp] media upload failed ${uploadRes.status}: ${text}`)
    return
  }

  const { id: mediaId } = await uploadRes.json() as { id: string }

  // ── 2. Send document message ──────────────────────────────────────────────
  const toNum = to.replace(/\s+/g, '').replace(/^\+/, '')

  const msgRes = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toNum,
      type: 'document',
      document: { id: mediaId, caption, filename },
    }),
  })

  if (!msgRes.ok) {
    const text = await msgRes.text()
    console.warn(`[whatsapp] message failed ${msgRes.status}: ${text}`)
    return
  }

  console.log(`[whatsapp] document sent → +${toNum} (${filename})`)
}
