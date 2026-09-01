const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'ndanwemarcel@gmail.com'

// ─── Design tokens — mirrors the app auth/dashboard palette exactly ───────────
const C = {
  bg:       '#000000',
  card:     '#0a0a0a',
  border:   '#1a1a1a',
  surface:  '#0d0d0d',
  rowAlt:   '#111111',
  pri:      '#f0f0f0',
  sec:      '#888888',
  mut:      '#444444',
  dim:      '#282828',
  btnBg:    '#f0f0f0',
  btnText:  '#0a0a0a',
  errText:  '#f87171',
  errBdr:   '#7f1d1d',
  warnText: '#d97706',
  warnBdr:  '#78350f',
  ok:       '#6ee7b7',
}

const YEAR = new Date().getFullYear()

// ─── Shared base shell ────────────────────────────────────────────────────────
// badge: small label shown after the logo  e.g. "Billing" | "Security" | "Support"
// footer: optional override for the in-card footer line

function shell(body: string, opts?: { badge?: string; footer?: string }): string {
  const badge = opts?.badge
  const footerLine = opts?.footer
    ?? `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; <a href="https://myfiti.app" style="color:${C.mut};text-decoration:none;">myfiti.app</a>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="dark"/>
  <title>myfiti</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:44px 20px 48px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

    <!-- Logo row (outside card) -->
    <tr><td style="padding:0 4px 16px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:20px;height:20px;background:#fff;border-radius:5px;text-align:center;vertical-align:middle;">
          <span style="display:block;font-size:10px;font-weight:800;color:#000;line-height:20px;letter-spacing:-0.03em;">m</span>
        </td>
        <td style="padding-left:9px;">
          <span style="font-size:14px;font-weight:600;color:${C.pri};letter-spacing:-0.02em;">myfiti</span>
        </td>
        ${badge ? `<td style="padding-left:8px;">
          <span style="font-size:10px;font-weight:500;color:${C.mut};background:#111;border:1px solid #1e1e1e;padding:2px 8px;border-radius:4px;letter-spacing:0.02em;">${badge}</span>
        </td>` : ''}
      </tr></table>
    </td></tr>

    <!-- Card -->
    <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
      <table width="100%" cellpadding="0" cellspacing="0">

        ${body}

        <!-- Card footer -->
        <tr><td style="border-top:1px solid ${C.border};padding:14px 32px;">
          <p style="margin:0;font-size:11px;color:${C.mut};line-height:1.6;">${footerLine}</p>
        </td></tr>

      </table>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`
}

// ─── Helper: detail table rows ────────────────────────────────────────────────
function row(label: string, value: string, alt: boolean): string {
  const bg = alt ? C.rowAlt : C.card
  return `<tr style="background:${bg};">
    <td style="padding:10px 16px;font-size:12px;color:${C.sec};border-bottom:1px solid ${C.border};width:38%;white-space:nowrap;">${label}</td>
    <td style="padding:10px 16px;font-size:12px;font-weight:500;color:${C.pri};border-bottom:1px solid ${C.border};">${value}</td>
  </tr>`
}

// ─── Helper: CTA button ───────────────────────────────────────────────────────
function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${C.btnBg};color:${C.btnText};font-size:13px;font-weight:600;padding:11px 22px;border-radius:10px;text-decoration:none;letter-spacing:-0.01em;">${label}</a>`
}

// ─── Helper: callout box (for attachments, notices) ───────────────────────────
function callout(content: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid #242424;border-radius:10px;">
    <tr><td style="padding:14px 18px;">${content}</td></tr>
  </table>`
}

// ─── Helper: status bar (error or warning) ───────────────────────────────────
function statusBar(text: string, level: 'error' | 'warn'): string {
  const bdrColor = level === 'error' ? C.errBdr : C.warnBdr
  const txtColor = level === 'error' ? C.errText : C.warnText
  return `<table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:2px;background:${bdrColor};border-radius:2px;">&nbsp;</td>
      <td style="padding:10px 14px;font-size:13px;color:${txtColor};line-height:1.5;">${text}</td>
    </tr>
  </table>`
}

// ─── Brevo sender ─────────────────────────────────────────────────────────────

interface BrevoAttachment { content: string; name: string }

async function send(
  to: { email: string; name: string },
  subject: string,
  html: string,
  attachments?: BrevoAttachment[],
  senderName = 'myfiti',
) {
  const body: Record<string, unknown> = {
    sender: { name: senderName, email: FROM_EMAIL },
    to: [to],
    subject,
    htmlContent: html,
  }
  if (attachments?.length) body.attachment = attachments

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Brevo error ${res.status}: ${text}`)
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

