/**
 * One-off test: send a sample invoice + receipt email to verify the PDF design.
 * Run: npx tsx src/scripts/test-email.ts
 */

import 'dotenv/config'
import { buildInvoicePDF, buildReceiptPDF } from '../lib/pdf.js'
import { sendPaymentReceiptEmail, sendInvoiceNotificationEmail } from '../lib/email.js'

const TEST_EMAIL = 'ndanwemarcel@gmail.com'
const TEST_NAME  = 'Marcel Ndanwe'

async function main() {
  console.log('Generating invoice PDF...')

  // ── Sample invoice ───────────────────────────────────────────────────────
  const invoiceBuffer = await buildInvoicePDF({
    invoiceNo:  'INV-2026-00042',
    issuedAt:   new Date().toISOString(),
    dueAt:      new Date().toISOString(),
    status:     'PAID',

    gymName:            'CrossFit Lagos',
    gymAddress:         '14 Balogun Street, Victoria Island, Lagos',
    gymEmail:           'hello@crossfitlagos.com',
    gymPhone:           '+234 801 234 5678',
    gymColor:           '#f97316',   // orange brand color
    gymRegistrationNo:  'RC-789456',

    memberName:  TEST_NAME,
    memberEmail: TEST_EMAIL,
    memberPhone: '+237 677 123 456',

    items: [
      {
        description: 'Growth+ Monthly Plan',
        subtitle:    'Valid: 04 Jul 2026 – 03 Aug 2026',
        qty:         1,
        unitPrice:   25000,
        total:       25000,
      },
    ],

    currency: 'XAF',
    subtotal: 25000,
    total:    25000,

    membershipCard:   true,
    attendanceSummary: { visits: 14, period: 'this month' },

    paymentMethod: 'mtn_momo',
    paymentRef:    'MTN-2026-ABC123XYZ',
    paidAt:        new Date().toISOString(),

    qrContent: 'myfiti:invoice:INV-2026-00042',
  })

  console.log(`Invoice PDF generated: ${invoiceBuffer.length} bytes`)

  console.log('Sending invoice email...')
  await sendPaymentReceiptEmail({
    to:          { email: TEST_EMAIL, name: TEST_NAME },
    gymName:     'CrossFit Lagos',
    amount:      25000,
    currency:    'XAF',
    description: 'Growth+ Monthly Plan',
    receiptNo:   'INV-2026-00042',
    pdfBuffer:   invoiceBuffer,
    pdfFileName: 'INV-2026-00042.pdf',
    isInvoice:   true,
  })
  console.log('✓ Invoice email sent')

  // ── Sample receipt (day pass) ────────────────────────────────────────────
  console.log('\nGenerating day pass receipt PDF...')

  const receiptBuffer = await buildReceiptPDF({
    receiptNo:          'DP-A1B2C3D4',
    issuedAt:           new Date().toISOString(),
    gymName:            'CrossFit Lagos',
    gymAddress:         '14 Balogun Street, Victoria Island, Lagos',
    gymEmail:           'hello@crossfitlagos.com',
    gymColor:           '#f97316',
    gymRegistrationNo:  'RC-789456',
    guestName:          TEST_NAME,
    guestPhone:         '+237 677 123 456',
    description:        'Standard Day Pass · Valid 04 Jul 2026',
    passType:           'standard',
    amount:             2000,
    currency:           'XAF',
    paymentMethod:      'cash',
    qrContent:          'myfiti:daypass:DP-A1B2C3D4',
  })

  console.log(`Receipt PDF generated: ${receiptBuffer.length} bytes`)

  console.log('Sending day pass receipt email...')
  await sendPaymentReceiptEmail({
    to:          { email: TEST_EMAIL, name: TEST_NAME },
    gymName:     'CrossFit Lagos',
    amount:      2000,
    currency:    'XAF',
    description: 'Standard Day Pass · Valid 04 Jul 2026',
    receiptNo:   'DP-A1B2C3D4',
    pdfBuffer:   receiptBuffer,
    pdfFileName: 'DP-A1B2C3D4.pdf',
    isInvoice:   false,
  })
  console.log('✓ Day pass receipt email sent')

  // ── myfiti → gym owner invoice ──────────────────────────────────────────────
  console.log('\nGenerating myfiti platform invoice...')

  const myfitiInvoiceBuffer = await buildInvoicePDF({
    invoiceNo:  'MYFITI-2026-AB12CD34',
    issuedAt:   new Date().toISOString(),
    dueAt:      new Date().toISOString(),
    status:     'PAID',

    gymName:    'myfiti',
    gymAddress: 'Douala, Cameroon',
    gymEmail:   'billing@myfiti.app',

    memberName:  TEST_NAME,
    memberEmail: TEST_EMAIL,

    items: [{
      description: 'myfiti Growth+ Plan',
      qty:         1,
      unitPrice:   19900,
      total:       19900,
    }],

    currency: 'XAF',
    subtotal: 19900,
    total:    19900,

    paymentMethod: 'mtn_momo',
    paymentRef:    'MTN-TEN-XYZ987654',
    paidAt:        new Date().toISOString(),

    qrContent: 'myfiti:invoice:MYFITI-2026-AB12CD34',
  })

  console.log(`myfiti invoice PDF generated: ${myfitiInvoiceBuffer.length} bytes`)

  console.log('Sending myfiti platform invoice...')
  await sendPaymentReceiptEmail({
    to:          { email: TEST_EMAIL, name: TEST_NAME },
    gymName:     'myfiti',
    amount:      19900,
    currency:    'XAF',
    description: 'myfiti Growth+ Plan',
    receiptNo:   'MYFITI-2026-AB12CD34',
    pdfBuffer:   myfitiInvoiceBuffer,
    pdfFileName: 'MYFITI-2026-AB12CD34.pdf',
    isInvoice:   true,
  })
  console.log('✓ myfiti platform invoice email sent')

  // ── myfiti platform invoice notification (with Pay button) ──────────────────
  console.log('\nGenerating myfiti platform invoice notification (with Pay button)...')

  const now2 = new Date()
  const periodStart2 = new Date(now2.getFullYear(), now2.getMonth(), 1)
  const periodEnd2   = new Date(now2.getFullYear(), now2.getMonth() + 1, 0, 23, 59, 59)
  const dueDate2     = new Date(now2.getFullYear(), now2.getMonth(), 15)

  const fakeInvoiceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  const platformInvoiceBuffer = await buildInvoicePDF({
    invoiceNo:  'INV-2026-07-TESTGY',
    issuedAt:   now2.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    dueAt:      dueDate2.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    status:     'PENDING',
    gymName:    'myfiti',
    gymEmail:   'billing@myfiti.app',
    memberName:  TEST_NAME,
    memberEmail: TEST_EMAIL,
    currency:    'XAF',
    subtotal:    19900,
    total:       19900,
    membershipCard: false,
    items: [{
      description: 'Growth+ Plan — Monthly Subscription',
      subtitle:    `${periodStart2.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })} – ${periodEnd2.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      qty:         1,
      unitPrice:   19900,
      total:       19900,
    }],
    qrContent: 'myfiti:invoice:INV-2026-07-TESTGY',
  })

  await sendInvoiceNotificationEmail({
    to:            { email: TEST_EMAIL, name: TEST_NAME },
    invoiceId:     fakeInvoiceId,
    invoiceNumber: 'INV-2026-07-TESTGY',
    planLabel:     'Growth+',
    amountXaf:     19900,
    periodStart:   periodStart2,
    periodEnd:     periodEnd2,
    dueDate:       dueDate2,
    pdfBuffer:     platformInvoiceBuffer,
  })
  console.log('✓ Platform invoice notification sent (with Pay invoice → button)')

  console.log('\nDone. Check ndanwemarcel@gmail.com — you should have 4 emails.')
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
