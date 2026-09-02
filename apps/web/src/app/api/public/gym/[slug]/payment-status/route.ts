import { NextRequest, NextResponse } from 'next/server'

const API = process.env.API_URL ?? 'http://localhost:4000'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const { searchParams } = req.nextUrl
    const pid = searchParams.get('pid') ?? ''
    const mid = searchParams.get('mid') ?? ''
    const res = await fetch(`${API}/api/public/gym/${slug}/payment-status?pid=${encodeURIComponent(pid)}&mid=${encodeURIComponent(mid)}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