// 1. OTP / email verification
export async function sendOtpEmail(to: { email: string; name: string }, otp: string) {
  const first = to.name.split(' ')[0]
  const html = shell(`
    <tr><td style="padding:32px 32px 8px;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Verify your email</p>
      <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.6;">
        Hi ${first}, enter the code below in the myfiti app. It expires in <span style="color:${C.pri};font-weight:500;">10 minutes</span>.
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="background:${C.surface};border:1px solid #242424;border-radius:12px;padding:28px 0;">
          <span style="font-size:42px;font-weight:700;letter-spacing:0.18em;color:${C.pri};font-family:ui-monospace,Menlo,'Courier New',monospace;">${otp}</span>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 32px 32px;">
      <p style="margin:0;font-size:12px;color:${C.mut};line-height:1.6;">
        If you didn't create a myfiti account you can safely ignore this email. This code expires automatically.
      </p>
    </td></tr>
  `, { badge: 'Account security' })

  await send(to, 'Your myfiti verification code', html)
}

// 2. Membership expiry reminder (gym → member)
export async function sendExpiryReminderEmail(
  to: { email: string; name: string },
  gymName: string,
  daysLeft: number,
  planName: string,
  expiresAt: string,
  renewUrl: string,
) {
  const first   = to.name.split(' ')[0]
  const expDate = new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const urgent  = daysLeft <= 2

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Days remaining</p>
      <p style="margin:0 0 4px;font-size:48px;font-weight:700;color:${C.pri};letter-spacing:-0.04em;line-height:1;">${daysLeft}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">${planName} &nbsp;&middot;&nbsp; Expires ${expDate}</p>
    </td></tr>

    ${urgent ? `<tr><td style="padding:20px 32px 0;">${statusBar(`Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left — renew now to avoid losing gym access.`, 'warn')}</td></tr>` : ''}

    <tr><td style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your membership at <span style="color:${C.pri};font-weight:500;">${gymName}</span> is expiring soon.
        Renew now to keep uninterrupted access to all gym facilities.
      </p>
      ${btn(renewUrl, 'Renew membership')}
    </td></tr>
  `, { badge: 'Membership' })

  await send(to, `Your ${gymName} membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, html)
}

// 3. Grace period alert (gym → member)
export async function sendGraceAlertEmail(
  to: { email: string; name: string },
  gymName: string,
  graceEndsAt: string,
  renewUrl: string,
) {
  const first     = to.name.split(' ')[0]
  const graceDate = new Date(graceEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Membership expired</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">Hi ${first}, your membership at <span style="color:${C.pri};font-weight:500;">${gymName}</span> has expired.</p>
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      ${statusBar(`Grace period active — access suspended after <strong style="color:${C.errText};">${graceDate}</strong>. Renew now to stay active.`, 'error')}
    </td></tr>

    <tr><td style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:13px;color:${C.sec};line-height:1.7;">
        You are currently in a grace period. After ${graceDate} your access will be fully suspended.
        Renew your membership to avoid interruption.
      </p>
      ${btn(renewUrl, 'Renew now')}
    </td></tr>
  `, { badge: 'Membership' })

  await send(to, `Action required — renew your ${gymName} membership before ${graceDate}`, html)
}

// 4. Suspension notice (gym → member)
export async function sendSuspensionNoticeEmail(
  to: { email: string; name: string },
  gymName: string,
  renewUrl: string,
) {
  const first = to.name.split(' ')[0]

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Access suspended</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">Hi ${first}, your membership at <span style="color:${C.pri};font-weight:500;">${gymName}</span> has been suspended.</p>
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      ${statusBar('Your grace period has ended. Renew your membership to restore full access.', 'error')}
    </td></tr>

    <tr><td style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:13px;color:${C.sec};line-height:1.7;">
        To regain entry to ${gymName}, select a membership plan and complete your payment.
        If you believe this is an error, contact your gym directly.
      </p>
      ${btn(renewUrl, 'Restore access')}
    </td></tr>
  `, { badge: 'Membership' })

  await send(to, `Your ${gymName} membership has been suspended`, html)
}

