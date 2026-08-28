/**
 * Tenant schema tables — these live inside each tenant's own PostgreSQL schema
 * (e.g. tenant_crossfit_lagos). The Drizzle table definitions have no schema
 * prefix; the search_path is set per-request via withTenant().
 */
import {
  pgTable, text, integer, boolean, timestamp, pgEnum, decimal, jsonb,
} from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const memberStatusEnum = pgEnum('member_status', [
  'active', 'expiring_soon', 'grace_period', 'suspended', 'cancelled',
])

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active', 'expiring_soon', 'grace_period', 'suspended', 'cancelled',
])

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'completed', 'failed', 'refunded',
])

export const paymentProviderEnum = pgEnum('payment_provider', [
  'tranzak', 'cash', 'transfer',
])

export const notificationTypeEnum = pgEnum('notification_type', [
  'subscription_expiring', 'subscription_expired', 'payment_received',
  'payment_failed', 'class_reminder', 'announcement', 'referral_reward',
])

export const paymentTypeEnum = pgEnum('payment_type', [
  'subscription', 'day_pass', 'class_fee', 'penalty',
])

export const staffRoleEnum = pgEnum('staff_role', [
  'owner', 'admin', 'trainer', 'receptionist',
])

export const classStatusEnum = pgEnum('class_status', [
  'scheduled', 'cancelled', 'completed',
])

export const bookingStatusEnum = pgEnum('booking_status', [
  'confirmed', 'waitlisted', 'cancelled', 'no_show', 'attended',
])

export const dayPassTypeEnum = pgEnum('day_pass_type', [
  'standard', 'peak', 'off_peak', 'student', 'bundle_10',
])

export const dayPassStatusEnum = pgEnum('day_pass_status', [
  'active', 'used', 'expired', 'refunded',
])

// ── Tables ───────────────────────────────────────────────────────────────────

