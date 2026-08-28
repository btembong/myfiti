import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { tenantQuery } from '../db/client.js'

export const analyticsRouter = Router()

analyticsRouter.use(requireAuth)
analyticsRouter.use(requireRole('owner', 'admin'))

// Map period query param to a PostgreSQL interval string
function periodToInterval(period: string): string {
  switch (period) {
    case '7d':  return '7 days'
    case '90d': return '90 days'
    case '1y':  return '1 year'
    default:    return '30 days'
  }
}

// ─── GET /api/analytics/dashboard ────────────────────────────────────────────
// Summary KPIs for the dashboard header cards

analyticsRouter.get('/dashboard', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const interval = periodToInterval(req.query.period as string)
    const now = new Date()
    const todayStart = new Date(now.toDateString())

    const [membersResult, mrrResult, revMonthResult, checkinsResult, newMembersResult, expiringSoonResult, overdueResult, revPrevResult, membersPrevResult, checkinsPrevResult, chartResult, staffResult] = await Promise.all([
      tenantQuery(slug, `SELECT status, COUNT(*) as count FROM members GROUP BY status`),
      tenantQuery(slug, `SELECT COALESCE(SUM(mp.price / mp.duration_days * 30), 0) as mrr
         FROM subscriptions s
         JOIN membership_plans mp ON mp.id = s.plan_id
         WHERE s.status IN ('active', 'expiring_soon', 'grace_period')`),
      tenantQuery(slug, `SELECT COALESCE(SUM(amount), 0) as total
         FROM payments
         WHERE status IN ('paid', 'completed') AND paid_at >= date_trunc('month', NOW())`),
      tenantQuery(slug, `SELECT COUNT(*) as count FROM check_ins WHERE checked_in_at >= $1`, [todayStart.toISOString()]),
      tenantQuery(slug, `SELECT COUNT(*) as count FROM members WHERE created_at >= NOW() - $1::interval`, [interval]),
      tenantQuery(slug, `SELECT COUNT(*) as count FROM subscriptions
         WHERE status = 'expiring_soon' AND expires_at <= NOW() + INTERVAL '7 days'`),
      tenantQuery(slug, `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'grace_period'`),
      // Previous period revenue for delta
      tenantQuery(slug, `SELECT COALESCE(SUM(amount), 0) as total FROM payments
         WHERE status IN ('paid', 'completed')
           AND paid_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
           AND paid_at < date_trunc('month', NOW())`),
      // Previous period members for delta
      tenantQuery(slug, `SELECT COUNT(*) as count FROM members
         WHERE created_at >= NOW() - ($1::interval * 2) AND created_at < NOW() - $1::interval`, [interval]),
      // Previous period check-ins for delta
      tenantQuery(slug, `SELECT COUNT(*) as count FROM check_ins
         WHERE checked_in_at >= $1::timestamptz - $2::interval AND checked_in_at < $1::timestamptz`, [todayStart.toISOString(), interval]),
      // Chart: daily revenue + new members for selected period
      tenantQuery(slug, `
        WITH days AS (
          SELECT generate_series(
            date_trunc('day', NOW() - $1::interval),
            date_trunc('day', NOW()),
            INTERVAL '1 day'
          )::date as d
        )
        SELECT
          TO_CHAR(d, 'DD Mon') as label,
          COALESCE((SELECT SUM(amount) FROM payments WHERE status='completed' AND paid_at::date=d), 0) as revenue,
          COALESCE((SELECT COUNT(*) FROM members WHERE created_at::date=d), 0) as members
        FROM days ORDER BY d`, [interval]),
      // Authenticated staff member for greeting
      tenantQuery(slug, `SELECT id, name, role FROM staff WHERE id = $1 LIMIT 1`, [req.auth.sub]),
    ])

    const checkinsWeekResult = await tenantQuery(slug, `
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', NOW() - INTERVAL '6 days'),
          date_trunc('day', NOW()),
          INTERVAL '1 day'
        )::date as d
      )
      SELECT COALESCE((SELECT COUNT(*) FROM check_ins WHERE checked_in_at::date=d), 0)::int as count
      FROM days ORDER BY d`)

    const membersByStatus: Record<string, number> = {}
    for (const row of membersResult.rows as Array<{ status: string; count: string }>) {
      membersByStatus[row.status] = parseInt(row.count)
    }
    const totalMembers = Object.values(membersByStatus).reduce((a, b) => a + b, 0)

    const revThis = parseFloat((revMonthResult.rows[0] as { total: string })?.total ?? '0')
    const revPrev = parseFloat((revPrevResult.rows[0] as { total: string })?.total ?? '0')
    const newThis = parseInt((newMembersResult.rows[0] as { count: string })?.count ?? '0')
    const newPrev = parseInt((membersPrevResult.rows[0] as { count: string })?.count ?? '0')
    const ciThis  = parseInt((checkinsResult.rows[0] as { count: string })?.count ?? '0')
    const ciPrev  = parseInt((checkinsPrevResult.rows[0] as { count: string })?.count ?? '0')

    function delta(current: number, previous: number) {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const staffRow = staffResult.rows[0] as { name?: string } | undefined
    const checkinsWeek = (checkinsWeekResult.rows as Array<{ count: number }>).map(r => r.count)

    res.json({
      totalMembers,
      activeMembers: membersByStatus.active ?? 0,
      expiringSoon: parseInt((expiringSoonResult.rows[0] as { count: string })?.count ?? '0'),
      graceMembers: membersByStatus.grace_period ?? 0,
      suspendedMembers: membersByStatus.suspended ?? 0,
      mrr: parseFloat((mrrResult.rows[0] as { mrr: string })?.mrr ?? '0'),
      revenueThisMonth: revThis,
      checkinsToday: ciThis,
      newMembersLast30: newThis,
      overduePayments: parseInt((overdueResult.rows[0] as { count: string })?.count ?? '0'),
      // Deltas for KPI cards
      deltaRevenue: delta(revThis, revPrev),
      deltaNewMembers: delta(newThis, newPrev),
      deltaCheckins: delta(ciThis, ciPrev),
      // Chart data
      chartData: chartResult.rows,
      // 7-day daily check-ins for sparkline
      checkinsWeek,
      // Authenticated user's name
      staffName: staffRow?.name ?? null,
    })
  } catch (err) {
    console.error('[analytics/dashboard]', err)
    res.status(500).json({ error: 'Failed to load dashboard analytics.' })
  }
})

