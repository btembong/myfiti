import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('myfiti_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated. Please sign in again.' }, { status: 401 })
    }

    const body = await req.json()
    const { gymName, slug, country, timezone, selectedPlan, tranzakSkip, tranzakAppId, tranzakAppSecret } = body

    if (!gymName || !slug || !country || !timezone) {
      return NextResponse.json({ error: 'Missing required gym info.' }, { status: 400 })
    }
    if (!selectedPlan) {
      return NextResponse.json({ error: 'Please select a myfiti plan.' }, { status: 400 })
    }

    const apiUrl = process.env.API_URL ?? 'http://localhost:4000'
    const res = await fetch(`${apiUrl}/api/onboarding/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...body,
        tranzakAppId: tranzakSkip ? null : tranzakAppId,
        tranzakAppSecret: tranzakSkip ? null : tranzakAppSecret,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Onboarding failed. Please try again.' }, { status: res.status })
    }

    return NextResponse.json({ ok: true, tenantSlug: slug })
  } catch (err) {
    console.error('[onboarding/complete]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
