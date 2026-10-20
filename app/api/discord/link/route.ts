import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Service role client — bypasses RLS, server-only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SECRET = process.env.BOT_API_SECRET || 'fallback-secret-dompetku'

interface TokenPayload {
  discord_id: string
  discord_name: string
  exp: number
}

function createSignedToken(discord_id: string, discord_name: string): string {
  const payload: TokenPayload = {
    discord_id,
    discord_name: discord_name || '',
    exp: Date.now() + 15 * 60 * 1000, // 15 menit
  }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  return `${payloadStr}.${sig}`
}

function verifySignedToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [payloadStr, sig] = parts

    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payloadStr)
      .digest('base64url')

    if (sig !== expectedSig) return null

    const payload: TokenPayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf8'),
    )

    if (!payload.discord_id || !payload.exp) return null
    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}

// ── POST: Bot requests a new link token ─────────────────────────────────────
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { discord_id, discord_name } = await request.json()
    if (!discord_id) {
      return NextResponse.json({ error: 'discord_id required' }, { status: 400 })
    }

    // Check if already linked
    const { data: existing } = await supabaseAdmin
      .from('discord_links')
      .select('user_id')
      .eq('discord_id', String(discord_id))
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'already_linked' }, { status: 409 })
    }

    // Generate stateless signed token (valid for 15 minutes)
    const token = createSignedToken(String(discord_id), discord_name || '')

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://dompetku-hazel.vercel.app'
    const linkUrl = `${baseUrl}/link-discord?token=${token}`

    return NextResponse.json({ url: linkUrl, token })
  } catch (err) {
    console.error('[discord/link] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── GET: Link page verifies a token ─────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const payload = verifySignedToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Token expired or invalid' }, { status: 404 })
    }

    // Check if already linked
    const { data: existing } = await supabaseAdmin
      .from('discord_links')
      .select('user_id')
      .eq('discord_id', payload.discord_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'already_linked' }, { status: 409 })
    }

    return NextResponse.json({
      discord_id: payload.discord_id,
      discord_name: payload.discord_name,
    })
  } catch (err) {
    console.error('[discord/link] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── PUT: User confirms the link ─────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const { token, access_token } = await request.json()
    if (!token || !access_token) {
      return NextResponse.json(
        { error: 'token and access_token required' },
        { status: 400 },
      )
    }

    const payload = verifySignedToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token expired or invalid' },
        { status: 404 },
      )
    }

    // Verify user from access token
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(access_token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
    }

    // Insert or update link
    const { error: linkError } = await supabaseAdmin.from('discord_links').upsert(
      {
        discord_id: payload.discord_id,
        user_id: user.id,
        discord_name: payload.discord_name,
      },
      { onConflict: 'discord_id' },
    )

    if (linkError) {
      if (linkError.code === '23505') {
        return NextResponse.json(
          { error: 'Discord atau akun sudah terhubung' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, discord_name: payload.discord_name })
  } catch (err) {
    console.error('[discord/link] PUT error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
