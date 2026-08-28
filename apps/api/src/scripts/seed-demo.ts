/**
 * Seed demo data for testing the mobile home screen.
 * Inserts classes, bookings, payments, check-ins, and notifications
 * for a member identified by email.
 *
 * Usage:
 *   npx tsx src/scripts/seed-demo.ts [tenant-slug] [member-email]
 *
 * Example:
 *   npx tsx src/scripts/seed-demo.ts korafit ndanwemarcel@gmail.com
 */

import 'dotenv/config'
import { v4 as uuid } from 'uuid'
import { tenantQuery } from '../db/client.js'

const TENANT_SLUG  = process.argv[2] ?? 'korafit'
const IDENTIFIER   = process.argv[3] ?? 'ndanwemarcel@gmail.com'

async function main() {
  console.log(`Seeding demo data for "${IDENTIFIER}" in tenant "${TENANT_SLUG}"…`)

  // 1. Resolve member — accepts UUID (member ID), email, or phone
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(IDENTIFIER)
  const { rows: memberRows } = await tenantQuery<{ id: string; name: string }>(
    TENANT_SLUG,
    isUuid
      ? `SELECT id, name FROM members WHERE id = $1 LIMIT 1`
      : `SELECT id, name FROM members WHERE (LOWER(phone) = LOWER($1) OR LOWER(email) = LOWER($1)) AND status != 'inactive' LIMIT 1`,
    [IDENTIFIER],
  )
  const member = memberRows[0]
  if (!member) {
    console.error(`No active member found for "${IDENTIFIER}" in tenant "${TENANT_SLUG}".`)
    process.exit(1)
  }
  console.log(`Found member: ${member.name} (${member.id})`)

  // 2. Resolve or create a trainer
  const { rows: staffRows } = await tenantQuery<{ id: string; name: string }>(
    TENANT_SLUG,
    `SELECT id, name FROM staff WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
  )
  const trainerId = staffRows[0]?.id ?? null

  // 3. Resolve or create a subscription (so days remaining shows up)
  const { rows: subRows } = await tenantQuery<{ id: string }>(
    TENANT_SLUG,
    `SELECT id FROM subscriptions WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [member.id],
  )
  let subscriptionId: string | null = subRows[0]?.id ?? null

  if (!subscriptionId) {
    // Find or create a plan
    const { rows: planRows } = await tenantQuery<{ id: string }>(
      TENANT_SLUG,
      `SELECT id FROM membership_plans WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
    )
    let planId = planRows[0]?.id
    if (!planId) {
      planId = uuid()
      await tenantQuery(TENANT_SLUG,
        `INSERT INTO membership_plans (id, name, price, cycle, is_active, created_at)
         VALUES ($1, 'Monthly Plan', 5000, 'monthly', TRUE, NOW())`,
        [planId],
      )
      console.log('Created membership plan:', planId)
    }
    subscriptionId = uuid()
    await tenantQuery(TENANT_SLUG,
      `INSERT INTO subscriptions (id, member_id, plan_id, status, started_at, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '28 days', NOW(), NOW())`,
      [subscriptionId, member.id, planId],
    )
    console.log('Created subscription:', subscriptionId)
  }

  // 4. Seed classes (3 upcoming, 2 past)
  const classTemplates = [
    { name: 'Morning HIIT', daysOffset: 1, hour: 7 },
    { name: 'Yoga Flow',    daysOffset: 2, hour: 9 },
    { name: 'Strength',     daysOffset: 3, hour: 18 },
    { name: 'Pilates',      daysOffset: -2, hour: 10 },
    { name: 'Spin Class',   daysOffset: -5, hour: 6 },
  ]

  const classIds: string[] = []
  for (const t of classTemplates) {
    const startsAt = new Date()
    startsAt.setDate(startsAt.getDate() + t.daysOffset)
    startsAt.setHours(t.hour, 0, 0, 0)
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)

    const classId = uuid()
    classIds.push(classId)
    await tenantQuery(TENANT_SLUG,
      `INSERT INTO classes (id, name, trainer_id, capacity, duration_mins, starts_at, ends_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, 20, 60, $4, $5, 'scheduled', NOW(), NOW())`,
      [classId, t.name, trainerId, startsAt.toISOString(), endsAt.toISOString()],
    )

    await tenantQuery(TENANT_SLUG,
      `INSERT INTO class_bookings (id, class_id, member_id, status, booked_at)
       VALUES ($1, $2, $3, 'confirmed', NOW())`,
      [uuid(), classId, member.id],
    )
  }
  console.log(`Seeded ${classTemplates.length} classes + bookings`)

  // 5. Seed payments
  const paymentTemplates = [
    { amount: 5000, plan_name: 'Monthly Plan', daysAgo: 2,  status: 'completed' },
    { amount: 5000, plan_name: 'Monthly Plan', daysAgo: 33, status: 'completed' },
    { amount: 2500, plan_name: 'Day Pass',     daysAgo: 10, status: 'completed' },
    { amount: 5000, plan_name: 'Monthly Plan', daysAgo: 65, status: 'completed' },
  ]

  for (const p of paymentTemplates) {
    const paidAt = new Date()
    paidAt.setDate(paidAt.getDate() - p.daysAgo)
    await tenantQuery(TENANT_SLUG,
      `INSERT INTO payments (id, member_id, subscription_id, amount, currency, provider, status, payment_type, paid_at, notes, created_at)
       VALUES ($1, $2, $3, $4, 'XAF', 'manual', $5, 'subscription', $6, $7, $6)`,
      [uuid(), member.id, subscriptionId, p.amount, p.status, paidAt.toISOString(), p.plan_name],
    )
  }
  console.log(`Seeded ${paymentTemplates.length} payments`)

  // 6. Seed check-ins
  for (let i = 0; i < 8; i++) {
    const checkedAt = new Date()
    checkedAt.setDate(checkedAt.getDate() - i * 3)
    checkedAt.setHours(8, 30, 0, 0)
    await tenantQuery(TENANT_SLUG,
      `INSERT INTO check_ins (id, member_id, method, checked_in_at)
       VALUES ($1, $2, 'qr', $3)`,
      [uuid(), member.id, checkedAt.toISOString()],
    )
  }
  console.log('Seeded 8 check-ins')

  // 7. Seed notifications
  const notifTemplates = [
    { type: 'announcement', title: 'New class added!', body: 'We just added a Saturday Bootcamp class. Book your spot before it fills up.' },
    { type: 'reminder',     title: 'Membership renews soon', body: 'Your Monthly Plan renews in 7 days. Make sure your payment method is up to date.' },
    { type: 'promo',        title: '20% off referrals', body: 'Refer a friend this month and get 20% off your next renewal. Share your code now.' },
    { type: 'news',         title: 'Gym hours update', body: 'We\'re now open Sundays from 8am to 2pm. Come join us for a morning workout!' },
  ]

  for (const n of notifTemplates) {
    await tenantQuery(TENANT_SLUG,
      `INSERT INTO notifications (id, member_id, type, title, body, channel, created_at)
       VALUES ($1, $2, $3, $4, $5, 'in_app', NOW())`,
      [uuid(), member.id, n.type, n.title, n.body],
    )
  }
  console.log(`Seeded ${notifTemplates.length} notifications`)

  console.log('\nDone! Refresh the mobile app to see the demo data.')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