// ─── GET /api/analytics/revenue ──────────────────────────────────────────────
// Revenue breakdown: daily for last 30 days + monthly totals

analyticsRouter.get('/revenue', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const interval = periodToInterval(req.query.period as string)

    const [dailyResult, monthlyResult, byPlanResult] = await Promise.all([
      tenantQuery(slug, `SELECT
         paid_at::date as date,
         COALESCE(SUM(amount), 0) as total,
         COUNT(*) as count
       FROM payments
       WHERE status IN ('paid', 'completed') AND paid_at >= NOW() - $1::interval
       GROUP BY paid_at::date
       ORDER BY date ASC`, [interval]),
      tenantQuery(slug, `SELECT
         TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon YYYY') as month,
         COALESCE(SUM(amount), 0) as total,
         COUNT(*) as count
       FROM payments
       WHERE status IN ('paid', 'completed') AND paid_at >= NOW() - $1::interval
       GROUP BY DATE_TRUNC('month', paid_at)
       ORDER BY DATE_TRUNC('month', paid_at) ASC`, [interval]),
      tenantQuery(slug, `SELECT mp.name, COUNT(s.id) as subs, SUM(mp.price) as revenue
       FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.status IN ('active', 'expiring_soon')
       GROUP BY mp.name`),
    ])

    res.json({ daily: dailyResult.rows, monthly: monthlyResult.rows, byPlan: byPlanResult.rows })
  } catch (err) {
    console.error('[analytics/revenue]', err)
    res.status(500).json({ error: 'Failed to load revenue analytics.' })
  }
})

// ─── GET /api/analytics/members ──────────────────────────────────────────────
// Member growth, churn, plan distribution

analyticsRouter.get('/members', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const interval = periodToInterval(req.query.period as string)

    const [growthResult, planDistResult, retentionResult] = await Promise.all([
      tenantQuery(slug, `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
         COUNT(*) as new_members
       FROM members
       WHERE created_at >= NOW() - $1::interval
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at) ASC`, [interval]),
      tenantQuery(slug, `SELECT mp.name as plan, COUNT(s.id) as count
       FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.status IN ('active', 'expiring_soon')
       GROUP BY mp.name`),
      tenantQuery(slug, `SELECT
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
         COUNT(*) FILTER (WHERE status = 'cancelled') as churned
       FROM members`),
    ])

    const ret = retentionResult.rows[0] as { active?: string; suspended?: string; churned?: string } ?? {}
    const totalEver = (parseInt(ret.active ?? '0') + parseInt(ret.suspended ?? '0') + parseInt(ret.churned ?? '0')) || 1
    const churnRate = Math.round((parseInt(ret.churned ?? '0') / totalEver) * 100)

    res.json({
      growth: growthResult.rows,
      planDistribution: planDistResult.rows,
      retention: retentionResult.rows[0],
      churnRate,
    })
  } catch (err) {
    console.error('[analytics/members]', err)
    res.status(500).json({ error: 'Failed to load member analytics.' })
  }
})

