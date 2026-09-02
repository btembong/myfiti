import { Worker, type Job } from 'bullmq'
import { globalQuery, tenantQuery } from '../../db/client.js'
import {
  sendExpiryReminderEmail,
  sendGraceAlertEmail,
  sendSuspensionNoticeEmail,
} from '../../lib/email.js'
import { buildConnection } from '../index.js'

const connection = buildConnection()!

const APP_URL = process.env.APP_URL ?? 'https://app.myfiti.app'

interface MemberRow {
  id: string
  name: string
  email: string
}

interface SubscriptionRow {
  id: string
  expires_at: string
  grace_expires_at: string
  status: string
}

interface PlanRow {
  name: string
}

async function getMember(tenantSlug: string, memberId: string): Promise<MemberRow | null> {
  const { rows } = await tenantQuery<MemberRow>(
    tenantSlug,
    `SELECT id, name, email FROM members WHERE id = $1 LIMIT 1`,
    [memberId],
  )
  return rows[0] ?? null
}

async function getSubscription(tenantSlug: string, subscriptionId: string): Promise<(SubscriptionRow & PlanRow) | null> {
  const { rows } = await tenantQuery<SubscriptionRow & PlanRow>(
    tenantSlug,
    `SELECT s.id, s.expires_at, s.grace_expires_at, s.status, mp.name
     FROM subscriptions s
     LEFT JOIN membership_plans mp ON mp.id = s.plan_id
     WHERE s.id = $1 LIMIT 1`,
    [subscriptionId],
  )
  return rows[0] ?? null
}

async function getGymName(tenantSlug: string): Promise<string> {
  const { rows } = await globalQuery<{ name: string }>(
    `SELECT name FROM tenants WHERE slug = $1 LIMIT 1`,
    [tenantSlug],
  )
  return rows[0]?.name ?? tenantSlug
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const subscriptionWorker = new Worker(
  'subscriptions',
  async (job: Job) => {
    const { tenantSlug, memberId, subscriptionId, daysLeft } = job.data as {
      tenantSlug: string
      tenantId: string
      memberId: string
      subscriptionId: string
      daysLeft?: number
    }

    const [member, sub, gymName] = await Promise.all([
      getMember(tenantSlug, memberId),
      getSubscription(tenantSlug, subscriptionId),
      getGymName(tenantSlug),
    ])

    if (!member?.email || !sub) {
      console.warn(`[subscription.worker] skipping ${job.name}: member=${memberId} sub=${subscriptionId}`)
      return
    }

    const to = { email: member.email, name: member.name }
    const renewUrl = `${APP_URL}/member/renew?gym=${tenantSlug}&mid=${memberId}`

    switch (job.name) {
      case 'send-expiry-reminder':
        await sendExpiryReminderEmail(
          to,
          gymName,
          daysLeft ?? 7,
          sub.name ?? 'Membership',
          sub.expires_at,
          renewUrl,
        )
        console.log(`[subscription.worker] expiry reminder → ${member.email} (${daysLeft}d left)`)
        break

      case 'send-grace-alert':
        await sendGraceAlertEmail(to, gymName, sub.grace_expires_at, renewUrl)
        console.log(`[subscription.worker] grace alert → ${member.email}`)
        break

      case 'send-suspension-notice':
        await sendSuspensionNoticeEmail(to, gymName, renewUrl)
        console.log(`[subscription.worker] suspension notice → ${member.email}`)
        break

      default:
        console.warn(`[subscription.worker] unknown job name: ${job.name}`)
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 50, duration: 60_000 }, // max 50 emails/min
  },
)

subscriptionWorker.on('failed', (job, err) => {
  console.error(`[subscription.worker] job ${job?.id} (${job?.name}) failed:`, err)
})
