import { NextRequest, NextResponse } from 'next/server'

const API = process.env.API_URL ?? 'http://localhost:4000'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const res = await fetch(`${API}/api/public/gym/${slug}/plans`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
