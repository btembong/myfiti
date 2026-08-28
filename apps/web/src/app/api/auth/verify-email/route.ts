import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 })
    }

    const apiUrl = process.env.API_URL ?? 'http://localhost:4000'
    const res = await fetch(`${apiUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Verification failed.' }, { status: res.status })
    }

    // Set JWT cookie (owner pre-onboarding token)
    const response = NextResponse.json({ ok: true })
    response.cookies.set('myfiti_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[verify-email]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