// 5. Payment receipt / invoice email (gym → member, or myfiti → gym)
export async function sendPaymentReceiptEmail(opts: {
  to: { email: string; name: string }
  gymName: string
  amount: number
  currency: string
  description: string
  receiptNo: string
  pdfBuffer: Buffer
  pdfFileName: string
  isInvoice?: boolean
}) {
  const { to, gymName, amount, currency, description, receiptNo, pdfBuffer, pdfFileName, isInvoice } = opts
  const first   = to.name.split(' ')[0]
  const docType = isInvoice ? 'invoice' : 'receipt'
  const amtStr  = `${currency} ${amount.toLocaleString('en-CM')}`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Amount paid</p>
      <p style="margin:0 0 4px;font-size:40px;font-weight:700;color:${C.pri};letter-spacing:-0.03em;line-height:1;">${amtStr}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">${description}</p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 16px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your payment to <span style="color:${C.pri};font-weight:500;">${gymName}</span> is confirmed.
        Your ${docType} is attached to this email.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:16px;">
        ${row('Document', `${isInvoice ? 'Invoice' : 'Receipt'} ${receiptNo}`, true)}
        ${row('Gym', gymName, false)}
        ${row('Amount', amtStr, true)}
      </table>
      ${callout(`<p style="margin:0 0 3px;font-size:12px;font-weight:500;color:${C.sec};">${pdfFileName}</p><p style="margin:0;font-size:11px;color:${C.mut};">Your ${docType} with QR code is attached. Save it for your records.</p>`)}
    </td></tr>

    <tr><td style="padding:20px 32px 32px;">
      <p style="margin:0;font-size:12px;color:${C.mut};">Questions? Reply to this email or contact your gym directly.</p>
    </td></tr>
  `, {
    badge: isInvoice ? 'Invoice' : 'Receipt',
    footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; <a href="https://myfiti.app" style="color:${C.mut};text-decoration:none;">myfiti.app</a>`,
  })

  const attachments: BrevoAttachment[] = [{ content: pdfBuffer.toString('base64'), name: pdfFileName }]
  const senderName = gymName === 'myfiti' ? 'myfiti' : `${gymName} via myfiti`
  await send(to, `Your ${gymName} ${docType} #${receiptNo}`, html, attachments, senderName)
}

// 6. Welcome email (after onboarding complete)
export async function sendWelcomeEmail(to: { email: string; name: string }, gymName: string) {
  const first      = to.name.split(' ')[0]
  const dashUrl    = `${process.env.APP_URL ?? 'https://app.myfiti.app'}/dashboard`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">${gymName} is live.</p>
      <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your gym is set up and ready to use. Head to your dashboard to add members, create plans, and start running ${gymName} on myfiti.
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px;">
      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding-right:8px;">
            <div style="width:4px;height:4px;background:${C.mut};border-radius:50%;margin-top:8px;"></div>
          </td>
          <td style="font-size:13px;color:${C.sec};padding-bottom:8px;">Add your first members and membership plans</td>
        </tr>
        <tr>
          <td style="padding-right:8px;">
            <div style="width:4px;height:4px;background:${C.mut};border-radius:50%;margin-top:8px;"></div>
          </td>
          <td style="font-size:13px;color:${C.sec};padding-bottom:8px;">Set up your QR check-in kiosk</td>
        </tr>
        <tr>
          <td style="padding-right:8px;">
            <div style="width:4px;height:4px;background:${C.mut};border-radius:50%;"></div>
          </td>
          <td style="font-size:13px;color:${C.sec};">Connect Tranzak to accept payments</td>
        </tr>
      </table>
      ${btn(dashUrl, 'Go to dashboard')}
    </td></tr>
  `, { badge: 'Welcome' })

  await send(to, `${gymName} is ready — welcome to myfiti`, html)
}

// 7. Password reset
export async function sendPasswordResetEmail(to: { email: string; name: string }, resetToken: string) {
  const first    = to.name.split(' ')[0]
  const resetUrl = `${process.env.APP_URL ?? 'https://app.myfiti.app'}/reset-password?token=${resetToken}`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Reset your password</p>
      <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, we received a request to reset the password for your myfiti account.
        Click the button below to choose a new one. This link expires in <span style="color:${C.pri};font-weight:500;">1 hour</span>.
      </p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      ${btn(resetUrl, 'Reset password')}
    </td></tr>

    <tr><td style="padding:16px 32px 32px;">
      <p style="margin:0;font-size:12px;color:${C.mut};line-height:1.6;">
        If you didn't request a password reset you can safely ignore this email.
        Your password won't change until you click the button above.
      </p>
    </td></tr>
  `, { badge: 'Account security' })

  await send(to, 'Reset your myfiti password', html)
}

