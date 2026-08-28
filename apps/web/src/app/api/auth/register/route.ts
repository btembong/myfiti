import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, country, password, pin, referralCode, marketingOptIn } = await req.json()

    if (!name || !phone || !email || !country || !password || !pin) {
      return NextResponse.json({ error: 'All required fields must be filled.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 })
    }

    const apiUrl = process.env.API_URL ?? 'http://localhost:4000'
    const res = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, country, password, pin, referralCode, marketingOptIn }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Registration failed.' }, { status: res.status })
    }

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
    console.error('[register]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
