import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const apiUrl = process.env.API_URL ?? 'http://localhost:4000'
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Invalid email or password.' }, { status: res.status })
    }

    const response = NextResponse.json({
      ok: true,
      token: data.token,
      tenantSlug: data.tenantSlug ?? null,
      onboardingComplete: data.onboardingComplete ?? false,
    })
    response.cookies.set('myfiti_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
