import { useState } from 'react'
import { api } from '@/lib/api'
import type { PaymentMethod } from '@/components/PaymentModal'

export interface MemberPaymentState {
  memberId: string | null
  loading: boolean
  error: string | null
  success: boolean
  paymentRef: string | null
  paymentMethod: PaymentMethod | null
}

export function useMemberPaymentFlow() {
  const [state, setState] = useState<MemberPaymentState>({
    memberId: null,
    loading: false,
    error: null,
    success: false,
    paymentRef: null,
    paymentMethod: null,
  })

  const createMemberWithPayment = async (memberData: {
    name: string
    email: string
    phone?: string
    notes?: string
    plan_id?: string
    payment_method: PaymentMethod
    phone_for_payment?: string
  }) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const response = await api.post<{
        ok: boolean
        id: string
        payment_ref: string
        payment_method: PaymentMethod
        requires_confirmation: boolean
        message: string
        plan_price: number
      }>('/api/members/with-payment', memberData)

      setState(prev => ({
        ...prev,
        memberId: response.id,
        paymentRef: response.payment_ref,
        paymentMethod: response.payment_method,
        success: true,
        loading: false,
      }))

      return response
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to create member'
      setState(prev => ({ ...prev, error, loading: false }))
      throw err
    }
  }

  const confirmMemberPayment = async (memberId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      await api.post<{ ok: boolean }>(
        `/api/members/${memberId}/confirm-payment`,
        {}
      )
      setState(prev => ({ ...prev, success: true, loading: false }))
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to confirm payment'
      setState(prev => ({ ...prev, error, loading: false }))
      throw err
    }
  }

  const reset = () => {
    setState({
      memberId: null,
      loading: false,
      error: null,
      success: false,
      paymentRef: null,
      paymentMethod: null,
    })
  }

  return {
    ...state,
    createMemberWithPayment,
    confirmMemberPayment,
    reset,
  }
}