export const staff = pgTable('staff', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  phone:         text('phone'),
  password_hash: text('password_hash').notNull(),
  pin_hash:      text('pin_hash'),
  role:          staffRoleEnum('role').notNull().default('receptionist'),
  avatar_url:    text('avatar_url'),
  is_active:     boolean('is_active').notNull().default(true),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const members = pgTable('members', {
  id:              text('id').primaryKey(),
  name:            text('name').notNull(),
  email:           text('email').notNull().unique(),
  phone:           text('phone'),
  avatar_url:      text('avatar_url'),
  status:          memberStatusEnum('status').notNull().default('active'),
  qr_code:         text('qr_code').unique(),
  referral_code:   text('referral_code').unique(),
  referred_by_id:  text('referred_by_id'),
  notes:           text('notes'),
  joined_at:       timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  created_at:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const membershipPlans = pgTable('membership_plans', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  description:   text('description'),
  price:         decimal('price', { precision: 12, scale: 2 }).notNull(),
  currency:      text('currency').notNull().default('XAF'),
  duration_days: integer('duration_days').notNull(),
  cycle:         text('cycle').notNull().default('monthly'),
  is_active:     boolean('is_active').notNull().default(true),
  features:      text('features'),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const subscriptions = pgTable('subscriptions', {
  id:               text('id').primaryKey(),
  member_id:        text('member_id').notNull().references(() => members.id),
  plan_id:          text('plan_id').notNull().references(() => membershipPlans.id),
  status:           subscriptionStatusEnum('status').notNull().default('active'),
  started_at:       timestamp('started_at', { withTimezone: true }).notNull(),
  expires_at:       timestamp('expires_at', { withTimezone: true }).notNull(),
  grace_expires_at: timestamp('grace_expires_at', { withTimezone: true }),
  cancelled_at:     timestamp('cancelled_at', { withTimezone: true }),
  auto_renew:       boolean('auto_renew').notNull().default(true),
  created_at:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const payments = pgTable('payments', {
  id:             text('id').primaryKey(),
  member_id:      text('member_id').notNull().references(() => members.id),
  subscription_id:text('subscription_id').references(() => subscriptions.id),
  amount:         decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency:       text('currency').notNull().default('XAF'),
  provider:       paymentProviderEnum('provider').notNull().default('tranzak'),
  tranzak_ref:    text('tranzak_ref'),
  payment_type:   paymentTypeEnum('payment_type').notNull().default('subscription'),
  status:         paymentStatusEnum('status').notNull().default('pending'),
  paid_at:        timestamp('paid_at', { withTimezone: true }),
  notes:          text('notes'),
  created_at:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const checkIns = pgTable('check_ins', {
  id:           text('id').primaryKey(),
  member_id:    text('member_id').notNull().references(() => members.id),
  method:       text('method').notNull().default('qr'),
  staff_id:     text('staff_id').references(() => staff.id),
  checked_in_at:timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable('notifications', {
  id:          text('id').primaryKey(),
  member_id:   text('member_id').references(() => members.id),
  type:        notificationTypeEnum('type').notNull(),
  channel:     text('channel').notNull().default('in_app'),
  title:       text('title').notNull(),
  body:        text('body').notNull(),
  sent_at:     timestamp('sent_at', { withTimezone: true }),
  read_at:     timestamp('read_at', { withTimezone: true }),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const referrals = pgTable('referrals', {
  id:                text('id').primaryKey(),
  referrer_id:       text('referrer_id').notNull().references(() => members.id),
  referred_id:       text('referred_id').references(() => members.id),
  status:            text('status').notNull().default('pending'),
  converted_at:      timestamp('converted_at', { withTimezone: true }),
  reward_days:       integer('reward_days'),
  reward_amount:     decimal('reward_amount', { precision: 12, scale: 2 }),
  reward_applied_at: timestamp('reward_applied_at', { withTimezone: true }),
  created_at:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const classes = pgTable('classes', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  description:   text('description'),
  trainer_id:    text('trainer_id').references(() => staff.id),
  capacity:      integer('capacity').notNull().default(20),
  duration_mins: integer('duration_mins').notNull().default(60),
  starts_at:     timestamp('starts_at', { withTimezone: true }).notNull(),
  ends_at:       timestamp('ends_at', { withTimezone: true }).notNull(),
  recurrence:    text('recurrence'),
  status:        classStatusEnum('status').notNull().default('scheduled'),
  location:      text('location'),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const classBookings = pgTable('class_bookings', {
  id:         text('id').primaryKey(),
  class_id:   text('class_id').notNull().references(() => classes.id),
  member_id:  text('member_id').notNull().references(() => members.id),
  status:     bookingStatusEnum('status').notNull().default('confirmed'),
  booked_at:  timestamp('booked_at', { withTimezone: true }).notNull().defaultNow(),
  cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
})

export const dayPasses = pgTable('day_passes', {
  id:           text('id').primaryKey(),
  guest_name:   text('guest_name').notNull(),
  guest_phone:  text('guest_phone'),
  pass_type:    dayPassTypeEnum('pass_type').notNull().default('standard'),
  amount:       decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency:     text('currency').notNull().default('XAF'),
  payment_method: text('payment_method').notNull().default('cash'),
  payment_ref:  text('payment_ref'),
  qr_token:     text('qr_token').notNull().unique(),
  status:       dayPassStatusEnum('status').notNull().default('active'),
  valid_date:   text('valid_date').notNull(),
  checked_in_at: timestamp('checked_in_at', { withTimezone: true }),
  staff_id:     text('staff_id').references(() => staff.id),
  converted_to_member_id: text('converted_to_member_id').references(() => members.id),
  notes:        text('notes'),
  metadata:     jsonb('metadata'),
  created_at:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const gymSettings = pgTable('gym_settings', {
  id:              text('id').primaryKey().default('singleton'),
  gym_name:        text('gym_name').notNull(),
  slug:            text('slug').notNull(),
  country:         text('country').notNull().default('CM'),
  timezone:        text('timezone').notNull().default('Africa/Douala'),
  currency:        text('currency').notNull().default('XAF'),
  logo_url:        text('logo_url'),
  primary_color:   text('primary_color').default('#6366f1'),
  grace_period_days: integer('grace_period_days').notNull().default(7),
  trial_days:      integer('trial_days').notNull().default(14),
  features:        jsonb('features').default({}),
  created_at:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Inferred types ───────────────────────────────────────────────────────────

export type Member = typeof members.$inferSelect
export type NewMember = typeof members.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Staff = typeof staff.$inferSelect
export type Class = typeof classes.$inferSelect
export type ClassBooking = typeof classBookings.$inferSelect
export type DayPass = typeof dayPasses.$inferSelect
export type GymSettings = typeof gymSettings.$inferSelect
