// ─── Tenant ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string
  slug: string
  name: string
  custom_domain: string | null
  logo_url: string | null
  primary_color: string
  owner_email: string
  plan: 'starter' | 'growth' | 'pro' | 'enterprise'
  status: 'trial' | 'active' | 'trial_expired' | 'suspended' | 'cancelled'
  currency: string        // XAF | NGN | USD | XOF — tenant-configured
  grace_period_days: number
  timezone: string
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface TenantBranding {
  id: string
  slug: string
  name: string
  logo_url: string
  primary_color: string
  secondary_color: string
  splash_bg_color: string
  font: 'default' | 'inter' | 'roboto'
  timezone: string
  currency: string        // tenant-configured: "XAF" | "NGN" | "USD" | "XOF"
  features: TenantFeatures
}

export interface TenantFeatures {
  // V1 features
  show_announcements: boolean
  allow_self_renewal: boolean
  referral_system: boolean
  guest_passes: boolean
  // V2 features
  show_leaderboard: boolean
  show_body_metrics: boolean
  show_trainer_ratings: boolean
  wod_leaderboard: boolean
}

// ─── Member ───────────────────────────────────────────────────────────────────

export interface Member {
  id: string
  member_no: string           // e.g. CFL-000001
  first_name: string
  last_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  date_of_birth: string | null
  gender: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  qr_code: string | null
  pin: string | null
  status: 'active' | 'suspended' | 'inactive'
  notification_prefs: NotificationPrefs
  terms_accepted_at: string | null
  joined_at: string
  created_at: string
  updated_at: string
}

export interface NotificationPrefs {
  push_enabled: boolean
  email_enabled: boolean
  sms_enabled: boolean
  class_reminders: boolean
  subscription_alerts: boolean
  milestones: boolean
  announcements: boolean
}

// ─── Membership Plan ──────────────────────────────────────────────────────────

export interface MembershipPlan {
  id: string
  name: string
  description: string | null
  duration_days: number
  price: number
  currency: string            // inherits from tenant
  max_classes_per_week: number | null
  allows_guest: boolean
  is_active: boolean
  created_at: string
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'active'
  | 'expiring_soon'
  | 'grace_period'
  | 'suspended'
  | 'paused'
  | 'cancelled'

export interface Subscription {
  id: string
  member_id: string
  plan_id: string
  status: SubscriptionStatus
  started_at: string
  expires_at: string
  grace_expires_at: string | null
  cancelled_at: string | null
  paused_at: string | null
  pause_resume_at: string | null
  auto_renew: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export type PaymentProvider = 'tranzak' | 'cash' | 'transfer'
// v2 will add: | 'mobile_money'

export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'refunded'

export type PaymentType = 'subscription' | 'day_pass' | 'class_fee' | 'penalty'

export interface Payment {
  id: string
  member_id: string
  subscription_id: string | null
  amount: number
  currency: string
  provider: PaymentProvider
  provider_ref: string | null
  status: PaymentStatus
  payment_type: PaymentType
  receipt_number: string | null
  receipt_url: string | null
  paid_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Payment Provider Abstraction ─────────────────────────────────────────────

export interface PaymentLink {
  payment_url: string
  reference: string
  provider: PaymentProvider
  request_id?: string
}

export interface PaymentVerification {
  reference: string
  status: PaymentStatus
  amount: number
  currency: string
  paid_at: string | null
  metadata: Record<string, unknown>
}

export interface PaymentProviderClient {
  initializeTransaction(data: {
    amount: number
    currency: string
    email: string
    reference: string
    callback_url: string
    metadata?: Record<string, unknown>
  }): Promise<PaymentLink>

  verifyTransaction(reference: string): Promise<PaymentVerification>
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export type StaffRole = 'owner' | 'admin' | 'receptionist' | 'trainer'

export interface Staff {
  id: string
  first_name: string
  last_name: string
  email: string
  role: StaffRole
  trainer_id: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

// ─── Trainer ──────────────────────────────────────────────────────────────────

export interface Trainer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  specialties: string[]
  bio: string | null
  status: 'active' | 'inactive'
  joined_at: string
  created_at: string
}

// ─── Classes & Bookings ───────────────────────────────────────────────────────

export interface ClassType {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  color: string | null
  icon: string | null
  is_active: boolean
  created_at: string
}

export type ClassStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

export interface GymClass {
  id: string
  class_type_id: string
  trainer_id: string
  room: string | null
  capacity: number
  waitlist_limit: number
  scheduled_at: string
  ends_at: string
  status: ClassStatus
  notes: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  created_at: string
}

export type BookingStatus =
  | 'confirmed'
  | 'waitlisted'
  | 'cancelled'
  | 'attended'
  | 'no_show'

export interface Booking {
  id: string
  class_id: string
  member_id: string
  status: BookingStatus
  waitlist_position: number | null
  waitlist_promoted_at: string | null
  waitlist_confirm_by: string | null
  booked_at: string
  cancelled_at: string | null
  attended_at: string | null
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

export type CheckInMethod = 'qr' | 'pin' | 'manual'
// v2 will add: | 'face'

export interface CheckIn {
  id: string
  member_id: string
  method: CheckInMethod
  checked_in_at: string
  checked_out_at: string | null
  staff_id: string | null
  blocked: boolean
  block_reason: string | null
  notes: string | null
}

export interface CheckInResult {
  allowed: boolean
  status: SubscriptionStatus | 'gym_closed' | 'outside_hours'
  member?: Pick<Member, 'id' | 'first_name' | 'last_name' | 'member_no' | 'avatar_url'>
  subscription?: Pick<Subscription, 'status' | 'expires_at' | 'grace_expires_at'>
  message?: string
  block_reason?: string
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'grace_period'
  | 'suspended'
  | 'payment_failed'
  | 'payment_success'
  | 'class_reminder'
  | 'class_cancelled'
  | 'booking_confirmed'
  | 'waitlist_promoted'
  | 'announcement'
  | 'referral_converted'

export type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app'

export interface Notification {
  id: string
  member_id: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  body: string
  sent_at: string | null
  read_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Referral (V1) ───────────────────────────────────────────────────────────

export type ReferralStatus = 'pending' | 'converted' | 'rewarded'

export interface Referral {
  id: string
  referrer_id: string
  referred_id: string | null
  status: ReferralStatus
  converted_at: string | null
  reward_days: number | null
  reward_amount: number | null
  reward_applied_at: string | null
  created_at: string
}

// ─── Day Pass ─────────────────────────────────────────────────────────────────

export interface DayPass {
  id: string
  member_id: string | null
  guest_name: string | null
  guest_phone: string | null
  amount: number
  payment_id: string
  valid_date: string
  used_at: string | null
  created_at: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokenPayload {
  sub: string             // staff or member id
  role: StaffRole | 'member'
  tenant_id: string
  iat: number
  exp: number
}

export interface QRTokenPayload {
  mid: string             // member_id
  tid: string             // tenant_id
  exp: number
  iat: number
  v: 1
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    per_page?: number
  }
}

export interface ApiError {
  error: string
  message: string
  details?: unknown
}
