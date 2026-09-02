import { NextRequest, NextResponse } from 'next/server'

const API = process.env.API_URL ?? 'http://localhost:4000'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const qs = new URLSearchParams()
    if (searchParams.get('email')) qs.set('email', searchParams.get('email')!)
    if (searchParams.get('mid')) qs.set('mid', searchParams.get('mid')!)
    const res = await fetch(`${API}/api/public/gym/${slug}/member?${qs}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
