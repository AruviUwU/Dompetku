'use client'

import { useState } from 'react'
import { Eye, EyeOff, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuthApi } from '@/lib/use-auth'

type Mode = 'login' | 'signup' | 'forgot'

const inputClass = 'h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-emerald-400/40'

export default function AuthScreen({ auth }: { auth: AuthApi }) {
  const recovery = auth.recovery
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const showEmail = !recovery
  const showPassword = recovery || mode !== 'forgot'
  const newPassword = recovery || mode === 'signup'

  const title = recovery ? 'Buat password baru' : mode === 'login' ? 'Masuk' : mode === 'signup' ? 'Buat akun' : 'Lupa password'
  const subtitle = recovery ? 'Pilih password baru untuk akunmu.'
    : mode === 'login' ? 'Masuk untuk melihat keuanganmu di perangkat mana pun.'
    : mode === 'signup' ? 'Daftar dengan email agar datamu tersimpan aman dan bisa dibuka di banyak perangkat.'
    : 'Masukkan emailmu, kami kirim tautan untuk membuat password baru.'
  const submitLabel = recovery ? 'Simpan password' : mode === 'login' ? 'Masuk' : mode === 'signup' ? 'Daftar' : 'Kirim tautan'

  function switchMode(next: Mode) { setMode(next); setError(''); setInfo(''); setPassword('') }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(''); setInfo('')
    if (newPassword && password.length < 8) { setError('Password minimal 8 karakter.'); return }
    setBusy(true)
    try {
      if (recovery) {
        const err = await auth.updatePassword(password)
        if (err) setError(err)
      } else if (mode === 'login') {
        const err = await auth.signIn(email.trim(), password)
        if (err) setError(err)
      } else if (mode === 'signup') {
        const result = await auth.signUp(email.trim(), password)
        if (result.error) setError(result.error)
        else if (result.needsConfirmation) {
          setMode('login'); setPassword('')
          setInfo('Tautan konfirmasi sudah dikirim ke emailmu. Klik tautan itu, lalu masuk di sini.')
        }
      } else {
        const err = await auth.resetPassword(email.trim())
        if (err) setError(err)
        else setInfo('Jika email itu terdaftar, tautan reset password sudah dikirim. Cek kotak masuk dan folder spam.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-background p-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid size-16 place-items-center rounded-3xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/30"><Wallet className="size-8" /></div>
        <h1 className="text-2xl font-bold tracking-tight">Dompetku</h1>
      </div>

      <form onSubmit={submit} className="w-full max-w-sm">
        <h2 className="mb-1 text-xl font-semibold">{title}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>

        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
        {info && <p role="status" className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{info}</p>}

        {showEmail && (
          <input
            type="email" required autoComplete="email" inputMode="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="Email" aria-label="Email"
            className={`${inputClass} mb-3`}
          />
        )}
        {showPassword && (
          <div className="relative mb-3">
            <input
              type={show ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={newPassword ? 'new-password' : 'current-password'}
              placeholder={newPassword ? 'Password (minimal 8 karakter)' : 'Password'} aria-label="Password"
              className={`${inputClass} pr-12`}
            />
            <button type="button" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        )}

        <Button type="submit" disabled={busy} className="mt-2 h-12 w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
          {busy ? 'Memproses...' : submitLabel}
        </Button>

        {!recovery && (
          <div className="mt-5 flex flex-col items-center gap-2 text-sm">
            {mode === 'login' && (<>
              <button type="button" onClick={() => switchMode('forgot')} className="text-muted-foreground hover:text-foreground">Lupa password?</button>
              <button type="button" onClick={() => switchMode('signup')} className="text-emerald-400 hover:text-emerald-300">Belum punya akun? Daftar</button>
            </>)}
            {mode === 'signup' && <button type="button" onClick={() => switchMode('login')} className="text-emerald-400 hover:text-emerald-300">Sudah punya akun? Masuk</button>}
            {mode === 'forgot' && <button type="button" onClick={() => switchMode('login')} className="text-emerald-400 hover:text-emerald-300">← Kembali ke masuk</button>}
          </div>
        )}
      </form>
    </div>
  )
}
