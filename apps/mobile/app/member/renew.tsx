import { useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'

// Deep link redirect — handles gymflow://member/renew?gym=...&mid=...
// and https://app.myfiti.fit/member/renew?gym=...&mid=... (Universal Links)
// Redirects to the main /renew screen, passing through all params.

export default function MemberRenewRedirect() {
  const router = useRouter()
  const params = useLocalSearchParams<{ gym?: string; mid?: string }>()

  useEffect(() => {
    const qs = new URLSearchParams()
    if (params.gym) qs.set('gym', params.gym)
    if (params.mid) qs.set('mid', params.mid)
    const query = qs.toString()
    router.replace(query ? `/renew?${query}` : '/renew')
  }, [])

  return null
}
