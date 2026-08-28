# GYMFLOW_PLAN.md
# GymFlow — Multi-Tenant Gym Management Platform
# Version 1.0 | Full Product Specification

---

## 1. Product Overview

GymFlow is a multi-tenant SaaS platform that gives gym owners a complete operating system for their business — member management, class scheduling, subscription billing, check-in enforcement, trainer tools, and analytics — all under their own branded subdomain.

Every gym is a fully isolated tenant. Their members, data, payments, and branding never touch another gym's workspace.

**Tagline:** The operating system for modern gyms.

---

## 2. Target Users

| Role | Description |
|---|---|
| Gym owner / admin | Manages the entire gym: members, trainers, finances, settings |
| Trainer / coach | Manages their classes, attendance, and assigned clients |
| Member | Books classes, tracks workouts, pays, checks in |
| Receptionist | Front desk: manual check-in, member lookup, day passes |
| Super admin (GymFlow) | Platform-level tenant management, billing, support |

---

## 3. The Four Apps

### 3.1 Admin Dashboard (Web)
- **Stack:** Next.js 14 App Router, Tailwind CSS
- **Access:** `{gym-slug}.gymflow.app` or custom domain
- **Users:** Gym owner, admin staff, receptionist

### 3.2 Trainer Portal (Web)
- **Stack:** Next.js 14, same codebase as admin (role-gated routes)
- **Access:** Same subdomain, `/trainer` routes
- **Users:** Trainers and coaches

### 3.3 Member Client App (Mobile)
- **Stack:** React Native + Expo (SDK 51+)
- **Platforms:** iOS and Android
- **Users:** Gym members

### 3.4 Check-in Kiosk (Web, tablet-optimized)
- **Stack:** Next.js, full-screen tablet UI
- **Access:** Runs on a dedicated tablet at gym entrance
- **Users:** Members (self-service), receptionists

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend (web) | Next.js 14 App Router, Tailwind CSS, shadcn/ui |
| Mobile | React Native + Expo SDK 51 |
| Backend | Node.js + Express (REST API) |
| Database | Neon PostgreSQL (per-tenant schema isolation) |
| Cache / sessions | Upstash Redis |
| Payments | Tranzak (primary), provider-agnostic abstraction — mobile money in v2 |
| File storage | Cloudflare R2 (avatars, QR codes, media) |
| Email | Resend |
| Push notifications | Expo Push Notifications |
| SMS | Termii (Africa-first) |
| CDN / subdomains | Cloudflare |
| Auth | JWT + refresh tokens, bcrypt passwords |
| Background jobs | BullMQ (Redis-backed) |
| Deployment | Railway (API), Vercel (web), EAS (mobile) |

---

## 5. Multi-Tenancy Architecture

### Isolation model
Each gym tenant gets:
- A dedicated PostgreSQL **schema** (e.g. `tenant_crossfit_lagos`) — full data isolation
- A subdomain: `crossfit-lagos.gymflow.app` (or custom domain via Cloudflare CNAME)
- Their own branding: logo, primary color, gym name
- Their own configurable settings (grace period, membership plans, class capacity rules)

### Tenant routing
Every API request carries a `X-Tenant-ID` header (resolved from subdomain at the gateway). The API gateway middleware resolves the tenant, sets the PostgreSQL `search_path` to the correct schema, and all queries downstream are automatically scoped.

```
Request → Cloudflare → API Gateway
  → extract subdomain → resolve tenant_id
  → set search_path = tenant_{slug}
  → route to service handler
```

### Shared vs tenant-scoped tables

| Table | Scope |
|---|---|
| `tenants` | Global (public schema) |
| `tenant_plans` | Global |
| `members` | Per-tenant schema |
| `subscriptions` | Per-tenant schema |
| `classes` | Per-tenant schema |
| `bookings` | Per-tenant schema |
| `trainers` | Per-tenant schema |
| `check_ins` | Per-tenant schema |
| `payments` | Per-tenant schema |
| `notifications` | Per-tenant schema |

---

## 6. Database Schema

### Global schema (public)

```sql
-- Platform tenants
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,         -- used in subdomain
  name            TEXT NOT NULL,
  custom_domain   TEXT,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#6C47FF',
  owner_email     TEXT NOT NULL,
  plan            TEXT DEFAULT 'starter',       -- starter | pro | enterprise
  status          TEXT DEFAULT 'active',        -- active | suspended | cancelled
  grace_period_days INT DEFAULT 3,
  currency        TEXT NOT NULL DEFAULT 'XAF',  -- XAF | NGN | USD | XOF — tenant-configured
  timezone        TEXT DEFAULT 'Africa/Lagos',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- GymFlow platform subscriptions (gym owner pays GymFlow)
CREATE TABLE tenant_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  plan            TEXT NOT NULL,
  status          TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Per-tenant schema (replicated per gym)

```sql
-- Members
CREATE TABLE members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  date_of_birth   DATE,
  gender          TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  notes           TEXT,
  qr_code         TEXT UNIQUE,                  -- for check-in
  pin             TEXT,                         -- 4-digit PIN for kiosk
  status          TEXT DEFAULT 'active',        -- active | suspended | inactive
  joined_at       TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Membership plans defined by the gym
CREATE TABLE membership_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,               -- Monthly, Quarterly, Yearly, Day Pass
  description     TEXT,
  duration_days   INT NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  currency        TEXT NOT NULL,               -- configurable per tenant (e.g. XAF, NGN, USD, XOF)
  max_classes_per_week INT,                    -- null = unlimited
  allows_guest    BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Member subscriptions (the core billing entity)
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  plan_id         UUID REFERENCES membership_plans(id),
  status          TEXT NOT NULL DEFAULT 'active',
  -- status values: active | expiring_soon | grace_period | suspended | cancelled | paused
  started_at      TIMESTAMPTZ NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  grace_expires_at TIMESTAMPTZ,               -- set when entering grace_period
  cancelled_at    TIMESTAMPTZ,
  paused_at       TIMESTAMPTZ,
  pause_resume_at TIMESTAMPTZ,               -- auto-resume date
  auto_renew      BOOLEAN DEFAULT true,
  renewal_reminder_sent_at TIMESTAMPTZ,
  suspension_notified_at   TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  subscription_id UUID REFERENCES subscriptions(id),
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT NOT NULL,               -- tenant currency (XAF, NGN, USD, XOF, etc.)
  provider        TEXT NOT NULL,              -- tranzak | cash | transfer | (v2: mobile_money)
  provider_ref    TEXT,                       -- payment gateway reference
  status          TEXT NOT NULL,             -- pending | successful | failed | refunded
  payment_type    TEXT NOT NULL,             -- subscription | day_pass | class_fee | penalty
  paid_at         TIMESTAMPTZ,
  receipt_url     TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Trainers
CREATE TABLE trainers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  specialties     TEXT[],                    -- ['weightlifting','yoga','HIIT']
  bio             TEXT,
  status          TEXT DEFAULT 'active',
  joined_at       TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Class types (templates)
CREATE TABLE class_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,             -- HIIT, Yoga, Spin, Boxing
  description     TEXT,
  duration_minutes INT NOT NULL,
  color           TEXT,                      -- calendar color
  icon            TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Scheduled classes (instances)
CREATE TABLE classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id   UUID REFERENCES class_types(id),
  trainer_id      UUID REFERENCES trainers(id),
  room            TEXT,
  capacity        INT NOT NULL,
  waitlist_limit  INT DEFAULT 10,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'scheduled',  -- scheduled | live | completed | cancelled
  notes           TEXT,
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_rule TEXT,                      -- RRULE string
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Class bookings
CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID REFERENCES classes(id),
  member_id       UUID REFERENCES members(id),
  status          TEXT DEFAULT 'confirmed',  -- confirmed | waitlisted | cancelled | attended | no_show
  booked_at       TIMESTAMPTZ DEFAULT now(),
  cancelled_at    TIMESTAMPTZ,
  attended_at     TIMESTAMPTZ,
  UNIQUE(class_id, member_id)
);

-- Gym check-ins (entry log)
CREATE TABLE check_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  method          TEXT NOT NULL,             -- qr | pin | manual | face
  checked_in_at   TIMESTAMPTZ DEFAULT now(),
  checked_out_at  TIMESTAMPTZ,
  staff_id        UUID,                      -- if manual override
  blocked         BOOLEAN DEFAULT false,     -- was entry denied?
  block_reason    TEXT,
  notes           TEXT
);

-- Workout logs (member-side tracking)
CREATE TABLE workout_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  trainer_id      UUID REFERENCES trainers(id),
  logged_at       TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  duration_minutes INT
);

CREATE TABLE workout_exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id  UUID REFERENCES workout_logs(id),
  exercise_name   TEXT NOT NULL,
  sets            INT,
  reps            INT,
  weight_kg       NUMERIC(6,2),
  duration_seconds INT,
  notes           TEXT
);

-- Personal records
CREATE TABLE personal_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  exercise_name   TEXT NOT NULL,
  value           NUMERIC(8,2) NOT NULL,     -- weight in kg or time in seconds
  unit            TEXT NOT NULL,             -- kg | seconds | reps
  achieved_at     TIMESTAMPTZ DEFAULT now()
);

-- Trainer-assigned programs
CREATE TABLE programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id      UUID REFERENCES trainers(id),
  member_id       UUID REFERENCES members(id),
  name            TEXT NOT NULL,
  description     TEXT,
  starts_at       DATE,
  ends_at         DATE,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE program_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID REFERENCES programs(id),
  day_number      INT NOT NULL,              -- Day 1, Day 2, etc.
  name            TEXT,
  exercises       JSONB NOT NULL             -- [{name, sets, reps, weight, notes}]
);

