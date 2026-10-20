'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { getSupabase } from '@/lib/supabase/client'
import { Wallet, LinkIcon, CheckCircle, XCircle, Clock } from 'lucide-react'
import AuthScreen from '@/components/auth-screen'

function LinkDiscordContent() {
  const params = useSearchParams()
  const token = params.get('token')
  const auth = useAuth()
  const { user, loading: authLoading } = auth

  const [discordInfo, setDiscordInfo] = useState<{
    discord_id: string
    discord_name: string
  } | null>(null)
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'linking' | 'success' | 'error' | 'expired'
  >('loading')
  const [errorMsg, setErrorMsg] = useState('')

  // Fetch token info
  useEffect(() => {
    if (!token) {
      setStatus('expired')
      return
    }
    fetch(`/api/discord/link?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setStatus('expired')
          return
        }
        setDiscordInfo(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [token])

  // Jika belum login, tampilkan auth screen
  if (!authLoading && !user && status === 'ready') {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 pt-8 text-center">
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="grid size-16 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/30">
              <Wallet className="size-7" />
            </div>
            <h1 className="text-xl font-bold">Hubungkan Discord</h1>
            <p className="text-sm text-muted-foreground">
              Masuk ke akun Dompetku untuk menghubungkan Discord{' '}
              <strong className="text-foreground">{discordInfo?.discord_name}</strong>
            </p>
          </div>
          <AuthScreen auth={auth} />
        </div>
      </div>
    )
  }

  const handleLink = async () => {
    if (!token || !user) return
    setStatus('linking')
    try {
      const session = await getSupabase()!.auth.getSession()
      const accessToken = session.data.session?.access_token
      if (!accessToken) {
        setErrorMsg('Sesi tidak ditemukan. Coba login ulang.')
        setStatus('error')
        return
      }
      const res = await fetch('/api/discord/link', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, access_token: accessToken }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
      } else {
        setErrorMsg(data.error || 'Gagal menghubungkan')
        setStatus('error')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Koneksi gagal. Periksa internet dan coba lagi.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-400/10 to-emerald-400/5 px-8 pb-6 pt-8">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/30">
            <Wallet className="size-7" />
          </div>
          <h1 className="text-center text-xl font-bold tracking-tight">
            Hubungkan Discord
          </h1>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 pt-6">
          {/* Loading */}
          {(status === 'loading' || authLoading) && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="size-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="text-sm text-muted-foreground">Memuat...</p>
            </div>
          )}

          {/* Token expired */}
          {status === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-red-400/10">
                <Clock className="size-6 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-red-400">Link Kedaluwarsa</h2>
              <p className="text-sm text-muted-foreground">
                Link ini sudah tidak berlaku. Ketik{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/link</code>{' '}
                lagi di Discord untuk mendapatkan yang baru.
              </p>
            </div>
          )}

          {/* Ready — show confirmation */}
          {status === 'ready' && discordInfo && user && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-emerald-400/10">
                <LinkIcon className="size-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Hubungkan akun Discord
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {discordInfo.discord_name}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>ke akun Dompetku</span>
              </div>
              <p className="font-medium text-foreground">{user.email}</p>

              <button
                onClick={handleLink}
                className="mt-2 h-12 w-full rounded-xl bg-emerald-400 font-semibold text-slate-950 transition hover:bg-emerald-300 active:scale-[0.98]"
              >
                ✅ Hubungkan Sekarang
              </button>
            </div>
          )}

          {/* Linking in progress */}
          {status === 'linking' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="size-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="text-sm text-muted-foreground">Menghubungkan akun...</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-emerald-400/10">
                <CheckCircle className="size-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-emerald-400">Berhasil! 🎉</h2>
              <p className="text-sm text-muted-foreground">
                Akun Discord sudah terhubung dengan Dompetku.
                <br />
                Kembali ke Discord dan mulai catat transaksi!
              </p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-red-400/10">
                <XCircle className="size-6 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-red-400">Gagal</h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <button
                onClick={() => setStatus('ready')}
                className="mt-2 text-sm text-emerald-400 hover:text-emerald-300"
              >
                Coba lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LinkDiscordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="size-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
      }
    >
      <LinkDiscordContent />
    </Suspense>
  )
}
