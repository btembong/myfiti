import Expo from 'expo-server-sdk'
import { globalQuery, tenantQuery } from '../db/client.js'

const expo = new Expo()

const QUOTES = [
  { title: 'Rise & grind 💪', body: "The only bad workout is the one that didn't happen. Let's go!" },
  { title: 'Push your limits', body: 'Your body can stand almost anything. It\'s your mind you have to convince.' },
  { title: 'Stay consistent', body: 'Consistency beats perfection. Show up today.' },
  { title: 'You\'ve got this', body: 'Every rep gets you closer. Make today count.' },
  { title: 'Train hard', body: 'The pain you feel today is the strength you feel tomorrow.' },
  { title: 'No excuses', body: 'Be stronger than your excuses. See you at the gym.' },
  { title: 'Keep going', body: 'Champions are made in the moments they want to quit — but don\'t.' },
  { title: 'Level up today', body: 'Small steps every day. Big results over time.' },
  { title: 'Earn it', body: 'Nobody is going to do it for you. Get up and earn it.' },
  { title: 'Make it happen', body: 'The gym is open. Your goals are waiting. What are you waiting for?' },
  { title: 'Commit to the grind', body: 'Motivation gets you started. Habit keeps you going.' },
  { title: 'One more rep', body: 'When you feel like stopping, remember why you started.' },
  { title: 'Today is the day', body: 'You don\'t have to be extreme — just consistent. Let\'s move.' },
  { title: 'Sweat it out', body: 'Sweat is just fat crying. See you at the gym.' },
]

function todaysQuote() {
  return QUOTES[new Date().getDate() % QUOTES.length]
}

let lastRunDate: string | null = null

async function motivationTick() {
  // Only run once per day
  const today = new Date().toISOString().slice(0, 10)
  if (lastRunDate === today) return
  lastRunDate = today

  // Only fire between 06:30 and 09:00 local server time
  const hour = new Date().getHours()
  const min  = new Date().getMinutes()
  const minuteOfDay = hour * 60 + min
  if (minuteOfDay < 6 * 60 + 30 || minuteOfDay > 9 * 60) return

  console.log('[motivation-cron] sending daily motivation push...')

  const { title, body } = todaysQuote()

  // Get all active tenants
  const { rows: tenants } = await globalQuery<{ slug: string }>(
    `SELECT slug FROM tenants WHERE status != 'suspended'`,
  )

  let totalPushed = 0

  for (const tenant of tenants) {
    try {
      const { rows: members } = await tenantQuery<{ push_token: string }>(
        tenant.slug,
        `SELECT push_token FROM members
         WHERE status IN ('active', 'expiring_soon')
           AND push_token IS NOT NULL`,
      )

      const tokens = members
        .map(m => m.push_token)
        .filter((t): t is string => Expo.isExpoPushToken(t))

      if (tokens.length === 0) continue

      const messages = tokens.map(token => ({
        to: token,
        sound: 'default' as const,
        title,
        body,
        data: { type: 'motivation' },
      }))

      const chunks = expo.chunkPushNotifications(messages)
      for (const chunk of chunks) {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk)
          totalPushed += receipts.filter(r => r.status === 'ok').length
        } catch (err) {
          console.warn(`[motivation-cron] chunk error (${tenant.slug}):`, err)
        }
      }
    } catch (err) {
      console.warn(`[motivation-cron] tenant error (${tenant.slug}):`, err)
    }
  }

  console.log(`[motivation-cron] done — pushed to ${totalPushed} devices`)
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
// Checks every 10 minutes. The tick itself enforces once-per-day + time window.

export function startMotivationCron() {
  console.log('[motivation-cron] started — checks every 10min, fires 06:30–09:00')
  motivationTick().catch(err => console.error('[motivation-cron] initial tick:', err))
  setInterval(() => {
    motivationTick().catch(err => console.error('[motivation-cron] tick error:', err))
  }, 10 * 60 * 1000)
}