-- Notifications log
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  type            TEXT NOT NULL,
  -- types: subscription_expiring | subscription_expired | grace_period |
  --        suspended | payment_failed | payment_success | class_reminder |
  --        class_cancelled | booking_confirmed | new_program | announcement
  channel         TEXT NOT NULL,             -- push | sms | email | in_app
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Announcements (gym-wide broadcasts)
CREATE TABLE announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  target          TEXT DEFAULT 'all',        -- all | active | trainers
  published_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Body metrics (member progress tracking)
CREATE TABLE body_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  recorded_at     DATE NOT NULL,
  weight_kg       NUMERIC(5,2),
  body_fat_pct    NUMERIC(4,1),
  muscle_mass_kg  NUMERIC(5,2),
  bmi             NUMERIC(4,1),
  chest_cm        NUMERIC(5,1),
  waist_cm        NUMERIC(5,1),
  hips_cm         NUMERIC(5,1),
  notes           TEXT
);

-- Day passes
CREATE TABLE day_passes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID,                      -- null if walk-in (no account)
  guest_name      TEXT,
  guest_phone     TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  payment_id      UUID REFERENCES payments(id),
  valid_date      DATE NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Staff / admin users
CREATE TABLE staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL,             -- owner | admin | receptionist | trainer
  trainer_id      UUID REFERENCES trainers(id), -- if this staff is also a trainer
  is_active       BOOLEAN DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID,
  actor_type      TEXT,                      -- staff | member | system
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  changes         JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. Feature Modules

### 7.1 Member Management
- Onboard members (manual or self-registration link)
- Member profiles: personal info, emergency contact, notes, photo
- QR code generated on signup (stored in R2, sent via email)
- 4-digit PIN as kiosk fallback
- Member status: active / suspended / inactive
- Bulk import via CSV
- Member search, filter, export
- Member notes (internal, staff-only)
- Merge duplicate member records

### 7.2 Subscription Management (core revenue protection)

**Lifecycle states:**
```
active → expiring_soon (7 days before) → grace_period (0 days, configurable)
       → suspended (grace over) → cancelled
```

**Automated daily job (runs at midnight, tenant timezone):**
- Scan all active subscriptions expiring within 7 days → mark `expiring_soon`, send reminder
- Scan expired subscriptions → enter `grace_period`, send urgent alert
- Scan grace_period entries older than N days → mark `suspended`, revoke check-in access
- Log every state transition in audit log

**Reminders schedule:**
- 7 days before expiry → push + email
- 3 days before → push + SMS
- 1 day before → push + SMS + email
- Day of expiry → push + SMS
- Grace day 1, 2, 3 → push + SMS daily
- Suspension → push + SMS + email + admin dashboard alert

**Subscription features:**
- Manual renewal by staff
- Self-renewal via member app (Tranzak hosted payment page)
- Auto-renewal (card on file)
- Pause/freeze (e.g. member traveling) with auto-resume date
- Plan upgrades and downgrades (prorated)
- Subscription notes (e.g. "paid in cash, receipt #014")
- Full payment history per member
- Refund logging

**Owner dashboard widgets:**
- Active / expiring / grace / suspended counts
- Revenue this month vs last month
- At-risk member list (sortable by days remaining)
- One-click reminder to individual members
- Bulk remind all expiring members

### 7.3 Scheduling & Classes

- Create class types (HIIT, Yoga, Spin, Boxing, etc.) with color coding
- Schedule individual or recurring classes (RRULE-based)
- Assign trainers and rooms
- Set capacity and waitlist limits
- Member booking via app or web
- Waitlist auto-promotion when slot opens
- Cancel class with bulk notification to booked members
- Class check-in (trainer marks attendance)
- No-show tracking
- Class history per member and per trainer

### 7.4 Check-in & Access Control

