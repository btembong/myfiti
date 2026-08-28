/**
 * Verify seeded data is in the database.
 * Run: npx tsx src/scripts/check-seed.ts korafit ndanwemarcel@gmail.com
 */
import 'dotenv/config'
import { tenantQuery } from '../db/client.js'

const TENANT_SLUG  = process.argv[2] ?? 'korafit'
const IDENTIFIER   = process.argv[3] ?? 'ndanwemarcel@gmail.com'

async function main() {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(IDENTIFIER)
  const { rows: memberRows } = await tenantQuery<{ id: string; name: string }>(
    TENANT_SLUG,
    isUuid
      ? `SELECT id, name FROM members WHERE id = $1 LIMIT 1`
      : `SELECT id, name FROM members WHERE email = $1 LIMIT 1`,
    [IDENTIFIER],
  )
  const member = memberRows[0]
  if (!member) { console.log('Member not found'); process.exit(1) }
  console.log(`Member: ${member.name} (${member.id})`)

  const { rows: subRows } = await tenantQuery<{ id: string; status: string; expires_at: string }>(
    TENANT_SLUG,
    `SELECT id, status, expires_at FROM subscriptions WHERE member_id = $1 ORDER BY created_at DESC LIMIT 3`,
    [member.id],
  )
  console.log(`\nSubscriptions (${subRows.length}):`)
  subRows.forEach(s => console.log(`  - ${s.id} | ${s.status} | expires ${s.expires_at}`))

  const { rows: classRows } = await tenantQuery<{ id: string; name: string; starts_at: string }>(
    TENANT_SLUG,
    `SELECT id, name, starts_at FROM classes ORDER BY starts_at DESC LIMIT 10`,
  )
  console.log(`\nClasses (${classRows.length}):`)
  classRows.forEach(c => console.log(`  - ${c.name} | ${c.starts_at}`))

  const { rows: bookingRows } = await tenantQuery<{ id: string; class_id: string; status: string }>(
    TENANT_SLUG,
    `SELECT id, class_id, status FROM class_bookings WHERE member_id = $1`,
    [member.id],
  )
  console.log(`\nBookings for member (${bookingRows.length}):`)
  bookingRows.forEach(b => console.log(`  - ${b.id} | class: ${b.class_id} | ${b.status}`))

  const { rows: upcomingRows } = await tenantQuery<{ name: string; starts_at: string; booking_status: string }>(
    TENANT_SLUG,
    `SELECT c.name, c.starts_at, cb.status as booking_status
     FROM class_bookings cb
     JOIN classes c ON c.id = cb.class_id
     WHERE cb.member_id = $1 AND c.starts_at >= NOW()
     ORDER BY c.starts_at ASC`,
    [member.id],
  )
  console.log(`\nUpcoming booked classes (${upcomingRows.length}):`)
  upcomingRows.forEach(r => console.log(`  - ${r.name} | ${r.starts_at} | ${r.booking_status}`))

  const { rows: notifRows } = await tenantQuery<{ id: string; title: string }>(
    TENANT_SLUG,
    `SELECT id, title FROM notifications WHERE member_id = $1`,
    [member.id],
  )
  console.log(`\nNotifications (${notifRows.length}):`)
  notifRows.forEach(n => console.log(`  - ${n.title}`))

  const { rows: paymentRows } = await tenantQuery<{ id: string; amount: number; status: string }>(
    TENANT_SLUG,
    `SELECT id, amount, status FROM payments WHERE member_id = $1 ORDER BY created_at DESC`,
    [member.id],
  )
  console.log(`\nPayments (${paymentRows.length}):`)
  paymentRows.forEach(p => console.log(`  - ${p.amount} | ${p.status}`))

  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