// 8. Plan change notification (myfiti → gym owner)
export async function sendPlanChangeEmail(
  to: { email: string; name: string },
  gymSlug: string,
  oldPlan: string,
  newPlan: string,
  newAmountXaf: number,
  renewalAt: Date,
) {
  const first      = to.name.split(' ')[0]
  const amtStr     = newAmountXaf > 0 ? `XAF ${newAmountXaf.toLocaleString('fr-CM')}/month` : 'Free'
  const renewDate  = renewalAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const billingUrl = `${process.env.APP_URL ?? 'https://app.myfiti.app'}/settings/billing`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Plan updated</p>
      <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:${C.pri};letter-spacing:-0.02em;line-height:1.2;">${oldPlan} &rarr; ${newPlan}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">${amtStr} &nbsp;&middot;&nbsp; Effective now</p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 16px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, the myfiti plan for <span style="color:${C.pri};font-weight:500;">${gymSlug}</span> has been
        updated to <span style="color:${C.pri};font-weight:500;">${newPlan}</span>.
        ${newAmountXaf > 0 ? `Your next billing date is <span style="color:${C.pri};font-weight:500;">${renewDate}</span>.` : 'The Starter plan is free — no payment required.'}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:20px;">
        ${row('Previous plan', oldPlan, true)}
        ${row('New plan', newPlan, false)}
        ${row('Monthly cost', amtStr, true)}
        ${newAmountXaf > 0 ? row('Next renewal', renewDate, false) : ''}
      </table>
      ${btn(billingUrl, 'View billing')}
    </td></tr>

    <tr><td style="padding:16px 32px 32px;"></td></tr>
  `, {
    badge: 'Billing',
    footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; <a href="mailto:billing@myfiti.app" style="color:${C.mut};text-decoration:none;">billing@myfiti.app</a>`,
  })

  await send(to, `Your myfiti plan has been updated to ${newPlan}`, html, undefined, 'myfiti Billing')
}

// 9. Trial ending (7 days left) — myfiti → gym owner
export async function sendTrialEndingEmail(
  to: { email: string; name: string },
  gymSlug: string,
  trialEndsAt: string,
) {
  const first      = to.name.split(' ')[0]
  const endsDate   = new Date(trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const upgradeUrl = `${process.env.APP_URL ?? 'https://app.myfiti.app'}/settings/billing`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Trial ending soon</p>
      <p style="margin:0 0 4px;font-size:48px;font-weight:700;color:${C.pri};letter-spacing:-0.04em;line-height:1;">7</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">days left on your free trial &nbsp;&middot;&nbsp; Expires ${endsDate}</p>
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      ${statusBar(`Upgrade before ${endsDate} to keep <strong style="color:${C.warnText};">${gymSlug}</strong> running without interruption.`, 'warn')}
    </td></tr>

    <tr><td style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your myfiti free trial for <span style="color:${C.pri};font-weight:500;">${gymSlug}</span> ends in 7 days.
        Choose a paid plan to keep serving your members without downtime.
      </p>
      ${btn(upgradeUrl, 'Upgrade now')}
      <p style="margin:16px 0 0;font-size:12px;color:${C.mut};">No action needed if you decide not to continue — your data is preserved for 30 days after expiry.</p>
    </td></tr>
  `, {
    badge: 'Billing',
    footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; <a href="mailto:billing@myfiti.app" style="color:${C.mut};text-decoration:none;">billing@myfiti.app</a>`,
  })

  await send(to, `Your myfiti trial ends in 7 days — upgrade to keep ${gymSlug} active`, html, undefined, 'myfiti Billing')
}

// 10. Trial expired — myfiti → gym owner
export async function sendTrialExpiredEmail(
  to: { email: string; name: string },
  gymSlug: string,
) {
  const first      = to.name.split(' ')[0]
  const upgradeUrl = `${process.env.APP_URL ?? 'https://app.myfiti.app'}/settings/billing`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Your free trial has ended</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">Choose a plan to keep <span style="color:${C.pri};font-weight:500;">${gymSlug}</span> running.</p>
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      ${statusBar(`Your gym is now in a grace period. Select a plan immediately to restore full access.`, 'error')}
    </td></tr>

    <tr><td style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your myfiti free trial has expired. Your data is safe — upgrade now to restore everything and keep serving your members.
      </p>
      ${btn(upgradeUrl, 'Choose a plan')}
      <p style="margin:16px 0 0;font-size:12px;color:${C.mut};">Need help choosing? Reply to this email and we'll guide you.</p>
    </td></tr>
  `, {
    badge: 'Billing',
    footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; <a href="mailto:billing@myfiti.app" style="color:${C.mut};text-decoration:none;">billing@myfiti.app</a>`,
  })

  await send(to, `Your myfiti trial has expired — choose a plan for ${gymSlug}`, html, undefined, 'myfiti Billing')
}

