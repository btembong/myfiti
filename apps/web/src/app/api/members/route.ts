import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function decodeJwt(token: string) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
  } catch {
    return null
  }
}

async function apiHeaders(token: string) {
  const payload = decodeJwt(token)
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(payload?.tenant_id ? { 'x-tenant-id': payload.tenant_id } : {}),
  }
}

const API = process.env.API_URL ?? 'http://localhost:4000'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('myfiti_token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const qs = new URLSearchParams()
    if (searchParams.get('search')) qs.set('search', searchParams.get('search')!)
    if (searchParams.get('status')) qs.set('status', searchParams.get('status')!)

    const res = await fetch(`${API}/api/members?${qs}`, { headers: await apiHeaders(token) })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[api/members GET]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('myfiti_token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const body = await req.json()
    const res = await fetch(`${API}/api/members`, {
      method: 'POST',
      headers: await apiHeaders(token),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[api/members POST]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