**Check-in methods:**
- QR code scan (camera on kiosk or trainer's phone)
- 4-digit PIN entry on kiosk
- Manual check-in by receptionist (member lookup)
- (Future) Face recognition

**Check-in gate logic:**
```
Scan QR / enter PIN
  → Lookup member
  → Check subscription status (Redis cache, <50ms)
  → If active or grace_period → GREEN screen, door opens, log check-in
  → If suspended → RED screen, show expiry details, alert front desk
  → If expiring_soon → YELLOW screen, show renewal prompt, allow entry
```

**Features:**
- Check-in / check-out timestamps
- Visit duration calculation
- Daily / weekly / monthly visit history per member
- Peak hours heatmap (admin analytics)
- Blocked entry log with reasons
- Manual override by staff (with audit trail)

### 7.5 Payments & Billing

**Payment providers (abstraction layer):**
```typescript
// Single env var switches provider
PAYMENT_PROVIDER=tranzak   // tranzak | (future: mobile_money)

interface PaymentProvider {
  initializeTransaction(data): Promise<PaymentLink>
  verifyTransaction(ref): Promise<PaymentStatus>
  createCustomer(data): Promise<Customer>
  chargeCard(token, amount): Promise<ChargeResult>
}
```

> **Mobile money** (MTN Mobile Money, Orange Money) will be added as a second payment method in v2. The abstraction layer is designed to accommodate this without breaking changes.

**Payment features:**
- Subscription payment (Tranzak hosted payment page or card-on-file)
- Day pass purchase
- Class fee (if gym charges per class on top of subscription)
- Cash and bank transfer recording (manual log)
- Automatic receipts via email
- Payment history per member
- Failed payment alerts to owner
- Revenue reports: daily, weekly, monthly, yearly
- Outstanding balance per member
- Refund tracking

### 7.6 Trainer Portal

- Trainer profile and specialties
- Personal class schedule (upcoming classes)
- Class roster (who is booked)
- Mark attendance (present / absent / no-show) per class
- Client list (members assigned to them)
- Assign workout programs to clients
- Write session notes per client
- View client body metrics and progress
- Trainer performance: classes taught, attendance rate, ratings

### 7.7 Workout Tracking (Member App)

- Log workouts (exercises, sets, reps, weight)
- Auto-populate from trainer-assigned programs
- Personal records (PRs) — auto-detected when a new max is logged
- Progress charts: weight lifted over time, workout frequency
- Body metrics log (weight, body fat, measurements)
- Streak tracking (consecutive workout days)
- Weekly summary card

### 7.8 Member App (React Native + Expo)

**Screens:**
- Home: today's classes, subscription status, upcoming booking
- Schedule: weekly class timetable, filter by type/trainer
- Book: class detail + booking confirmation
- My Bookings: upcoming and past
- Check-in: QR code display for scanning
- Workouts: log workout, view history, PRs
- My Body: body metrics, progress charts
- Payments: subscription status, renew, payment history
- Notifications: inbox
- Profile: personal info, settings, emergency contact

**Key UX details:**
- Subscription expiry banner shown prominently when expiring_soon or grace_period
- One-tap renewal from home screen
- QR code works offline (signed JWT embedded in QR, verified locally on kiosk)
- Push notifications for class reminders (30 min before booked class)
- Dark mode support

### 7.9 Notifications System

| Trigger | Channels | Recipient |
|---|---|---|
| Subscription expiring (7d) | Push + Email | Member |
| Subscription expiring (3d) | Push + SMS | Member |
| Subscription expiring (1d) | Push + SMS + Email | Member |
| Grace period day 1/2/3 | Push + SMS | Member + Owner alert |
| Subscription suspended | Push + SMS + Email | Member + Owner |
| Payment successful | Push + Email | Member |
| Payment failed | Push + SMS | Member + Owner |
| Class booking confirmed | Push | Member |
| Class cancelled | Push + SMS | All booked members |
| Class reminder | Push | Booked members (30 min before) |
| Waitlist promoted | Push | Member |
| New program assigned | Push | Member |
| Gym announcement | Push + In-app | All / targeted group |
| New member joined | In-app | Owner |

### 7.10 Analytics & Reporting (Admin)

**Revenue:**
- Monthly recurring revenue (MRR)
- Daily / weekly / monthly revenue chart
- Revenue by plan type
- Outstanding balances total
- Churn rate (cancelled this month)
- New subscriptions vs renewals

**Members:**
- Total active members over time
- New signups per month
- Churn breakdown (cancelled / suspended)
- Retention rate
- Average membership duration

**Attendance:**
- Total check-ins per day / week / month
- Peak hours heatmap (hour × day of week)
- Most popular classes
- No-show rate per class type

**Trainers:**
- Classes taught per trainer
- Attendance rate per trainer
- Most popular trainer

**Exports:**
- All reports exportable to CSV
- Member list export
- Payment report export (for accounting)

### 7.11 Gym Settings (Admin)

- Gym profile: name, logo, address, phone, website
- Branding: primary color
- Custom domain setup
- Operating hours
- Grace period duration (1–7 days, default 3)
- Membership plans: create, edit, deactivate
- Class types: create, edit, deactivate
- Rooms / locations
- Staff management: invite, assign roles, deactivate
- Notification preferences (which channels to use)
- Payment provider configuration (API keys, webhook URL)
- SMS sender ID
- Member self-registration: on/off, requires approval
- Waiver / terms text (shown on member signup)
- Data export (full gym data backup)

### 7.12 Walk-in & Day Pass Management

- Sell day passes to walk-ins (no account needed)
- Record guest name and phone
- Generate one-day QR code
- Payment via cash, transfer, or online link
- Day pass log for owner

### 7.12b Announcements & Communication

- Broadcast announcements to all members / active only / trainers
- Schedule announcements in advance
- Announcement expiry date
- Send via push + in-app
- View open/read rates

---

## 7.13 Push Notifications (Full Implementation)

### Overview
Push notifications use **Expo Push Notifications** which handles delivery to both iOS (APNs) and Android (FCM) from a single API call. Every notification is tenant-scoped — the member sees their gym's name, not "GymFlow".

### Expo push token lifecycle

```
Member installs app → opens for first time
  → app calls registerForPushNotificationsAsync()
  → Expo returns: ExponentPushToken[xxxxxxxxxxxxxx]
  → app sends token to: POST /api/member/push-token
  → API stores: { member_id, tenant_id, expo_token, device_platform, created_at }

Member switches gym:
  → app detects new tenant_id on login
  → POST /api/member/push-token called again with new tenant_id
  → old token record updated to new tenant_id
  → member now receives only their current gym's notifications

Member logs out / uninstalls:
  → DELETE /api/member/push-token called on logout
  → Expo invalidated tokens auto-removed via ticket error scanning
```

**DB table:**
```sql
CREATE TABLE push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID REFERENCES members(id) ON DELETE CASCADE,
  expo_token   TEXT NOT NULL,
  platform     TEXT NOT NULL,              -- ios | android
  is_active    BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, expo_token)
);
```

### Notification template system

Every notification type has a template stored per-tenant. Templates use `{{variables}}` resolved at send time:

```typescript
// Template stored in DB or config
const TEMPLATES = {
  subscription_expiring: {
    title: '{{gym_name}} — membership expiring',
    body:  'Hi {{member_name}}, your {{plan_name}} expires in {{days_left}} day(s). Tap to renew.',
    data:  { screen: 'Subscription', action: 'renew' }
  },
  subscription_suspended: {
    title: '{{gym_name}} — access suspended',
    body:  'Your membership has expired. Renew now to restore gym access.',
    data:  { screen: 'Subscription', action: 'renew' }
  },
  class_reminder: {
    title: '{{class_name}} starts in 30 minutes',
    body:  '{{trainer_name}} is ready for you. Room: {{room}}.',
    data:  { screen: 'Bookings', class_id: '{{class_id}}' }
  },
  class_cancelled: {
    title: '{{gym_name}} — class cancelled',
    body:  '{{class_name}} at {{time}} has been cancelled. Sorry for the inconvenience.',
    data:  { screen: 'Schedule' }
  },
  payment_success: {
    title: 'Payment confirmed',
    body:  '{{gym_name}} received {{currency}} {{amount}}. Your {{plan_name}} is active until {{expires_at}}.',
    data:  { screen: 'Subscription' }
  },
  waitlist_promoted: {
    title: 'Spot available in {{class_name}}!',
    body:  'A spot opened up. Confirm within 2 hours to secure your place.',
    data:  { screen: 'Bookings', class_id: '{{class_id}}', action: 'confirm' }
  },
  milestone_pr: {
    title: 'New personal record!',
    body:  'You just hit a new PR — {{exercise}}: {{value}}{{unit}}. Keep going!',
    data:  { screen: 'Workouts' }
  },
  announcement: {
    title: '{{gym_name}}',
    body:  '{{announcement_title}}',
    data:  { screen: 'Notifications' }
  }
}
```

### Sending a notification (code pattern)

```typescript
// services/notification.service.ts
import Expo, { ExpoPushMessage } from 'expo-server-sdk'

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })

async function sendPushNotification(
  tenantId: string,
  memberId: string,
  type: keyof typeof TEMPLATES,
  vars: Record<string, string>
) {
  const tokens = await db.query(
    `SELECT expo_token FROM push_tokens
     WHERE member_id = $1 AND is_active = true`, [memberId]
  )

  const tenant = await getTenantBranding(tenantId)
  const template = TEMPLATES[type]

  const messages: ExpoPushMessage[] = tokens.rows.map(row => ({
    to: row.expo_token,
    title: interpolate(template.title, { ...vars, gym_name: tenant.name }),
    body:  interpolate(template.body,  { ...vars, gym_name: tenant.name }),
    data:  template.data,
    sound: 'default',
    badge: 1,
    channelId: 'gymflow-default',  // Android channel
  }))

  const chunks = expo.chunkPushNotifications(messages)
  const tickets = []

  for (const chunk of chunks) {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
    tickets.push(...ticketChunk)
    await logNotification(memberId, type, ticketChunk)
  }

  // Scan receipts 15 min later to catch DeviceNotRegistered errors
  await scheduleReceiptScan(tickets)
}

function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}
```

### Notification scheduling (BullMQ jobs)

```typescript
// Triggered by subscription cron, class scheduler, etc.
await notificationQueue.add('send-push', {
  tenantId, memberId, type: 'subscription_expiring',
  vars: { member_name: 'Amaka', plan_name: 'Monthly Pro', days_left: '3' }
}, {
  delay: 0,
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
})

// Class reminder: scheduled 30 min before class_start
await notificationQueue.add('send-push', {
  tenantId, memberId: bookingMemberId, type: 'class_reminder',
  vars: { class_name, trainer_name, room }
}, {
  delay: classStartMs - Date.now() - 30 * 60 * 1000
})
```

### In-app notification inbox

Every push notification is also stored in the `notifications` table and shown in the member app's notification bell screen. Members who have push disabled can still see all alerts in-app.

**Member notification preferences (stored per member):**
```sql
ALTER TABLE members ADD COLUMN notification_prefs JSONB DEFAULT '{
  "push_enabled": true,
  "email_enabled": true,
  "sms_enabled": true,
  "class_reminders": true,
  "subscription_alerts": true,
  "milestones": true,
  "announcements": true
}';
```

---

## 7.14 Multi-Tenant App Customization

### The core problem
One app binary on the App Store must feel like a completely different branded app to each gym's members. CrossFit Lagos members see purple, their gym's logo, and a leaderboard. FitZone Abuja members see teal, a different logo, and no leaderboard (they're on Growth plan). Same APK/IPA, zero code changes.

### How it works — 3 layers

**Layer 1: Tenant detection on first launch**

```
User opens app first time
  → Onboarding screen: "Enter your gym code" (e.g. CROSSFIT-LAGOS)
     OR scan gym's QR code (deeplink: gymflow://join?gym=crossfit-lagos)
     OR tap magic link from gym owner's WhatsApp
  → App calls: GET /api/tenant/resolve?slug=crossfit-lagos
  → Response: branding config + feature flags
  → Stored in AsyncStorage as active_tenant
  → App re-renders with gym's theme
```

**Layer 2: Branding config from API**

Every login response includes a `tenant` object. The React Native app stores it in a global context that every screen reads from:

```typescript
// types/tenant.ts
interface TenantBranding {
  id:              string
  slug:            string
  name:            string          // "CrossFit Lagos"
  logo_url:        string          // R2 URL
  primary_color:   string          // "#6C47FF"
  secondary_color: string          // "#1a1a2e"
  splash_bg_color: string          // shown on app launch
  font:            'default' | 'inter' | 'roboto'
  timezone:        string          // "Africa/Lagos"
  currency:        string          // tenant-configured: "XAF" | "NGN" | "USD" | "XOF"
  features: {
    show_leaderboard:      boolean  // WOD leaderboard on TV + app
    show_body_metrics:     boolean  // body tracking screens
    show_trainer_ratings:  boolean  // post-class star ratings
    guest_passes:          boolean  // bring-a-friend
    referral_system:       boolean  // referral links + rewards
    wod_leaderboard:       boolean  // WOD logging + leaderboard
    show_announcements:    boolean  // gym announcements inbox
    allow_self_renewal:    boolean  // renew inside app vs reception only
  }
}
```

**Layer 3: ThemeContext — applies to every screen**

```typescript
// context/ThemeContext.tsx
import { createContext, useContext } from 'react'
import { TenantBranding } from '@/types/tenant'

const ThemeContext = createContext<TenantBranding | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('ThemeContext not initialized')
  return ctx
}

// Used in any screen:
const { primary_color, name, features } = useTheme()

// Navigation bottom tab hides "Workouts" if body_metrics disabled:
const tabs = [
  { name: 'Home',     icon: 'home' },
  { name: 'Schedule', icon: 'calendar' },
  { name: 'Check-in', icon: 'qrcode' },
  features.show_body_metrics && { name: 'Workouts', icon: 'barbell' },
  { name: 'Profile',  icon: 'user' },
].filter(Boolean)
```

### Splash screen & app icon per gym
Since the app binary is the same, the App Store icon is always "GymFlow". However:
- Splash screen background color is set from `splash_bg_color` stored in AsyncStorage before the JS bundle loads (using `expo-splash-screen` with a native-level background color)
- Gym logo loads on the splash screen as soon as the bundle starts
- This gives a near-native branded feel without multiple App Store listings

### Feature flag enforcement
Feature flags control what appears — screens, bottom tabs, action buttons. Disabled features are never just hidden; they're removed from navigation so members can't navigate there even via deep links:

```typescript
// Deep link guard
if (screen === 'Leaderboard' && !features.show_leaderboard) {
  return navigate('Home')  // redirect, never show error
}
```

### Gym code / onboarding QR
Gym owner generates their onboarding QR from the admin dashboard. The QR encodes:
`gymflow://join?gym=crossfit-lagos&invite=OPTIONAL_PROMO_CODE`

Member scans → app opens → auto-configures to CrossFit Lagos → member fills in signup form → branded experience from first screen.

### App store listing
- Single listing: "GymFlow — gym management"
- Screenshots show the admin-configurable branded experience
- Description mentions "branded for your gym by your gym owner"

### Push notification branding
Since iOS/Android show the app name next to every notification, the notification title always starts with the gym name (`CrossFit Lagos — membership expiring`) to maintain the branded feel even when the system shows "GymFlow" as the sender app.

---

## 7.15 Subscription Cards & QR Code System

### Three card types

#### A. Digital member card (in-app)
The primary check-in credential. Lives on the member's phone, always one tap from the home screen.

**Contents:**
- Gym logo + name + subdomain
- Member name, initials avatar (or photo if uploaded)
- Member ID (e.g. `GF-20240891`)
- Membership plan badge
- Expiry date
- Subscription status pill (Active / Expiring / Grace / Suspended)
- QR code (68×68px minimum, high contrast)

**QR code format:** Signed JWT containing:
```json
{
  "mid": "member-uuid",
  "tid": "tenant-uuid",
  "exp": 1750000000,
  "iat": 1749913600,
  "v":   1
}
```
- Signed with `JWT_SECRET` — kiosk verifies signature locally, no network needed
- `exp` set to +24 hours from issue — refreshed silently when app opens
- If subscription is `suspended`, a new valid QR is NOT issued — old ones expired
- If offline, kiosk accepts QR if signature is valid AND `exp` has not passed

**Status-aware display:**
- Active → green status pill, normal QR
- Expiring soon → amber pill + "Renew now" button below card
- Grace period → orange pill + countdown ("2 days left") + urgent renew CTA
- Suspended → red pill + QR replaced with lock icon + "Contact your gym"

---

#### B. Printable / PDF membership card
Generated on: member signup, plan renewal, or on-demand from admin dashboard.

**Layout (credit-card proportions, 85.6mm × 54mm):**
- Header: gym primary color background, gym logo, gym name, "Member Access Card"
- Body: member avatar circle, full name, plan name, member ID, join date
- Footer: valid period dates, status badge, QR code (right-aligned)

**Tech:** Generated server-side using `@react-pdf/renderer` (React-based PDF generation).
- Gym logo and member photo fetched from R2
- QR code embedded as base64 PNG inside the PDF
- Font: Inter or gym-configured font
- Primary color pulled from tenant settings — card header matches gym branding
- PDF stored temporarily in R2 with a signed URL (expires in 1 hour)
- Delivered via: email attachment on signup, "Download card" button in admin and member app

**Trigger points:**
- Auto-generated and emailed on first payment
- Auto-generated and emailed on every renewal
- Admin can regenerate at any time ("Resend card" button on member profile)
- Member can download from their app profile

---

#### C. WhatsApp / shareable renewal confirmation card
A branded image (PNG, 600×800px) auto-generated after every successful payment.

**Contents:**
- Gym logo + name at top
- Large checkmark icon
- "Membership renewed!" heading
- Member name
- Plan name, amount paid, valid from / valid until dates
- Status: Active (green)
- Small QR code at bottom right
- "Powered by GymFlow" footer

**Tech:** Generated server-side using `sharp` + `@napi-rs/canvas` (Node.js canvas).
- Template system: gym can choose from 3 card templates (dark, light, branded)
- Delivered via:
  - WhatsApp (Termii WhatsApp API or direct link)
  - SMS with image link
  - Email attachment
  - "Share" button in member app (native share sheet — WhatsApp, Telegram, save to photos)

**Also generated for:**
- New member welcome card ("Welcome to CrossFit Lagos, Amaka!")
- Expiry reminder card ("Your membership expires in 3 days — renew now")
- Grace period alert card ("Your access expires tonight — renew to keep checking in")

---

### QR code lifecycle

```
Member pays → subscription activated
  → JWT signed with 24h expiry → stored as member.qr_token
  → QR rendered in app from token

Member opens app → app calls GET /api/member/me/qr
  → server checks: is subscription active or grace_period?
    → YES: return fresh signed JWT (24h)
    → NO (suspended): return { blocked: true, reason: "..." }

Member scans at kiosk → kiosk verifies JWT signature locally
  → valid signature + not expired + subscription not suspended → GREEN
  → invalid / expired → fetch from API (online fallback)
  → suspended flag in Redis → RED, alert front desk
```

---

## 7.15 Waitlist System

When a class hits capacity:
- Member joins waitlist (position tracked per class)
- When a booking is cancelled (by member or admin):
  - Next waitlist member is promoted automatically
  - Push notification: "A spot opened in HIIT at 7AM — you have 2 hours to confirm"
  - If not confirmed within 2 hours → next person on waitlist is promoted
  - Slot cycles through the full waitlist until filled or all pass
- Gym configures max waitlist size per class type (default: 10)
- Member can see their waitlist position in the app
- Admin sees waitlist per class in the class detail view

**DB additions:**
```sql
ALTER TABLE bookings ADD COLUMN waitlist_position INT;
ALTER TABLE bookings ADD COLUMN waitlist_promoted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN waitlist_confirm_by  TIMESTAMPTZ;
```

---

## 7.16 Freeze / Pause Subscriptions

Members (or admins on their behalf) can freeze a subscription:

**Rules:**
- Max freeze duration: 30 days (configurable per tenant)
- Max 2 freezes per subscription period
- Freeze shifts the `expires_at` forward by the freeze duration
- During freeze: check-in blocked, no reminders sent
- Auto-resumes on `pause_resume_at` date
- Member notified 1 day before auto-resume

**Use cases:** Travel, injury, maternity, surgery, vacation.

**Admin view:** Frozen members shown in separate "Paused" filter on subscription dashboard.

---

## 7.17 Guest Passes

- Members on qualifying plans (Growth / Pro tiers) get N guest passes per month (configurable)
- Guest gets a one-day QR code valid for that calendar day only
- Guest's name and phone number recorded
- Logged against the host member's account
- Guest pass limit resets on the 1st of each month
- Admin can see all guest visits in the check-in log (type = `guest`)
- Guest passes are non-transferable and cannot be stacked

---

## 7.18 Trainer Ratings

- After every class ends, booked members who attended get a push notification (30 min after class end)
- Prompt: "How was your session with [Trainer Name]?" → 1–5 star tap, optional text comment
- Rating window: 24 hours after class end, then prompt expires
- Trainer sees their own average rating and comments in trainer portal
- Owner sees all trainer ratings + average in analytics
- Ratings are anonymous to the trainer (they see stars + comment text, not who submitted)
- Admin can flag or delete inappropriate comments

**DB addition:**
```sql
CREATE TABLE class_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID REFERENCES classes(id),
  member_id   UUID REFERENCES members(id),
  trainer_id  UUID REFERENCES trainers(id),
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, member_id)
);
```

---

## 7.19 Late Cancellation Policy

- If a member cancels a booking within N hours of class start (default: 2 hours), it counts as a late cancel
- Configurable per tenant: N hours (1–24), and penalty type:
  - `warning` — log it, no action
  - `fee` — charge a late cancel fee (configurable amount, e.g. ₦500)
  - `cooldown` — suspend booking privileges for 48 hours
- Late cancel count shown on member profile
- Members receive a push notification explaining the late cancel policy when it triggers
- Admin can waive individual late cancels

---

## 7.20 Referral System

- Every active member gets a unique referral link: `crossfitlagos.gymflow.app/join?ref=AMAKA891`
- When a referred person signs up and completes their first payment:
  - Referrer gets: configurable reward (e.g. 7 free days added to subscription, or ₦2,000 discount on next renewal)
  - Referred gets: configurable welcome discount (e.g. 10% off first month)
- Rewards are applied automatically on next renewal
- Referral dashboard in member app: "You've referred 3 people — 21 free days earned"
- Admin sees full referral tree and reward ledger

**DB addition:**
```sql
CREATE TABLE referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID REFERENCES members(id),
  referred_id     UUID REFERENCES members(id),
  status          TEXT DEFAULT 'pending',  -- pending | converted | rewarded
  converted_at    TIMESTAMPTZ,
  reward_days     INT,
  reward_amount   NUMERIC(10,2),
  reward_applied_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 7.21 Walk-in & Day Pass Management

- Sell day passes at front desk — no membership account required
- Receptionist enters guest name + phone, selects day pass type, takes payment
- System generates a one-day QR code valid until midnight that day
- QR printed or sent via SMS/WhatsApp to guest's phone
- Day pass log: all walk-ins listed by date, searchable by name/phone
- Convert walk-in to member: one-click from day pass record
- Multiple day pass types: Single visit, Family day pass, Trial week pass

---

## 7.22 Body Metrics & Progress Tracking

Members can log body metrics over time:
- Weight (kg), body fat %, muscle mass, BMI
- Chest, waist, hip measurements (cm)
- Progress photos (stored in R2, private to member + assigned trainer)
- Charts: weight over time, body fat trend, measurement changes
- Trainer can view their assigned members' metrics
- Milestone badges: "Lost 5kg", "First PR", "30-day streak"

---

## 7.23 Announcements & Mass Communication

- Gym owner creates announcements (title + rich text body)
- Target: All members / Active only / Trainers only / Specific plan
- Schedule in advance or publish immediately
- Set expiry date (announcement disappears from member app after expiry)
- Delivery: push notification + in-app inbox
- Optional: also send as email blast (toggle)
- Analytics: delivered count, opened count, read rate
- Members see announcement bell badge in app when unread

---

## 7.24 TV Display Screen (Gym Wall Display)

A full-screen web app that runs in any browser on a wall-mounted TV, Chromecast, Fire Stick, or HDMI laptop. No app install required — the gym owner opens the URL once, sets it to full screen, and it runs forever with auto-refresh.

**Access URL:** `{gym-slug}.gymflow.app/tv?token={display_token}`
- `display_token` is a long-lived read-only JWT (no expiry, revocable from admin)
- Scoped to display-only data — cannot access member PII, payments, or admin actions
- Gym owner generates the token from Settings → Display screens

---

### Slides (owner configures order and duration in admin)

#### Slide 1 — Today's class schedule
- All classes for today in a grid (up to 6 visible at once)
- Each card shows: class name, trainer, time, room, spots remaining
- Color-coded status: Done (gray) / Live now (purple, pulsing) / Next up (green) / Upcoming (default)
- Spots remaining: green (plenty) / amber (<5 left) / red (Full)
- Current class auto-highlighted based on real time

#### Slide 2 — Leaderboard / workout of the day
- Trainer posts a WOD (workout of the day) from the trainer portal
- Members log their results via the mobile app during or after class
- TV shows top 5 ranked by score (weight, time, reps — trainer defines metric)
- Gold / silver / bronze highlights for top 3
- Updates live as new scores come in
- Resets daily — archive of past WODs available in admin

#### Slide 3 — Member milestones
- Auto-generated from system events:
  - New PR logged → "Kofi just hit a 142kg deadlift PR!"
  - Streak milestone (7, 30, 60, 100 days) → "Amaka — 30-day streak!"
  - Membership anniversary (3 months, 6 months, 1 year, etc.)
  - First class completed
  - Weight loss milestone (if member opts in to sharing)
- Milestones appear for 24 hours then rotate off
- Member can opt out of public milestone display (privacy setting in app)

#### Slide 4 — Live check-in feed
- Shows last 6–10 check-ins with member name (first + last initial), plan type, and time
- Updates in real time via WebSocket (Socket.io)
- Creates social energy and accountability in the gym
- Members can opt out of appearing in the feed (privacy setting)

#### Slide 5 — Gym announcements / promotions
- Owner creates announcement slides from admin panel
- Rich text + optional background image (from R2)
- Examples: "Refer a friend — get 7 free days", "New class added: Saturday Pilates", "Gym closed Monday for holiday"
- Schedule in advance, set expiry date

#### Slide 6 — Motivational quote
- Rotating library of fitness quotes (built-in, curated list)
- Owner can add custom quotes
- New quote every slide rotation

---

### Bottom ticker (always visible)
A scrolling ticker bar at the bottom of every slide showing:
- Recent check-ins ("Kofi just checked in")
- Class reminders ("HIIT starts in 30 minutes — 2 spots left")
- Milestone shoutouts
- Gym announcements

---

### Technical implementation

**Stack:** Next.js page at `/tv`, full-screen, no navigation chrome
**Real-time:** Socket.io room per tenant (`room: tenant_id + ':display'`)
**Data polling fallback:** If WebSocket drops, polls `/api/display/live` every 30 seconds
**Offline resilience:** Last known data shown if API unreachable — never blank screen
**Auto-refresh:** Full page reload every 6 hours (catches deployments silently)

**Display settings (admin configurable):**
```
Slides to show:       [x] Schedule  [x] Leaderboard  [x] Milestones  [x] Check-ins  [x] Announcements
Slide duration:       10 seconds (range: 5–60s)
Show ticker:          Yes
Show clock:           Yes
Display theme:        Dark (default) | Light | Branded (uses gym primary color)
Check-in feed privacy: Show first name + last initial only
```

**New DB table:**
```sql
CREATE TABLE display_screens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL DEFAULT 'Main screen',
  token         TEXT UNIQUE NOT NULL,
  slides_config JSONB NOT NULL,
  -- { order: ['schedule','leaderboard','milestones','checkin','announcement','quote'],
  --   duration_seconds: 10, show_ticker: true, theme: 'dark' }
  is_active     BOOLEAN DEFAULT true,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE wod_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wod_id        UUID NOT NULL,
  member_id     UUID REFERENCES members(id),
  score         NUMERIC(10,2) NOT NULL,
  unit          TEXT NOT NULL,   -- kg | reps | seconds | meters
  logged_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE wods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id    UUID REFERENCES trainers(id),
  title         TEXT NOT NULL,
  description   TEXT,
  metric        TEXT NOT NULL,   -- max_weight | total_reps | fastest_time | total_distance
  unit          TEXT NOT NULL,
  date          DATE NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

**New API routes:**
```
GET  /api/display/live          → schedule, leaderboard, milestones, recent check-ins (display token auth)
GET  /api/display/wod/today     → today's WOD + leaderboard
POST /api/wod                   → trainer creates WOD
POST /api/wod/:id/score         → member logs WOD score (from app)
GET  /api/settings/display      → list display screen tokens
POST /api/settings/display      → create new display screen token
DELETE /api/settings/display/:id → revoke token
```

---

## 8. Subscription State Machine (Full)

```
States: active | expiring_soon | grace_period | suspended | paused | cancelled

Transitions:
  new payment           → active
  active + 7d warning   → expiring_soon
  expiring_soon renewed → active
  expiring_soon expired → grace_period
  grace_period renewed  → active
  grace_period elapsed  → suspended
  suspended + payment   → active
  any + pause request   → paused
  paused + resume_date  → active
  any + cancel request  → cancelled

Check-in access:
  active          → ALLOW
  expiring_soon   → ALLOW + show renewal banner
  grace_period    → ALLOW + show urgent banner
  suspended       → BLOCK + alert front desk
  paused          → BLOCK + show pause message
  cancelled       → BLOCK
```

---

## 9. API Routes Reference

### Auth
```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Members
```
GET    /api/members                    list (search, filter, paginate)
POST   /api/members                    create
GET    /api/members/:id                detail
PATCH  /api/members/:id                update
DELETE /api/members/:id                soft delete
GET    /api/members/:id/subscription   current subscription
GET    /api/members/:id/payments       payment history
GET    /api/members/:id/check-ins      check-in history
GET    /api/members/:id/bookings       class bookings
GET    /api/members/:id/workouts       workout logs
GET    /api/members/:id/metrics        body metrics
POST   /api/members/import             bulk CSV import
```

### Subscriptions
```
GET    /api/subscriptions              list (filter by status)
POST   /api/subscriptions              create / assign plan to member
PATCH  /api/subscriptions/:id          update status, pause, cancel
POST   /api/subscriptions/:id/renew    manual renew
POST   /api/subscriptions/:id/pause    pause with resume date
POST   /api/subscriptions/:id/resume   manual resume
GET    /api/subscriptions/expiring     members expiring within N days
GET    /api/subscriptions/at-risk      grace + suspended list
POST   /api/subscriptions/remind-bulk  send reminders to all expiring
```

### Payments
```
POST   /api/payments/initialize        create payment link
GET    /api/payments/verify/:ref       verify provider transaction
POST   /api/payments/record-cash       record offline payment
GET    /api/payments                   list payments
GET    /api/payments/:id               detail + receipt
POST   /api/payments/:id/refund        log refund
```

### Classes
```
GET    /api/classes                    list (date range, trainer, type)
POST   /api/classes                    create
GET    /api/classes/:id                detail + roster
PATCH  /api/classes/:id                update
DELETE /api/classes/:id                cancel class
POST   /api/classes/:id/book           member books class
DELETE /api/classes/:id/book           member cancels booking
POST   /api/classes/:id/attendance     trainer marks attendance
```

### Check-in
```
POST   /api/checkin                    QR / PIN check-in attempt
POST   /api/checkin/manual             staff manual check-in
POST   /api/checkin/:id/checkout       record checkout
GET    /api/checkin/history            check-in log
```

### Analytics
```
GET    /api/analytics/revenue          revenue summary
GET    /api/analytics/members          member growth stats
GET    /api/analytics/attendance       check-in / peak hours data
GET    /api/analytics/classes          class popularity / no-show rates
GET    /api/analytics/trainers         trainer performance
```

### Webhooks
```
POST   /api/webhooks/tranzak           Tranzak payment events
```

---

## 10. Build Phases

### Phase 1 — Foundation (Weeks 1–3)
- [ ] Tenant onboarding (gym signup, subdomain provisioning)
- [ ] PostgreSQL schema per tenant
- [ ] Staff auth (JWT, roles)
- [ ] Member CRUD
- [ ] Membership plan CRUD
- [ ] Basic admin dashboard layout + sidebar

### Phase 2 — Subscription Engine (Weeks 4–5)
- [ ] Subscription creation and state machine
- [ ] Daily cron job (BullMQ) for state transitions
- [ ] Notification triggers (push + SMS + email)
- [ ] Tranzak payment integration (initialize + verify)
- [ ] Cash/transfer manual recording
- [ ] Subscription dashboard (owner view)
- [ ] At-risk member list

### Phase 3 — Check-in System (Week 6)
- [ ] QR code generation per member (offline-capable signed JWT)
- [ ] PIN assignment
- [ ] Kiosk app (tablet UI)
- [ ] Check-in gate logic (Redis subscription state lookup)
- [ ] Blocked entry handling + front desk alert
- [ ] Check-in log

### Phase 4 — Scheduling (Weeks 7–8)
- [ ] Class type management
- [ ] Class scheduling (single + recurring via RRULE)
- [ ] Trainer assignment
- [ ] Member booking via admin
- [ ] Waitlist management
- [ ] Class cancellation + bulk notification
- [ ] Trainer attendance marking

### Phase 5 — Member Mobile App (Weeks 9–11)
- [ ] Expo project setup, navigation, auth
- [ ] Home screen (subscription status + today's classes)
- [ ] Schedule + booking
- [ ] QR code screen
- [ ] Notifications inbox
- [ ] Subscription status + renewal (Tranzak in-app)
- [ ] Profile

### Phase 6 — Workout Tracking (Weeks 12–13)
- [ ] Workout log (exercises, sets, reps, weight)
- [ ] PR auto-detection
- [ ] Body metrics log + charts
- [ ] Trainer program assignment
- [ ] Progress views in member app

### Phase 7 — Cards & QR System (Week 14)
- [ ] Digital member card in mobile app (QR display, status-aware)
- [ ] Offline-capable signed JWT QR generation + verification
- [ ] Printable PDF card generation (`@react-pdf/renderer`)
- [ ] WhatsApp/shareable renewal image generation (`sharp` + canvas)
- [ ] Auto-send card on signup and renewal via email + WhatsApp

### Phase 8 — TV Display (Week 15)
- [ ] `/tv` full-screen Next.js page
- [ ] Display token system (long-lived, revocable)
- [ ] Schedule slide (live class status, spot counts)
- [ ] Leaderboard slide + WOD system (trainer creates, members log scores)
- [ ] Milestones slide (PR auto-detection, streak triggers, anniversaries)
- [ ] Check-in feed slide (real-time via Socket.io)
- [ ] Scrolling ticker bar
- [ ] Admin display settings panel (slide order, duration, theme)

### Phase 9 — Extra Features (Weeks 16–17)
- [ ] Waitlist system (auto-promotion, 2-hour confirmation window)
- [ ] Freeze / pause subscriptions with auto-resume
- [ ] Guest pass system
- [ ] Trainer ratings (post-class push prompt)
- [ ] Late cancellation policy (configurable penalty types)
- [ ] Referral system (unique links, reward ledger)
- [ ] Body metrics + progress photos
- [ ] Milestone badges

### Phase 10 — Analytics & Polish (Weeks 18–19)
- [ ] Revenue analytics dashboard (MRR, churn, plan breakdown)
- [ ] Member growth charts
- [ ] Attendance heatmap (peak hours)
- [ ] Class and trainer analytics
- [ ] CSV exports (members, payments, attendance)
- [ ] Announcements module (scheduler, targeting, read rates)
- [ ] Gym settings (branding, plans, rooms, staff, display screens)
- [ ] Day pass management

---

## 11. Pricing Tiers (GymFlow SaaS)

| Plan | Price | Members | Features |
|---|---|---|---|
| Starter | ₦15,000/mo | Up to 100 | Core features, 1 admin, no analytics |
| Growth | ₦35,000/mo | Up to 500 | All features, 5 staff, full analytics |
| Pro | ₦75,000/mo | Up to 2,000 | All features, unlimited staff, custom domain, priority support |
| Enterprise | Custom | Unlimited | White-label, dedicated DB, SLA, onboarding |

---

## 12. Environment Variables

```env
# App
NODE_ENV=production
APP_URL=https://app.gymflow.app
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Database
DATABASE_URL=postgresql://...   # Neon connection string
DB_POOL_MAX=10

# Redis
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Payments
PAYMENT_PROVIDER=tranzak          # tranzak | (v2: mobile_money)
TRANZAK_APP_ID=
TRANZAK_APP_SECRET=
TRANZAK_WEBHOOK_SECRET=
TRANZAK_ENV=sandbox               # sandbox | live

# Email
RESEND_API_KEY=
EMAIL_FROM=noreply@gymflow.app

# SMS
TERMII_API_KEY=
TERMII_SENDER_ID=GymFlow

# Push
EXPO_ACCESS_TOKEN=

# Storage
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=gymflow-media
R2_PUBLIC_URL=https://media.gymflow.app

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
```

---

## 13. Key Business Rules

1. A member may only have **one active subscription** at a time.
2. A suspended member **cannot check in** — enforced at the API and kiosk level, not just UI.
3. Grace period duration is **configurable per tenant** (default 3 days, range 1–7).
4. Subscription state transitions are **append-only** — every change is logged with timestamp and actor.
5. Payment must be **verified with the provider** before activating a subscription (no trust on frontend).
6. QR codes are **signed JWTs** containing member_id + tenant_id + expiry — kiosk can verify offline.
7. Trainers can **only see their assigned members** and their own classes.
8. All financial reports are in the **tenant's configured currency**.
9. Bulk reminder sends are **rate-limited** (max 1 bulk send per 24 hours per tenant) to prevent spam.
10. Cancelled subscriptions are **never deleted** — soft-delete with full audit trail.

---

*GymFlow — built to keep gyms running, members moving, and owners paid.*

---

## 14. Gap-Fill Additions

### 14.1 GymFlow Super Admin Portal

A separate web app (or gated route at `admin.gymflow.app`) for the GymFlow platform team only. Not accessible to any gym tenant.

**Capabilities:**
- View all tenants: name, plan, member count, MRR, status, created date
- Approve or reject new gym signups (if manual approval is on)
- Suspend or reactivate a tenant (cuts all access immediately)
- Force-delete a tenant schema (with confirmation + 30-day soft delete)
- View platform-wide revenue dashboard (all tenant subscriptions to GymFlow)
- Manually upgrade/downgrade tenant plan
- Impersonate a tenant admin for support (audit-logged)
- View platform error logs and job queue health
- Send platform-wide announcements to all gym owners

**Auth:** Separate staff table in public schema with `role = 'superadmin'`. MFA required. All actions written to a global `superadmin_audit_logs` table.

**New DB (public schema):**
```sql
CREATE TABLE superadmin_staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  mfa_secret    TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE superadmin_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES superadmin_staff(id),
  action      TEXT NOT NULL,
  tenant_id   UUID REFERENCES tenants(id),
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

### 14.2 Gym Owner Onboarding Flow

The public-facing signup journey for a new gym joining GymFlow.

**Step-by-step flow:**
```
1. Gym owner visits gymflow.app/signup
2. Fills in: gym name, owner name, email, phone, country
3. Chooses slug (subdomain): e.g. "crossfit-lagos"
   → real-time availability check
4. Selects plan (or starts free trial)
5. Verifies email (6-digit OTP via Resend)
6. Sets password
7. System provisions:
   → creates tenant record in public schema
   → creates PostgreSQL schema: tenant_crossfit_lagos
   → runs all per-tenant migration files
   → creates first staff record (role: owner)
   → creates Cloudflare DNS record for subdomain
   → sends welcome email with dashboard link + setup checklist
8. Owner lands on dashboard with onboarding checklist:
   [ ] Upload gym logo
   [ ] Set primary color
   [ ] Create your first membership plan
   [ ] Add your first trainer
   [ ] Configure payment provider (Tranzak App ID + App Secret)
   [ ] Generate your gym onboarding QR for members
   [ ] Add your first member
```

**Schema provisioning function:**
```sql
-- Called server-side after tenant record created
CREATE OR REPLACE FUNCTION provision_tenant_schema(slug TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS tenant_%I', slug);
  -- Then run all per-tenant migration files via node-pg-migrate
  -- scoped to the new schema
END;
$$ LANGUAGE plpgsql;
```

**Onboarding checklist stored in:**
```sql
ALTER TABLE tenants ADD COLUMN onboarding_completed_steps TEXT[] DEFAULT '{}';
-- e.g. ['logo', 'color', 'plan', 'trainer', 'payment']
ALTER TABLE tenants ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
```

---

### 14.3 Trial Period Logic

**Trial rules:**
- All new gym signups start on a 14-day free trial (Starter features)
- Trial begins from email verification date
- No payment method required to start trial
- At day 7: email + dashboard banner "7 days left on your trial"
- At day 12: email + SMS "2 days left — upgrade to keep access"
- At day 14: tenant status → `trial_expired`, dashboard locked
- Owner can still log in but all member-facing features are paused
- Owner sees upgrade prompt only — no other admin actions available
- If owner upgrades, all data preserved, features resume immediately

**Tenant status values (extended):**
```
active | trial | trial_expired | suspended | cancelled
```

**DB additions:**
```sql
ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN trial_reminder_7d_sent BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN trial_reminder_2d_sent BOOLEAN DEFAULT false;
```

**API guard middleware:**
```typescript
// Every admin API request checks:
if (tenant.status === 'trial_expired') {
  return res.status(402).json({
    error: 'trial_expired',
    message: 'Your trial has ended. Upgrade to continue.',
    upgrade_url: `https://gymflow.app/billing/${tenant.slug}`
  })
}
```

---

### 14.4 Member Self-Registration Flow

When gym enables self-registration (Settings → toggle on):

```
Member visits: crossfitlagos.gymflow.app/join
  OR scans gym onboarding QR code
  OR taps link in gym's WhatsApp group