// 11. Renewal reminder (7 days before) — myfiti → gym owner
export async function sendRenewalReminderEmail(
  to: { email: string; name: string },
  gymSlug: string,
  renewalAt: string,
  planLabel: string,
  amountXaf: number,
) {
  const first      = to.name.split(' ')[0]
  const renewDate  = new Date(renewalAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const amtStr     = `XAF ${amountXaf.toLocaleString('fr-CM')}`
  const billingUrl = `${process.env.APP_URL ?? 'https://app.myfiti.app'}/settings/billing`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Renewal reminder</p>
      <p style="margin:0 0 4px;font-size:40px;font-weight:700;color:${C.pri};letter-spacing:-0.03em;line-height:1;">${amtStr}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">${planLabel} &nbsp;&middot;&nbsp; Renews ${renewDate}</p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 16px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your myfiti <span style="color:${C.pri};font-weight:500;">${planLabel}</span> subscription for
        <span style="color:${C.pri};font-weight:500;">${gymSlug}</span> renews in 7 days.
        Make sure your payment method is ready.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:20px;">
        ${row('Plan', planLabel, true)}
        ${row('Amount', amtStr, false)}
        ${row('Renewal date', renewDate, true)}
      </table>
      ${btn(billingUrl, 'Manage billing')}
    </td></tr>

    <tr><td style="padding:16px 32px 32px;"></td></tr>
  `, {
    badge: 'Billing',
    footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; <a href="mailto:billing@myfiti.app" style="color:${C.mut};text-decoration:none;">billing@myfiti.app</a>`,
  })

  await send(to, `Renewal reminder: ${amtStr} due ${renewDate} for ${gymSlug}`, html, undefined, 'myfiti Billing')
}

// 12. Platform invoice notification — myfiti → gym owner
export async function sendInvoiceNotificationEmail(opts: {
  to: { email: string; name: string }
  invoiceId: string
  invoiceNumber: string
  planLabel: string
  amountXaf: number
  periodStart: Date
  periodEnd: Date
  dueDate: Date
  pdfBuffer: Buffer
}) {
  const { to, invoiceId, invoiceNumber, planLabel, amountXaf, periodStart, periodEnd, dueDate, pdfBuffer } = opts
  const first      = to.name.split(' ')[0]
  const amtStr     = `XAF ${amountXaf.toLocaleString('fr-CM')}`
  const fmtDate    = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const periodStr  = `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`
  const dueDateStr = fmtDate(dueDate)
  const fileName   = `${invoiceNumber}.pdf`
  const payUrl     = `${process.env.APP_URL ?? 'https://app.myfiti.app'}/billing/pay/${invoiceId}`

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Invoice ready</p>
      <p style="margin:0 0 4px;font-size:40px;font-weight:700;color:${C.pri};letter-spacing:-0.03em;line-height:1;">${amtStr}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">${planLabel} &nbsp;&middot;&nbsp; ${periodStr}</p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 16px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your myfiti subscription invoice for
        <span style="color:${C.pri};font-weight:500;">${periodStr}</span> is ready.
        Please settle by <span style="color:${C.pri};font-weight:500;">${dueDateStr}</span> to keep your gym active.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:20px;">
        ${row('Invoice', invoiceNumber, true)}
        ${row('Plan', planLabel, false)}
        ${row('Period', periodStr, true)}
        ${row('Amount due', amtStr, false)}
        ${row('Due date', dueDateStr, true)}
      </table>
      ${btn(payUrl, 'Pay invoice →')}
    </td></tr>

    <tr><td style="padding:20px 32px 0;">
      ${callout(`<p style="margin:0 0 3px;font-size:12px;font-weight:500;color:${C.sec};">${fileName}</p><p style="margin:0;font-size:11px;color:${C.mut};">Full invoice with payment details attached. Reply to this email with any questions.</p>`)}
    </td></tr>

    <tr><td style="padding:16px 32px 32px;"></td></tr>
  `, {
    badge: 'Billing',
    footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; <a href="mailto:billing@myfiti.app" style="color:${C.mut};text-decoration:none;">billing@myfiti.app</a>`,
  })

  await send(
    to,
    `Invoice ${invoiceNumber} — ${amtStr} due ${dueDateStr}`,
    html,
    [{ content: pdfBuffer.toString('base64'), name: fileName }],
    'myfiti Billing',
  )
}

