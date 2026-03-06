import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const password = process.env.INVESTOR_PAGE_PASSWORD
  if (!password) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const body = await request.json()
  if (body.password !== password) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('investors_auth', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return response
}