1. Registration form:
   - First name, last name
   - Email, phone
   - Date of birth (optional)
   - Emergency contact (optional)
   - Agrees to gym waiver/terms (if configured)

2. Email verification: 6-digit OTP sent via Resend

3. Password setup

4. Plan selection:
   - Lists all active membership_plans for this gym
   - Member selects plan → payment page

5. Payment (Tranzak):
   - Member pays
   - On success: subscription activated, QR code generated,
     PDF member card emailed, WhatsApp card sent

6. Member downloads GymFlow app:
   - Prompted after registration
   - Their gym code is pre-filled via deep link

7. If approval required (gym setting):
   - Member sees "Registration pending approval"
   - Owner gets in-app + email alert: "New member request: Amaka Obi"
   - Owner approves/rejects from admin dashboard
   - Member notified via email on decision
```

**Public API routes (no auth, tenant-scoped):**
```
POST   /api/public/register          submit registration
POST   /api/public/verify-email      verify OTP
POST   /api/public/set-password      set password after verification
GET    /api/public/plans             list active plans (public)
GET    /api/public/tenant-info       gym name, logo, colors (for branded page)
```

---

### 14.5 Password Reset Flow

**Staff (admin/trainer/receptionist):**
```
1. POST /api/auth/forgot-password  { email }
   → generates reset_token (32-byte random hex), stored hashed in staff table
   → token expires in 1 hour
   → sends email with link: {subdomain}.gymflow.app/reset-password?token=xxx