// 13. Superadmin direct message to gym owner
export async function sendSuperadminMessageEmail(
  to: { email: string; name: string },
  subject: string,
  body: string,
) {
  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">${subject}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">Hi ${to.name},</p>
    </td></tr>

    <tr><td style="padding:20px 32px 32px;">
      <div style="font-size:13px;color:${C.sec};line-height:1.75;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </td></tr>
  `, {
    badge: 'Support',
    footer: `&copy; ${YEAR} myfiti Support &nbsp;&middot;&nbsp; Reply to this email to respond.`,
  })

  await send(to, subject, html, undefined, 'myfiti Support')
}

// 14. Support ticket reply (superadmin → gym owner)
export async function sendSupportReplyEmail(
  to: { email: string; name: string },
  ticketSubject: string,
  replyBody: string,
  gymName: string,
) {
  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Re: ${ticketSubject}</p>
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">New reply from support</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">Hi ${to.name},</p>
    </td></tr>

    <tr><td style="padding:20px 32px 32px;">
      <div style="font-size:13px;color:${C.sec};line-height:1.75;white-space:pre-wrap;">${replyBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </td></tr>
  `, {
    badge: 'Support',
    footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; Replying on behalf of ${gymName}. Reply to this email to respond to the support team.`,
  })

  await send(to, `Re: ${ticketSubject}`, html, undefined, 'myfiti Support')
}

// 15. New support ticket notification (gym owner → support inbox)
export async function sendNewTicketEmail(
  to: { email: string; name: string },
  ticketSubject: string,
  ticketBody: string,
  gymName: string,
) {
  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">From ${gymName}</p>
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">${ticketSubject}</p>
    </td></tr>

    <tr><td style="padding:20px 32px;">
      <div style="font-size:13px;color:${C.sec};line-height:1.75;white-space:pre-wrap;">${ticketBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </td></tr>

    <tr><td style="padding:0 32px 32px;">
      ${callout(`<p style="margin:0;font-size:12px;color:${C.mut};">This ticket was submitted by the gym owner. Reply in the support dashboard to respond.</p>`)}
    </td></tr>
  `, {
    badge: 'Support',
    footer: `&copy; ${YEAR} myfiti Support`,
  })

  await send(to, `[Support] ${ticketSubject} — ${gymName}`, html, undefined, 'myfiti Support')
}

// 16. Platform announcement (superadmin → all/filtered gym owners)
// Member welcome email — sent when a gym admin adds/imports a member
export async function sendMemberWelcomeEmail(
  to: { email: string; name: string },
  gymName: string,
  qrCode: string,
  planName?: string | null,
  expiresAt?: string | null,
  pin?: string | null,
  memberId?: string | null,
) {
  const first   = to.name.split(' ')[0]
  const expLine = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Use hosted QR code URL for Gmail compatibility (data: URIs blocked by Gmail)
  let qrImgTag = `<span style="font-size:20px;font-weight:700;letter-spacing:0.14em;color:${C.pri};font-family:ui-monospace,Menlo,'Courier New',monospace;">${qrCode}</span>`
  if (memberId) {
    const apiUrl = process.env.API_URL ?? 'https://api.myfiti.fit'
    const qrUrl = `${apiUrl}/qr-codes/${memberId}`
    qrImgTag = `<img src="${qrUrl}" width="160" height="160" alt="QR Code" style="display:block;border-radius:8px;"/>`
  }

  const html = shell(`
    <tr><td style="padding:32px 32px 8px;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Welcome to ${gymName}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.6;">
        Hi ${first}, your membership has been set up. Scan your QR code below at the kiosk to check in.
      </p>
    </td></tr>

    <tr><td style="padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px 0;">
          <p style="margin:0 0 14px;font-size:11px;font-weight:500;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Your Check-in QR Code</p>
          ${qrImgTag}
          <p style="margin:12px 0 0;font-size:12px;font-weight:600;color:#374151;font-family:ui-monospace,Menlo,'Courier New',monospace;">${qrCode}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Scan at the gym kiosk to check in</p>
          ${pin ? `<p style="margin:16px 0 0;font-size:11px;font-weight:500;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Or enter your PIN</p><p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#1e1b4b;font-family:ui-monospace,Menlo,'Courier New',monospace;letter-spacing:0.4em;">${pin}</p>` : ''}
        </td></tr>
      </table>
    </td></tr>

    ${planName ? `
    <tr><td style="padding:0 32px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Membership plan', planName, false)}
        ${expLine ? row('Valid until', expLine, true) : ''}
        ${row('Gym', gymName, expLine ? false : true)}
      </table>
    </td></tr>` : ''}

    <tr><td style="padding:${planName ? '16px' : '0'} 32px 32px;">
      <p style="margin:0;font-size:12px;color:${C.mut};line-height:1.6;">
        If you have any questions, contact your gym directly.
      </p>
    </td></tr>
  `, { badge: 'Membership', footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; Sent on behalf of ${gymName}` })

  await send(to, `Welcome to ${gymName} — your membership is ready`, html)
}

export async function sendPaymentReminderEmail(
  to: { email: string; name: string },
  gymName: string,
  amount: number,
  currency: string,
  planName: string | null,
  dueDate?: string | null,
) {
  const first = to.name.split(' ')[0]
  const amtFmt = `${amount.toLocaleString()} ${currency}`
  const dueLine = dueDate
    ? new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const html = shell(`
    <tr><td style="padding:32px 32px 8px;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Payment reminder</p>
      <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.6;">
        Hi ${first}, you have an outstanding payment due at ${gymName}.
      </p>
    </td></tr>

    <tr><td style="padding:16px 32px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Amount due', amtFmt, false)}
        ${planName ? row('Plan', planName, true) : ''}
        ${dueLine ? row('Due date', dueLine, !planName) : ''}
        ${row('Gym', gymName, Boolean(planName || dueLine))}
      </table>
    </td></tr>

    <tr><td style="padding:16px 32px 32px;">
      <p style="margin:0;font-size:12px;color:${C.mut};line-height:1.6;">
        Please contact ${gymName} to settle this payment and keep your membership active.
      </p>
    </td></tr>
  `, { badge: 'Payment', footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; Sent on behalf of ${gymName}` })

  await send(to, `Payment reminder from ${gymName} — ${amtFmt} due`, html)
}