// ─── GET /api/analytics/checkins ─────────────────────────────────────────────
// Check-in patterns: daily totals + peak hours heatmap

analyticsRouter.get('/checkins', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const interval = periodToInterval(req.query.period as string)

    const [dailyResult, peakHoursResult, recentResult, peakGridResult] = await Promise.all([
      tenantQuery(slug, `SELECT
         TO_CHAR(checked_in_at::date, 'Dy') as day,
         COUNT(*) as count
       FROM check_ins
       WHERE checked_in_at >= NOW() - $1::interval
       GROUP BY checked_in_at::date, TO_CHAR(checked_in_at::date, 'Dy')
       ORDER BY checked_in_at::date`, [interval]),
      tenantQuery(slug, `SELECT
         EXTRACT(HOUR FROM checked_in_at)::int as hour,
         COUNT(*) as count
       FROM check_ins
       WHERE checked_in_at >= NOW() - $1::interval
       GROUP BY EXTRACT(HOUR FROM checked_in_at)
       ORDER BY hour ASC`, [interval]),
      tenantQuery(slug, `SELECT ci.id, m.name, m.avatar_url, ci.method, ci.checked_in_at
       FROM check_ins ci
       JOIN members m ON m.id = ci.member_id
       ORDER BY ci.checked_in_at DESC
       LIMIT 20`),
      // Peak grid: hour x day-of-week (0=Sun..6=Sat)
      tenantQuery(slug, `SELECT
         EXTRACT(HOUR FROM checked_in_at)::int as hour,
         EXTRACT(DOW FROM checked_in_at)::int as dow,
         COUNT(*) as count
       FROM check_ins
       WHERE checked_in_at >= NOW() - INTERVAL '90 days'
       GROUP BY EXTRACT(HOUR FROM checked_in_at), EXTRACT(DOW FROM checked_in_at)`, []),
    ])

    res.json({
      daily: dailyResult.rows,
      peakHours: peakHoursResult.rows,
      peakGrid: peakGridResult.rows,
      recent: recentResult.rows,
    })
  } catch (err) {
    console.error('[analytics/checkins]', err)
    res.status(500).json({ error: 'Failed to load check-in analytics.' })
  }
})

// ─── GET /api/analytics/activity ─────────────────────────────────────────────
// Recent activity feed: check-ins, new members, payments

analyticsRouter.get('/activity', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const [checkinsRes, membersRes, paymentsRes] = await Promise.all([
      tenantQuery(slug, `SELECT 'checkin' as type, m.name, ci.checked_in_at as time
       FROM check_ins ci JOIN members m ON m.id = ci.member_id
       ORDER BY ci.checked_in_at DESC LIMIT 10`),
      tenantQuery(slug, `SELECT 'member' as type, name, created_at as time FROM members ORDER BY created_at DESC LIMIT 5`),
      tenantQuery(slug, `SELECT 'payment' as type, m.name, p.amount, p.currency, p.paid_at as time
       FROM payments p JOIN members m ON m.id = p.member_id
       WHERE p.status IN ('paid', 'completed') ORDER BY p.paid_at DESC LIMIT 5`),
    ])

    const events = [
      ...checkinsRes.rows as Array<{type:string;name:string;time:string}>,
      ...membersRes.rows as Array<{type:string;name:string;time:string}>,
      ...paymentsRes.rows as Array<{type:string;name:string;time:string}>,
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20)

    res.json({ events })
  } catch (err) {
    console.error('[analytics/activity]', err)
    res.status(500).json({ error: 'Failed to load activity.' })
  }
})

// ─── GET /api/analytics/milestones ───────────────────────────────────────────
// Member anniversaries in next 7 days