2. User clicks link → enters new password
   POST /api/auth/reset-password  { token, new_password }
   → validates token (hash match + not expired)
   → bcrypt hashes new password, clears token
   → invalidates all existing refresh tokens for that staff member
   → sends confirmation email
```

**Member (mobile app):**
```
1. "Forgot password?" on login screen
   POST /api/member/forgot-password  { email, tenant_id }
   → same token flow as above
   → email link opens deep link: gymflow://reset-password?token=xxx

2. App handles deep link → password reset screen
   POST /api/member/reset-password  { token, new_password }
```

**DB additions:**
```sql
ALTER TABLE staff ADD COLUMN password_reset_token_hash TEXT;
ALTER TABLE staff ADD COLUMN password_reset_expires_at TIMESTAMPTZ;

ALTER TABLE members ADD COLUMN password_hash TEXT;
ALTER TABLE members ADD COLUMN password_reset_token_hash TEXT;
ALTER TABLE members ADD COLUMN password_reset_expires_at TIMESTAMPTZ;
```

---

### 14.6 Webhook Security

**Tranzak webhook verification:**
```typescript
import crypto from 'crypto'

function verifyTranzakWebhook(
  payload: string,   // raw request body string
  signature: string, // from X-Tranzak-Signature header
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  )
}
```

**Idempotency — preventing duplicate processing:**
```typescript
// Before processing any webhook event:
const eventKey = `webhook:processed:${event.id}`
const alreadyProcessed = await redis.get(eventKey)
if (alreadyProcessed) return res.status(200).json({ ok: true }) // already done

