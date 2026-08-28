import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const apiUrl = process.env.API_URL ?? 'http://localhost:4000'
    const res = await fetch(`${apiUrl}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Failed to resend code.' }, { status: res.status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[resend-otp]', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
