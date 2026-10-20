import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS, server-only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// In-memory store for pending link tokens (short-lived: 5 min)
const pendingLinks = new Map<
  string,
  { discordId: string; discordName: string; expiresAt: number }
>()

function cleanExpired() {
  const now = Date.now()
  for (const [k, v] of pendingLinks) {
    if (v.expiresAt < now) pendingLinks.delete(k)
  }
}

// ── POST: Bot requests a new link token ─────────────────────────────────────
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.BOT_API_SECRET}`) {
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

    // Generate unique token
    const token = crypto.randomUUID()
    pendingLinks.set(token, {
      discordId: String(discord_id),
      discordName: discord_name || '',
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    })

    cleanExpired()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dompetku.vercel.app'
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

    const pending = pendingLinks.get(token)
    if (!pending || pending.expiresAt < Date.now()) {
      return NextResponse.json({ error: 'Token expired or invalid' }, { status: 404 })
    }

    return NextResponse.json({
      discord_id: pending.discordId,
      discord_name: pending.discordName,
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

    const pending = pendingLinks.get(token)
    if (!pending || pending.expiresAt < Date.now()) {
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

    // Insert link
    const { error: linkError } = await supabaseAdmin.from('discord_links').insert({
      discord_id: pending.discordId,
      user_id: user.id,
      discord_name: pending.discordName,
    })

    if (linkError) {
      // Unique constraint violation — already linked
      if (linkError.code === '23505') {
        return NextResponse.json(
          { error: 'Discord atau akun sudah terhubung' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    pendingLinks.delete(token)
    return NextResponse.json({ success: true, discord_name: pending.discordName })
  } catch (err) {
    console.error('[discord/link] PUT error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