await redis.set(eventKey, '1', { ex: 86400 * 7 }) // remember for 7 days
// ...process event
```

**Webhook event types handled:**
```
tranzak:
  payment.complete   → verify amount, activate subscription
  payment.failed     → mark payment failed, notify member + owner
  refund.complete    → update payment record, notify member

  (v2 — mobile money):
  collection.success → same activation flow as payment.complete
  collection.failed  → same failure flow
```

**Webhook endpoint hardening:**
- Raw body must be read BEFORE any JSON parsing (`express.raw({ type: 'application/json' })`)
- Reject any request without the signature header with 401
- Log all webhook events to a `webhook_events` table before processing
- Always return 200 immediately — processing happens async in BullMQ queue

```sql
CREATE TABLE webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  status       TEXT DEFAULT 'pending',  -- pending | processed | failed
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, event_id)
);
```

---

### 14.7 Member ID Format

Member IDs follow a tenant-scoped sequential format for human readability:

**Format:** `{TENANT_PREFIX}-{6-digit-zero-padded-sequence}`
- CrossFit Lagos → `CFL-000001`, `CFL-000002`, ...
- FitZone Abuja  → `FZA-000001`, `FZA-000002`, ...

**Tenant prefix:** First 3 uppercase letters of gym slug, or configurable by owner (max 4 chars).

**Implementation:**
```sql
-- Per-tenant sequence (in each tenant schema)
CREATE SEQUENCE member_id_seq START 1;