export async function sendStaffInviteEmail(
  to: { email: string; name: string },
  gymName: string,
  role: string,
  loginUrl: string,
) {
  const first = to.name.split(' ')[0]
  const html = shell(`
    <tr><td style="padding:32px 32px 8px;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">You've been invited to ${gymName}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.6;">
        Hi ${first}, you've been added as a <strong style="color:${C.pri};">${role}</strong> on ${gymName}'s myfiti dashboard.
      </p>
    </td></tr>

    <tr><td style="padding:16px 32px 24px;">
      ${btn(loginUrl, 'Sign in to dashboard →')}
    </td></tr>

    <tr><td style="padding:0 32px 32px;">
      <p style="margin:0;font-size:12px;color:${C.mut};line-height:1.6;">
        Use your email address to sign in. If you don't have a password yet, use the "Forgot password" flow on the login page.
      </p>
    </td></tr>
  `, { badge: 'Staff invite', footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; Sent on behalf of ${gymName}` })

  await send(to, `You've been invited to ${gymName} on myfiti`, html)
}

// ─── Activation invoice (subscription created → PDF attachment) ───────────────
export async function sendActivationInvoiceEmail(
  to: { email: string; name: string },
  gym: { gym_name: string; primary_color?: string | null; logo_url?: string | null; currency?: string | null },
  sub: { id: string; plan_name: string; price: number; started_at: string; expires_at: string },
  payment?: { method?: string | null; ref?: string | null },
) {
  try {
    const { buildInvoicePDF } = await import('./pdf.js')
    const startFmt  = new Date(sub.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const expFmt    = new Date(sub.expires_at ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const invoiceNo = `INV-${sub.id.slice(0, 8).toUpperCase()}`
    const currency  = gym.currency ?? 'XAF'
    const first     = to.name.split(' ')[0]

    const pdfBuffer = await buildInvoicePDF({
      invoiceNo,
      issuedAt:    new Date().toISOString(),
      dueAt:       new Date().toISOString(),
      status:      'PAID',
      gymName:     gym.gym_name,
      gymColor:    gym.primary_color   ?? undefined,
      gymLogoUrl:  gym.logo_url        ?? undefined,
      memberName:  to.name,
      memberEmail: to.email,
      items: [{
        description: sub.plan_name,
        subtitle:    `Valid: ${startFmt} – ${expFmt}`,
        qty:         1,
        unitPrice:   sub.price,
        total:       sub.price,
      }],
      currency,
      subtotal:       sub.price,
      total:          sub.price,
      membershipCard: true,
      paymentMethod:  payment?.method ?? undefined,
      paymentRef:     payment?.ref    ?? undefined,
      paidAt:         new Date().toISOString(),
      qrContent:      sub.id,
    })

    const html = shell(`
      <tr><td style="padding:32px 32px 8px;">
        <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">Your membership invoice</p>
        <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.6;">
          Hi ${first}, your payment to <strong style="color:${C.pri};">${gym.gym_name}</strong> has been confirmed.
          Your invoice is attached as a PDF.
        </p>
      </td></tr>

      <tr><td style="padding:16px 32px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('Plan',        sub.plan_name,  false)}
          ${row('Valid from',  startFmt,       true)}
          ${row('Expires',     expFmt,         false)}
          ${row('Amount paid', `${currency} ${sub.price.toLocaleString('en-CM')}`, true)}
          ${row('Invoice',     invoiceNo,      false)}
          ${payment?.method ? row('Payment', payment.method, true) : ''}
        </table>
      </td></tr>

      <tr><td style="padding:16px 32px 32px;">
        <p style="margin:0;font-size:12px;color:${C.mut};line-height:1.6;">
          Your PDF invoice is attached. Keep it for your records and present your QR code at the gym entrance.
        </p>
      </td></tr>
    `, { badge: 'Invoice', footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; Sent on behalf of ${gym.gym_name}` })

    await send(
      to,
      `Your ${gym.gym_name} membership invoice — ${invoiceNo}`,
      html,
      [{ content: pdfBuffer.toString('base64'), name: `${invoiceNo}.pdf` }],
    )
  } catch (err) {
    console.warn('[email] sendActivationInvoiceEmail failed:', err)
  }
}


// ─── Member cash receipt email (no PDF — fast, inline) ───────────────────────
// Uses the same dark shell() template as all other emails.

export async function sendMemberCashReceiptEmail(opts: {
  to: { email: string; name: string }
  gymName: string
  senderName?: string
  memberId?: string | null
  data: {
    receiptNo: string
    planName: string
    startDate: string
    expiresDate: string
    amount: number
    currency: string
    provider: string
    providerRef?: string
    paidAt: string
  }
}) {
  const { to, gymName, memberId, data } = opts
  const first    = to.name.split(' ')[0]
  const amtStr   = `${data.currency} ${data.amount.toLocaleString('en-CM')}`
  const fmtDate  = (d: string) => { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d } }
  const providerLabel: Record<string, string> = { cash: 'Cash', momo: 'Mobile Money', bank_transfer: 'Bank Transfer', tranzak: 'Tranzak', card: 'Card' }

  const apiUrl = process.env.API_URL ?? 'https://api.myfiti.fit'
  const qrCell = memberId
    ? `<img src="${apiUrl}/qr-codes/${memberId}.png" width="100" height="100" alt="QR" style="display:block;border-radius:6px;"/>`
    : ''

  const html = shell(`
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:500;color:${C.mut};text-transform:uppercase;letter-spacing:0.1em;">Payment confirmed</p>
      <p style="margin:0 0 4px;font-size:36px;font-weight:700;color:${C.pri};letter-spacing:-0.03em;line-height:1;">${amtStr}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};">${gymName} &nbsp;&middot;&nbsp; ${data.planName}</p>
    </td></tr>

    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 16px;font-size:13px;color:${C.sec};line-height:1.7;">
        Hi ${first}, your membership at <span style="color:${C.pri};font-weight:500;">${gymName}</span> is confirmed. Show your QR code at the kiosk to check in.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:10px;overflow:hidden;margin-bottom:${qrCell ? '20px' : '0'};">
        ${row('Plan',    data.planName,                            true)}
        ${row('Valid',   `${fmtDate(data.startDate)} – ${fmtDate(data.expiresDate)}`, false)}
        ${row('Payment', providerLabel[data.provider] ?? data.provider, true)}
        ${data.providerRef ? row('Ref', data.providerRef, false) : ''}
        ${row('Amount',  amtStr,                                  data.providerRef ? true : false)}
        ${row('Receipt', data.receiptNo,                          data.providerRef ? false : true)}
        ${row('Date',    fmtDate(data.paidAt),                    data.providerRef ? true : false)}
      </table>
      ${qrCell ? callout(`<table cellpadding="0" cellspacing="0"><tr><td style="padding-right:16px;">${qrCell}</td><td><p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${C.sec};">Your check-in QR code</p><p style="margin:0;font-size:11px;color:${C.mut};">Scan at the kiosk entrance to check in.</p></td></tr></table>`) : ''}
    </td></tr>

    <tr><td style="padding:20px 32px 32px;">
      <p style="margin:0;font-size:12px;color:${C.mut};line-height:1.6;">Questions? Contact your gym directly.</p>
    </td></tr>
  `, { badge: 'Receipt', footer: `&copy; ${YEAR} myfiti &nbsp;&middot;&nbsp; Sent on behalf of ${gymName}` })

  await send(
    to,
    `Your ${gymName} receipt — ${data.receiptNo}`,
    html,
    undefined,
    opts.senderName ?? `${gymName} via myfiti`,
  )
}

export async function sendAnnouncementEmail(
  to: { email: string; name: string },
  title: string,
  message: string,
  gymName: string,
) {
  const first = to.name.split(' ')[0]
  const safeMsg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = shell(`
    <tr><td style="padding:32px 32px 8px;">
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:${C.pri};letter-spacing:-0.01em;">${title}</p>
      <p style="margin:0;font-size:13px;color:${C.sec};line-height:1.6;">Hi ${first}, here's an update from the myfiti team.</p>
    </td></tr>

    <tr><td style="padding:16px 32px 24px;">
      <div style="font-size:13px;color:${C.sec};line-height:1.8;white-space:pre-wrap;">${safeMsg}</div>
    </td></tr>

    <tr><td style="padding:0 32px 32px;">
      ${callout(`<p style="margin:0;font-size:12px;color:${C.mut};">Sent to <strong style="color:${C.sec};">${gymName}</strong> by the myfiti team</p>`)}
    </td></tr>
  `, { badge: 'Announcement' })
  await send(to, title, html)
}
