import {
  pgTable, text, integer, boolean, timestamp, pgEnum,
} from 'drizzle-orm/pg-core'

// ── Owners (global accounts — pre and post onboarding) ───────────────────────

export const owners = pgTable('owners', {
  id:                     text('id').primaryKey(),
  name:                   text('name').notNull(),
  email:                  text('email').notNull().unique(),
  phone:                  text('phone').notNull(),
  country:                text('country').notNull(),
  password_hash:          text('password_hash').notNull(),
  pin_hash:               text('pin_hash').notNull(),
  email_verified:         boolean('email_verified').notNull().default(false),
  email_otp:              text('email_otp'),              // bcrypt hash of 6-digit code
  email_otp_expires_at:   timestamp('email_otp_expires_at', { withTimezone: true }),
  referral_code_used:     text('referral_code_used'),
  marketing_opt_in:       boolean('marketing_opt_in').notNull().default(false),
  onboarding_complete:    boolean('onboarding_complete').notNull().default(false),
  tenant_id:              text('tenant_id'),              // set after onboarding
  created_at:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Owner = typeof owners.$inferSelect
export type NewOwner = typeof owners.$inferInsert

export const tenantStatusEnum = pgEnum('tenant_status', [
  'trialing', 'active', 'past_due', 'suspended', 'cancelled',
])

export const tenantPlanEnum = pgEnum('tenant_plan', [
  'starter', 'growth', 'growth_plus', 'enterprise',
])

export const tenants = pgTable('tenants', {
  id:                    text('id').primaryKey(),
  name:                  text('name').notNull(),
  slug:                  text('slug').notNull().unique(),
  subdomain:             text('subdomain').notNull().unique(),
  custom_domain:         text('custom_domain'),
  owner_email:           text('owner_email').notNull(),
  owner_name:            text('owner_name').notNull(),
  account_number:        text('account_number').unique(),
  plan:                  tenantPlanEnum('plan').notNull().default('starter'),
  status:                tenantStatusEnum('status').notNull().default('trialing'),
  currency:              text('currency').notNull().default('XAF'),
  primary_color:         text('primary_color'),
  logo_url:              text('logo_url'),
  timezone:              text('timezone').notNull().default('Africa/Douala'),
  trial_ends_at:            timestamp('trial_ends_at', { withTimezone: true }),
  grace_period_days:        integer('grace_period_days').notNull().default(7),
  subscription_renewal_at:  timestamp('subscription_renewal_at', { withTimezone: true }),
  tranzak_app_id:        text('tranzak_app_id'),
  tranzak_app_secret:    text('tranzak_app_secret'),
  created_at:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const webhookEventStatusEnum = pgEnum('webhook_event_status', [
  'pending', 'processed', 'failed',
])

export const webhookEvents = pgTable('webhook_events', {
  id:           text('id').primaryKey(),
  provider:     text('provider').notNull().default('tranzak'),
  event_type:   text('event_type').notNull(),
  payload:      text('payload').notNull(),
  status:       webhookEventStatusEnum('status').notNull().default('pending'),
  tenant_id:    text('tenant_id').references(() => tenants.id),
  processed_at: timestamp('processed_at', { withTimezone: true }),
  created_at:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const superadmins = pgTable('superadmins', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  is_active:     boolean('is_active').notNull().default(true),
  last_login_at: timestamp('last_login_at', { withTimezone: true }),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const memberOtps = pgTable('member_otps', {
  id:           text('id').primaryKey(),
  tenant_slug:  text('tenant_slug').notNull(),
  tenant_id:    text('tenant_id').notNull(),
  identifier:   text('identifier').notNull(), // phone or email (lowercased)
  otp_hash:     text('otp_hash').notNull(),
  member_id:    text('member_id').notNull(),
  member_email: text('member_email'),
  member_name:  text('member_name').notNull(),
  expires_at:   timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const passwordResets = pgTable('password_resets', {
  id:         text('id').primaryKey(),
  owner_id:   text('owner_id').notNull().references(() => owners.id),
  token:      text('token').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used_at:    timestamp('used_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Platform invoices (myfiti → gym subscription billing) ───────────────────

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'pending', 'paid', 'overdue', 'cancelled',
])

export const platformInvoices = pgTable('platform_invoices', {
  id:             text('id').primaryKey(),
  tenant_id:      text('tenant_id').notNull().references(() => tenants.id),
  invoice_number: text('invoice_number').notNull().unique(),
  amount_xaf:     integer('amount_xaf').notNull().default(0),
  status:         invoiceStatusEnum('status').notNull().default('pending'),
  plan:           text('plan').notNull(),
  period_start:   timestamp('period_start', { withTimezone: true }).notNull(),
  period_end:     timestamp('period_end', { withTimezone: true }).notNull(),
  due_date:       timestamp('due_date', { withTimezone: true }).notNull(),
  paid_at:        timestamp('paid_at', { withTimezone: true }),
  pdf_url:        text('pdf_url'),
  created_at:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PlatformInvoice = typeof platformInvoices.$inferSelect
export type NewPlatformInvoice = typeof platformInvoices.$inferInsert

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type Superadmin = typeof superadmins.$inferSelect
export type MemberOtp = typeof memberOtps.$inferSelect
export type PasswordReset = typeof passwordResets.$inferSelect