ALTER TABLE members ADD COLUMN member_no TEXT UNIQUE;

-- Generated on INSERT:
-- member_no = tenant_prefix || '-' || LPAD(nextval('member_id_seq')::TEXT, 6, '0')
```

**Where used:** PDF card, kiosk display, admin member search, WhatsApp card, receipts, audit logs.

---

### 14.8 Operating Hours Enforcement

**Gym operating hours stored per tenant:**
```sql
CREATE TABLE operating_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL,  -- 0=Sunday, 1=Monday ... 6=Saturday
  opens_at    TIME NOT NULL,
  closes_at   TIME NOT NULL,
  is_closed   BOOLEAN DEFAULT false,  -- closed all day (public holiday, etc.)
  UNIQUE(day_of_week)
);

CREATE TABLE operating_hour_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,
  opens_at    TIME,
  closes_at   TIME,
  is_closed   BOOLEAN DEFAULT false,
  reason      TEXT,  -- "Public holiday", "Annual maintenance"
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Check-in gate logic (extended):**
```typescript
// Before approving any check-in:
const now = DateTime.now().setZone(tenant.timezone)
const dayHours = await getOperatingHours(tenantId, now.weekday)
const exception = await getExceptionForDate(tenantId, now.toISODate())

const hours = exception ?? dayHours

if (hours.is_closed) {
  return { allowed: false, reason: 'gym_closed', message: 'The gym is closed today.' }
}
if (now.toFormat('HH:mm') < hours.opens_at || now.toFormat('HH:mm') > hours.closes_at) {
  return {
    allowed: false,
    reason: 'outside_hours',
    message: `Gym opens at ${hours.opens_at}. Come back later!`
  }
}
```

**Kiosk display:** Shows operating hours on the home screen and displays "GYM CLOSED" banner with today's reason when applicable.

---

### 14.9 Equipment & Space Booking

For gyms with limited high-demand equipment (squat racks, boxing ring, pool lanes, battle ropes station, etc.).

**How it works:**
- Admin defines resources (name, quantity, booking duration options)
- Members book a resource slot from the app (like booking a class, but self-serve)
- Max 1 active equipment booking per member at a time (configurable)
- No trainer required
- Slot shows on the TV display occupancy view

```sql
CREATE TABLE gym_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,        -- "Squat Rack A", "Boxing Ring"
  description     TEXT,
  quantity        INT NOT NULL DEFAULT 1,
  max_duration_min INT NOT NULL DEFAULT 60,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE resource_bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id  UUID REFERENCES gym_resources(id),
  member_id    UUID REFERENCES members(id),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       TEXT DEFAULT 'confirmed',  -- confirmed | cancelled | completed
  booked_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource_id, starts_at)
);
```

**API routes:**
```
GET    /api/resources                list active resources
GET    /api/resources/:id/slots      available slots for date
POST   /api/resources/:id/book       book a slot
DELETE /api/resources/:id/book/:bid  cancel booking
```

---

### 14.10 Deep Link Routing (Mobile App)

Every push notification `data` payload maps to a specific screen with typed params. The app's deep link handler resolves these on notification tap.

**URL scheme:** `gymflow://`
**Universal links:** `https://crossfitlagos.gymflow.app/app/...` (for web fallback)

**Screen → Deep link map:**
```typescript
const DEEP_LINKS: Record<string, { screen: string; params?: string[] }> = {
  'gymflow://home':                         { screen: 'Home' },
  'gymflow://subscription':                 { screen: 'Subscription' },
  'gymflow://subscription/renew':           { screen: 'Subscription', params: ['action=renew'] },
  'gymflow://bookings':                     { screen: 'Bookings' },
  'gymflow://bookings/:class_id/confirm':   { screen: 'BookingDetail', params: ['class_id'] },
  'gymflow://schedule/:class_id':           { screen: 'ClassDetail', params: ['class_id'] },
  'gymflow://workouts':                     { screen: 'Workouts' },
  'gymflow://notifications':                { screen: 'Notifications' },
  'gymflow://profile':                      { screen: 'Profile' },
  'gymflow://checkin':                      { screen: 'CheckIn' },
  'gymflow://reset-password':               { screen: 'ResetPassword', params: ['token'] },
  'gymflow://join':                         { screen: 'Onboarding', params: ['gym', 'invite'] },
}
```

**Notification data payloads updated:**
```typescript
// All notification data.url fields now use deep links:
class_reminder:     { url: 'gymflow://bookings/{{class_id}}/confirm' }
subscription_expiry:{ url: 'gymflow://subscription/renew' }
waitlist_promoted:  { url: 'gymflow://bookings/{{class_id}}/confirm' }
payment_success:    { url: 'gymflow://subscription' }
milestone_pr:       { url: 'gymflow://workouts' }
announcement:       { url: 'gymflow://notifications' }
```

**Expo linking setup:**
```typescript
// app.json
{
  "expo": {
    "scheme": "gymflow",
    "intentFilters": [{
      "action": "VIEW",
      "data": [{ "scheme": "https", "host": "*.gymflow.app", "pathPrefix": "/app" }],
      "category": ["BROWSABLE", "DEFAULT"]
    }]
  }
}
```

---

### 14.11 Receipt Format

Every successful payment generates a receipt. Stored as PDF in R2, delivered via email and downloadable from admin and member app.

