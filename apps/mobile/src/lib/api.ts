import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myfiti.app'

let _onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) { _onUnauthorized = fn }

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(
  path: string,
  opts: RequestInit & { tenantSlug?: string; skipAuth?: boolean } = {},
): Promise<T> {
  const { tenantSlug, skipAuth, ...fetchOpts } = opts

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string>),
  }

  if (!skipAuth) {
    const token = Platform.OS === 'web'
      ? localStorage.getItem('gymflow_access_token')
      : await SecureStore.getItemAsync('gymflow_access_token')
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  if (tenantSlug) {
    headers['x-tenant-slug'] = tenantSlug
  }

  const res = await fetch(`${BASE}/api${path}`, { ...fetchOpts, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    if (res.status === 401) _onUnauthorized?.()
    throw new ApiError(res.status, body.error ?? body.message ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  requestOtp: (tenantSlug: string, identifier: string) =>
    apiRequest<{ ok: boolean; message: string }>('/auth/member/request-otp', {
      method: 'POST',
      body: JSON.stringify({ tenantSlug, identifier }),
      skipAuth: true,
    }),

  verifyOtp: (tenantSlug: string, identifier: string, otp: string, deviceName?: string, deviceType?: string) =>
    apiRequest<{ ok: boolean; token: string; refreshToken: string; memberId: string }>(
      '/auth/member/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ tenantSlug, identifier, otp, deviceName, deviceType }),
        skipAuth: true,
      },
    ),

  loginWithPin: (tenantSlug: string, identifier: string, pin: string, deviceName?: string, deviceType?: string) =>
    apiRequest<{ ok: boolean; token: string; refreshToken: string; memberId: string }>(
      '/auth/member/login-with-pin',
      {
        method: 'POST',
        body: JSON.stringify({ tenantSlug, identifier, pin, deviceName, deviceType }),
        skipAuth: true,
      },
    ),

  resendOtp: (tenantSlug: string, identifier: string) =>
    apiRequest<{ ok: boolean }>('/auth/member/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ tenantSlug, identifier }),
      skipAuth: true,
    }),
}

// ─── Member Me ───────────────────────────────────────────────────────────────

export const memberApi = {
  getProfile: (tenantSlug: string) =>
    apiRequest<{
      member: {
        id: string; name: string
        email: string; phone: string | null; avatar_url: string | null
        joined_at: string; qr_code: string | null; status: string
        has_pin: boolean
        emergency_contact: { name: string; phone: string | null; relation: string | null } | null
      }
      subscription: {
        id: string; status: string; expires_at: string; started_at: string
        plan_name: string; plan_price: number; auto_renew: boolean
      } | null
      stats: { visitsThisMonth: number; lastVisit: string | null }
      gym: { name: string; logo_url: string | null; primary_color: string; currency: string } | null
    }>('/member/me', { tenantSlug }),

  getReceipts: (tenantSlug: string) =>
    apiRequest<{ receipts: Array<{
      id: string; amount: number; currency: string
      provider: string; tranzak_ref: string | null
      status: string; payment_type: string
      paid_at: string | null; created_at: string; plan_name: string | null
    }> }>('/member/me/receipts', { tenantSlug }),

  getSchedule: (tenantSlug: string) =>
    apiRequest<{ bookings: Array<{
      booking_id: string; booking_status: string
      class_id: string; scheduled_at: string; ends_at: string
      class_name: string; duration_minutes: number
      trainer_name: string | null
      room: string | null; capacity: number; booked_count: string
    }> }>('/member/me/schedule', { tenantSlug }),

  getClasses: (tenantSlug: string, days = 7) =>
    apiRequest<{ classes: Array<{
      class_id: string; scheduled_at: string; ends_at: string
      class_name: string; duration_minutes: number
      trainer_name: string | null
      room: string | null; capacity: number; booked_count: string
      my_booking_id: string | null; my_booking_status: string | null
    }> }>(`/member/me/classes?days=${days}`, { tenantSlug }),

  bookClass: (tenantSlug: string, classId: string) =>
    apiRequest<{ ok: boolean; id: string; status: string }>('/member/me/bookings', {
      method: 'POST',
      body: JSON.stringify({ class_id: classId }),
      tenantSlug,
    }),

  cancelBooking: (tenantSlug: string, bookingId: string) =>
    apiRequest<{ ok: boolean }>(`/member/me/bookings/${bookingId}`, {
      method: 'DELETE',
      tenantSlug,
    }),

  getNotifications: (tenantSlug: string) =>
    apiRequest<{
      notifications: Array<{
        id: string; type: string; title: string; body: string
        read_at: string | null; created_at: string
      }>
      unreadCount: number
    }>('/member/me/notifications', { tenantSlug }),

  markNotificationRead: (tenantSlug: string, id: string) =>
    apiRequest<{ ok: boolean }>(`/member/me/notifications/${id}/read`, {
      method: 'PATCH',
      tenantSlug,
    }),

  markAllNotificationsRead: (tenantSlug: string) =>
    apiRequest<{ ok: boolean }>('/member/me/notifications/read-all', {
      method: 'PATCH',
      tenantSlug,
    }),

  updateProfile: (tenantSlug: string, data: { phone?: string }) =>
    apiRequest<{ ok: boolean }>('/member/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
      tenantSlug,
    }),

  registerPushToken: (tenantSlug: string, token: string) =>
    apiRequest<{ ok: boolean }>('/member/me/push-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
      tenantSlug,
    }),

  deregisterPushToken: (tenantSlug: string) =>
    apiRequest<{ ok: boolean }>('/member/me/push-token', {
      method: 'DELETE',
      tenantSlug,
    }),

  setPin: (tenantSlug: string, pin: string) =>
    apiRequest<{ ok: boolean }>('/member/me/pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
      tenantSlug,
    }),

  removePin: (tenantSlug: string) =>
    apiRequest<{ ok: boolean }>('/member/me/pin', {
      method: 'DELETE',
      tenantSlug,
    }),

  updateEmergencyContact: (tenantSlug: string, contact: { name: string; phone: string; relation: string } | null) =>
    apiRequest<{ ok: boolean }>('/member/me', {
      method: 'PATCH',
      body: JSON.stringify({ emergency_contact: contact }),
      tenantSlug,
    }),

  deleteAccount: (tenantSlug: string, reason: string) =>
    apiRequest<{ ok: boolean }>('/member/me', {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
      tenantSlug,
    }),

  getReferral: (tenantSlug: string) =>
    apiRequest<{
      referral_code: string
      total_referred: number
      converted: number
      total_earned: number
      referred: Array<{ initials: string; status: string; created_at: string }>
    }>('/member/me/referral', { method: 'GET', tenantSlug }),

  getWallet: (tenantSlug: string) =>
    apiRequest<{
      balance: number
      currency: string
      transactions: Array<{
        id: string; type: string; amount: number
        description: string; status: string; created_at: string
      }>
    }>('/member/wallet', { method: 'GET', tenantSlug }),

  walletTopup: (tenantSlug: string, amount: number, phone: string) =>
    apiRequest<{ ok: boolean; requestId: string; reference: string }>('/member/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amount, phone }),
      tenantSlug,
    }),

  walletPaySubscription: (tenantSlug: string) =>
    apiRequest<{ ok: boolean; newBalance: number; newEndDate: string }>('/member/wallet/pay-subscription', {
      method: 'POST',
      tenantSlug,
    }),

  walletPayPlan: (tenantSlug: string, planId: string) =>
    apiRequest<{ ok: boolean; newBalance: number; newEndDate: string }>('/member/wallet/pay-plan', {
      method: 'POST',
      body: JSON.stringify({ planId }),
      tenantSlug,
    }),

  walletLookupRecipient: (tenantSlug: string, phone: string) =>
    apiRequest<{ id: string; name: string }>(`/member/wallet/lookup?phone=${encodeURIComponent(phone)}`, {
      method: 'GET',
      tenantSlug,
    }),

  walletTransfer: (tenantSlug: string, recipientId: string, amount: number, note?: string) =>
    apiRequest<{ ok: boolean; senderBalance: number; recipientBalance: number; recipientName: string }>('/member/wallet/transfer', {
      method: 'POST',
      body: JSON.stringify({ recipientId, amount, note }),
      tenantSlug,
    }),

  walletCashout: (tenantSlug: string, amount: number, phone: string) =>
    apiRequest<{ ok: boolean; requestId: string; newBalance: number }>('/member/wallet/cashout', {
      method: 'POST',
      body: JSON.stringify({ amount, phone }),
      tenantSlug,
    }),

  getDeviceSessions: (tenantSlug: string) =>
    apiRequest<{
      sessions: Array<{
        id: string; device_name: string
        device_type: 'mobile' | 'tablet' | 'desktop'
        location: string; last_active_at: string
        is_current: boolean; biometric_secured?: boolean
      }>
      alerts: Array<{ id: string; message: string }>
    }>('/member/me/sessions', { tenantSlug }),

  revokeSession: (tenantSlug: string, sessionId: string) =>
    apiRequest<{ ok: boolean }>(`/member/me/sessions/${sessionId}`, {
      method: 'DELETE', tenantSlug,
    }),

  revokeAllSessions: (tenantSlug: string) =>
    apiRequest<{ ok: boolean }>('/member/me/sessions/others', {
      method: 'DELETE', tenantSlug,
    }),

  getPlans: (tenantSlug: string) =>
    apiRequest<{ plans: Array<{
      id: string; name: string; description: string | null
      price: number; currency: string; duration_days: number; cycle: string
      features: string[] | null
    }> }>('/member/me/plans', { tenantSlug }),

  redeemVoucher: (tenantSlug: string, code: string) =>
    apiRequest<{ ok: boolean; credit: number; newBalance: number; currency: string }>(
      '/member/me/redeem-voucher',
      { method: 'POST', body: JSON.stringify({ code }), tenantSlug },
    ),

  initiateRenewal: (tenantSlug: string, data: { plan_id: string; phone: string }) =>
    apiRequest<{ ok: boolean; payment_id: string; request_id: string }>(
      '/member/me/renew',
      { method: 'POST', body: JSON.stringify(data), tenantSlug },
    ),

  getPaymentStatus: (tenantSlug: string, paymentId: string) =>
    apiRequest<{ status: string; amount: number; currency: string }>(
      `/member/me/payment/${paymentId}`,
      { tenantSlug },
    ),

  getCheckinHistory: (tenantSlug: string, limit = 60) =>
    apiRequest<{
      checkins: Array<{ id: string; method: string; checked_in_at: string }>
    }>(`/member/me/checkin-history?limit=${limit}`, { tenantSlug }),

  scanCheckIn: (tenantSlug: string, token: string) =>
    apiRequest<{
      ok: boolean
      member_name: string
      plan_name: string | null
      status: 'active' | 'expiring_soon' | 'grace_period' | 'expired' | 'suspended'
      message: string
    }>('/member/me/checkin', {
      method: 'POST',
      body: JSON.stringify({ token }),
      tenantSlug,
    }),
}
