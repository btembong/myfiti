import { z } from 'zod'

// ─── Members ──────────────────────────────────────────────────────────────────

export const createMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export const createMemberWithPaymentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  payment_method: z.enum(['momo', 'cash', 'bank_transfer']).default('cash'),
  plan_id: z.string().uuid().optional().nullable(),
  phone_for_payment: z.string().max(30).optional().nullable(),
  referredByCode: z.string().max(20).optional().nullable(),
})

export const updateMemberSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

export const importMembersSchema = z.object({
  members: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().max(30).optional(),
    notes: z.string().max(2000).optional(),
    plan_name: z.string().max(200).optional(),
    started_at: z.string().optional(),
    expires_at: z.string().optional(),
  })).min(1, 'At least one member is required').max(500, 'Maximum 500 members per import'),
})

// ─── Payments ─────────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  member_id: z.string().uuid('Invalid member ID'),
  subscription_id: z.string().uuid().optional().nullable(),
  amount: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d+)?$/)]).transform(Number),
  currency: z.string().length(3).default('XAF'),
  provider: z.enum(['cash', 'tranzak', 'card', 'bank_transfer']),
  provider_ref: z.string().max(200).optional().nullable(),
  payment_type: z.enum(['subscription', 'day_pass', 'other']).default('subscription'),
  notes: z.string().max(2000).optional().nullable(),
})

// ─── Plans ────────────────────────────────────────────────────────────────────

// HH:MM or HH:MM:SS — from HTML <input type="time">
const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format').optional().nullable()

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]).transform(Number),
  duration_days: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(Number),
  currency: z.string().length(3).default('XAF'),
  features: z.string().max(2000).optional().nullable(),
  access_type: z.enum(['open', 'time_slot']).default('open'),
  access_start_time: timeString,
  access_end_time: timeString,
})

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]).transform(Number).optional(),
  duration_days: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(Number).optional(),
  features: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
  access_type: z.enum(['open', 'time_slot']).optional(),
  access_start_time: timeString,
  access_end_time: timeString,
})

// ─── Settings / Staff ─────────────────────────────────────────────────────────

export const createStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(['Admin', 'Trainer', 'Receptionist']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  pin: z.string().regex(/^\d{4,6}$/).optional().nullable(),
})