**Receipt contents:**
```
┌─────────────────────────────────┐
│  [GYM LOGO]    CrossFit Lagos   │
│  crossfitlagos.gymflow.app      │
├─────────────────────────────────┤
│  PAYMENT RECEIPT                │
│  Receipt No: RCT-2026-004521    │
│                                 │
│  Member:     Amaka Obi          │
│  Member ID:  CFL-000042         │
│  Date:       13 Jun 2026        │
│  Time:       09:14 AM WAT       │
├─────────────────────────────────┤
│  Description      Monthly Pro   │
│  Period     Jun 13 – Jul 13 26  │
│  Payment method   Tranzak       │
│  Reference        TRZ-9283XXXX  │
├─────────────────────────────────┤
│  TOTAL:    18,000.00 XAF        │
│  Status:          PAID          │
└─────────────────────────────────┘
│  Powered by GymFlow             │
```

**Receipt numbering:** `RCT-{YEAR}-{6-digit-sequence}` — tenant-scoped sequential.

**DB addition:**
```sql
ALTER TABLE payments ADD COLUMN receipt_number TEXT UNIQUE;
CREATE SEQUENCE receipt_number_seq START 1;
```

**Generation:** `@react-pdf/renderer` (same library as membership card). Generated async after payment verified, URL stored in `payments.receipt_url`.

---

### 14.12 Data Privacy & NDPR Compliance

Nigerian Data Protection Regulation (NDPR) and general data privacy requirements.

**Member rights supported:**
- **Right to access:** Member can download all their personal data from the app (Profile → "Download my data"). Returns ZIP of: profile JSON, payment history CSV, workout logs CSV, check-in history CSV.
- **Right to erasure:** Member can request account deletion. Admin confirms. System soft-deletes member record, anonymises PII in logs (`name → "[Deleted]"`, `email → "deleted@removed.com"`), purges push tokens. Payments retained 7 years (legal requirement).
- **Right to correction:** Member can update their own profile (name, phone, DOB) from the app.

**Consent:**
- Gym waiver / terms shown and agreed to at signup (checkbox, timestamp stored)
- Member consents to notification preferences (granular opt-out per channel)
- Progress photo upload is explicitly opt-in with consent banner

**Data retention policy:**
```
Member PII:          Retained while member is active + 2 years after deletion
Payment records:     7 years (tax/legal requirement)
Audit logs:          2 years
Check-in logs:       1 year rolling
Push tokens:         Deleted immediately on logout / deregistration
Notification logs:   90 days
Webhook events:      30 days
```

**DB additions:**
```sql
ALTER TABLE members ADD COLUMN terms_accepted_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN terms_version TEXT;
ALTER TABLE members ADD COLUMN data_deletion_requested_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN data_deleted_at TIMESTAMPTZ;

CREATE TABLE data_export_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID REFERENCES members(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  expires_at   TIMESTAMPTZ
);
```

**API routes:**
```
GET    /api/member/me/export-data    request data export (async, email when ready)
DELETE /api/member/me/account        request account deletion
GET    /api/member/me/consents       view current consent settings
PATCH  /api/member/me/consents       update consent settings
```

---

### 14.13 Rate Limiting Strategy

Using Upstash Redis for all rate limiting (sliding window algorithm).

**Rate limits by endpoint type:**

| Endpoint category | Limit | Window | Key |
|---|---|---|---|
| Auth (login/register) | 10 requests | 15 min | IP |
| Password reset | 3 requests | 1 hour | IP + email |
| OTP verification | 5 attempts | 15 min | IP + email |
| Check-in (kiosk) | 60 requests | 1 min | tenant_id |
| Push notification bulk send | 1 request | 24 hours | tenant_id |
| Payment initialize | 20 requests | 1 hour | member_id |
| API general | 300 requests | 1 min | staff_id or member_id |
| Webhook endpoints | 1000 requests | 1 min | IP (provider IP) |
| Public registration page | 30 requests | 1 hour | IP |

**Implementation (middleware):**
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(300, '1m'),
})

export async function rateLimitMiddleware(req, res, next) {
  const identifier = req.user?.id ?? req.ip
  const { success, remaining, reset } = await ratelimit.limit(identifier)

  res.setHeader('X-RateLimit-Remaining', remaining)
  res.setHeader('X-RateLimit-Reset', reset)

  if (!success) {
    return res.status(429).json({ error: 'Too many requests. Slow down.' })
  }
  next()
}
```

---

### 14.14 Tenant Schema Migration Strategy

When GymFlow releases a new feature that adds tables or columns, all existing tenant schemas must be migrated automatically.

**Strategy: versioned migration files + per-tenant runner**

```
/migrations/
  global/
    001_create_tenants.sql
    002_create_tenant_subscriptions.sql
  tenant/
    001_create_members.sql
    002_create_subscriptions.sql
    003_create_payments.sql
    ...
    042_add_resource_bookings.sql     ← new feature migration
```

**Migration runner (runs on every deploy):**
```typescript
// scripts/migrate.ts
import { Pool } from 'pg'

async function migrateAllTenants() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  // 1. Run global migrations
  await runMigrations(pool, 'public', './migrations/global')

  // 2. Get all tenant slugs
  const { rows: tenants } = await pool.query(
    `SELECT slug FROM public.tenants WHERE status != 'cancelled'`
  )

  // 3. Run tenant migrations for each schema
  for (const tenant of tenants) {
    const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`
    console.log(`Migrating schema: ${schema}`)
    await pool.query(`SET search_path = ${schema}`)
    await runMigrations(pool, schema, './migrations/tenant')
  }

  console.log(`Migrated ${tenants.length} tenant schemas`)
  pool.end()
}

async function runMigrations(pool, schema, dir) {
  // Check migration_history table, run only new files in order
  // Uses node-pg-migrate or custom file-based runner
}
```

**Migration history per schema:**
```sql
-- Created in every tenant schema and in public
CREATE TABLE IF NOT EXISTS migration_history (
  id          SERIAL PRIMARY KEY,
  filename    TEXT UNIQUE NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT now()
);
```

**Deploy pipeline:**
```
git push → CI runs tests → build passes
→ Railway deploy hook: node scripts/migrate.ts
→ New app version starts (zero downtime via Railway rolling deploy)
```

**New tenant provisioning:**
```typescript
// When a new gym signs up, run all tenant migrations from scratch:
await pool.query(`CREATE SCHEMA tenant_${slug}`)
await pool.query(`SET search_path = tenant_${slug}`)
await runMigrations(pool, `tenant_${slug}`, './migrations/tenant')
// All 042 migration files applied in order to the fresh schema
```

---

### 14.15 Mobile App Offline Mode

What works without internet in the React Native + Expo member app.

**Offline-capable (cached locally):**
- Member's own profile (name, photo, member ID)
- QR code / check-in code (valid for 24 hours, signed JWT in AsyncStorage)
- Today's class schedule (cached on last sync, up to 24 hours old)
- Last 10 notifications (cached)
- Workout log (can be written offline, synced when online)
- Body metrics (can be written offline, synced when online)

**Requires internet (graceful offline message shown):**
- Booking a class (requires real-time capacity check)
- Making a payment / renewing subscription
- Viewing other members' data
- Live check-in feed
- Announcement sync

**Implementation:**
```typescript
// Expo offline strategy using React Query + AsyncStorage persistence
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'GYMFLOW_QUERY_CACHE',
})

// Cache config per query:
useQuery({
  queryKey: ['schedule', today],
  queryFn: fetchSchedule,
  staleTime: 1000 * 60 * 30,    // 30 min before refetch
  gcTime:    1000 * 60 * 60 * 24 // keep in cache 24 hours
})
```

**Offline workout logging:**
```typescript
// Written to local SQLite (expo-sqlite), synced on reconnect
import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabaseSync('gymflow_offline.db')

// On reconnect:
NetInfo.addEventListener(state => {
  if (state.isConnected) syncOfflineWorkouts()
})
```

**Network status banner:**
The app shows a subtle amber banner at the top when offline: "No internet — showing cached data". Disappears when connection restores.

---

## 15. Updated Business Rules (additions to section 13)

11. Gym owner's GymFlow subscription (`trial` / `active` / `trial_expired`) is checked **before** resolving any tenant API request — expired trial → 402 response.
12. Webhook events are **always accepted with 200** and processed async — never block the provider.
13. Webhook events are **idempotent** — processing the same event twice must have no additional effect.
14. Member PII is **never logged** in plaintext in audit logs or application logs — only IDs and action types.
15. All database migrations are **backwards-compatible** — no column drops or renames in a single deploy; use two-phase deprecation.
16. Equipment bookings enforce **no double-booking** at the database level via a UNIQUE constraint on `(resource_id, starts_at)`, not just application logic.
17. Password reset tokens are **stored hashed** (SHA-256), never in plaintext.
18. Rate limit state is stored in **Redis only** — never hits the database.
19. The super admin portal is **IP-allowlisted** (Cloudflare WAF rule) — only accessible from GymFlow team IPs.
20. All file uploads (avatars, logos, progress photos) are **virus-scanned** before being written to R2 (via Cloudflare's built-in malware scanning or a dedicated scanner).

---

## 16. Complete Table Inventory

For reference — every table in the system:

**Global schema (public):**
tenants, tenant_subscriptions, superadmin_staff, superadmin_audit_logs, webhook_events

**Per-tenant schema (replicated per gym):**
members, membership_plans, subscriptions, payments, trainers, class_types, classes, bookings, check_ins, workout_logs, workout_exercises, personal_records, programs, program_sessions, notifications, announcements, body_metrics, day_passes, staff, audit_logs, push_tokens, class_ratings, referrals, display_screens, wods, wod_entries, operating_hours, operating_hour_exceptions, gym_resources, resource_bookings, data_export_requests, migration_history

**Total: 5 global + 33 per-tenant = 38 tables**