analyticsRouter.get('/milestones', async (req, res) => {
  try {
    const slug = req.tenant.slug
    // Members whose joined_at anniversary falls within next 7 days
    const { rows } = await tenantQuery(slug, `
      SELECT m.id, m.name,
        EXTRACT(YEAR FROM AGE(NOW(), m.joined_at))::int as years,
        m.joined_at
      FROM members m
      CROSS JOIN generate_series(0, 6) AS d(day_offset)
      WHERE m.status = 'active'
        AND EXTRACT(MONTH FROM m.joined_at) = EXTRACT(MONTH FROM NOW() + make_interval(days => d.day_offset))
        AND EXTRACT(DAY FROM m.joined_at) = EXTRACT(DAY FROM NOW() + make_interval(days => d.day_offset))
      LIMIT 10
    `)
    // Deduplicate by id
    const seen = new Set<string>()
    const milestones = (rows as Array<{id:string;name:string;years:number;joined_at:string}>)
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
      .map(r => ({
        id: r.id,
        name: r.name,
        type: 'anniversary',
        detail: r.years === 0 ? 'First anniversary today!' : `${r.years} year${r.years > 1 ? 's' : ''} member`,
      }))
    res.json({ milestones })
  } catch (err) {
    console.error('[analytics/milestones]', err)
    res.status(500).json({ error: 'Failed to load milestones.' })
  }
})

// ─── GET /api/analytics/outstanding ──────────────────────────────────────────
// Members with overdue payments (grace period or expired subscriptions)

analyticsRouter.get('/outstanding', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const { rows } = await tenantQuery(slug, `
      SELECT
        m.id, m.name, m.email,
        pl.price as amount, pl.currency,
        s.expires_at,
        GREATEST(0, EXTRACT(DAY FROM NOW() - s.expires_at))::int as days_overdue
      FROM subscriptions s
      JOIN members m ON m.id = s.member_id
      JOIN membership_plans pl ON pl.id = s.plan_id
      WHERE s.status IN ('grace_period', 'expiring_soon')
        AND s.expires_at < NOW()
      ORDER BY s.expires_at ASC
      LIMIT 20
    `)
    res.json({ outstanding: rows })
  } catch (err) {
    console.error('[analytics/outstanding]', err)
    res.status(500).json({ error: 'Failed to load outstanding payments.' })
  }
})

// ─── GET /api/analytics/capacity ─────────────────────────────────────────────
// Current gym occupancy (check-ins today)

analyticsRouter.get('/capacity', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const [countRes, settingsRes] = await Promise.all([
      tenantQuery(slug, `SELECT COUNT(*)::int as current FROM check_ins WHERE checked_in_at >= date_trunc('day', NOW())`),
      tenantQuery(slug, `SELECT features FROM gym_settings WHERE id = 'singleton' LIMIT 1`),
    ])
    const current = (countRes.rows[0] as {current:number})?.current ?? 0
    const features = ((settingsRes.rows[0] as {features?: Record<string,unknown>})?.features ?? {}) as Record<string,unknown>
    const maxCapacity = (features.max_capacity as number) ?? 50
    res.json({ current, max: maxCapacity })
  } catch (err) {
    console.error('[analytics/capacity]', err)
    res.status(500).json({ error: 'Failed to load capacity.' })
  }
})

// ─── GET /api/analytics/retention ────────────────────────────────────────────
// Cohort retention: % of members still active N months after joining

analyticsRouter.get('/retention', async (req, res) => {
  try {
    const slug = req.tenant.slug
    const { rows } = await tenantQuery(slug, `
      WITH cohorts AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', joined_at), 'Mon YY') as cohort,
          DATE_TRUNC('month', joined_at) as cohort_date,
          COUNT(*) as joined
        FROM members
        WHERE joined_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', joined_at)
      ),
      retention AS (
        SELECT
          c.cohort, c.joined,
          COUNT(CASE WHEN s.status IN ('active','expiring_soon') THEN 1 END) as still_active
        FROM cohorts c
        LEFT JOIN members m ON DATE_TRUNC('month', m.joined_at) = c.cohort_date
        LEFT JOIN LATERAL (
          SELECT status FROM subscriptions WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1
        ) s ON true
        GROUP BY c.cohort, c.cohort_date, c.joined
        ORDER BY c.cohort_date ASC
      )
      SELECT cohort, joined::int, still_active::int,
        CASE WHEN joined > 0 THEN ROUND((still_active::numeric / joined) * 100) ELSE 0 END as retention_pct
      FROM retention
    `)
    res.json({ cohorts: rows })
  } catch (err) {
    console.error('[analytics/retention]', err)
    res.status(500).json({ error: 'Failed to load retention data.' })
  }
})
