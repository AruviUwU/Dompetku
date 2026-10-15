'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AuthError, User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase/client'

function friendly(error: AuthError): string {
  const m = error.message.toLowerCase()
  if (process.env.NODE_ENV !== 'production') console.error('[auth]', error.status, error.message)
  if (m.includes('invalid login credentials')) return 'Email atau password salah.'
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masukmu.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Email ini sudah terdaftar. Coba masuk.'
  if (error.status === 429 || m.includes('rate limit')) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.'
  if (m.includes('same password')) return 'Password baru harus berbeda dari yang lama.'
  if (m.includes('database error')) return 'Gagal membuat profil di database. Pastikan schema.sql sudah dijalankan tanpa error.'
  if (m.includes('not authorized')) return 'Email ini belum diizinkan oleh pengirim email bawaan Supabase. Matikan Confirm email di dashboard, atau pasang SMTP sendiri.'
  if (m.includes('sending') && m.includes('email')) return 'Gagal mengirim email konfirmasi. Untuk uji coba, matikan Confirm email di dashboard.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Pendaftaran sedang dinonaktifkan di pengaturan Supabase.'
  if (m.includes('email') && m.includes('invalid')) return 'Alamat email tidak valid.'
  if (m.includes('password')) return 'Password belum memenuhi syarat (minimal 8 karakter).'
  if (m.includes('fetch') || m.includes('network')) return 'Tidak bisa terhubung. Periksa koneksi internet.'
  // Saat pengembangan, tampilkan pesan asli supaya penyebabnya terlihat
  return process.env.NODE_ENV !== 'production' ? `Terjadi kesalahan. Coba lagi. (${error.message})` : 'Terjadi kesalahan. Coba lagi.'
}

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [recovery, setRecovery] = useState(false) // true setelah user membuka tautan reset password

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) { setLoading(false); return }
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setLoading(false)
    })
    sb.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setLoading(false) })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase()!.auth.signInWithPassword({ email, password })
    return error ? friendly(error) : null
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabase()!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    if (error) return { error: friendly(error) }
    return { needsConfirmation: !data.session }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await getSupabase()!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    return error ? friendly(error) : null
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase()!.auth.updateUser({ password })
    if (error) return friendly(error)
    setRecovery(false)
    return null
  }, [])

  const signOut = useCallback(async () => { await getSupabase()!.auth.signOut() }, [])

  return { loading, user, recovery, signIn, signUp, resetPassword, updatePassword, signOut }
}

export type AuthApi = ReturnType<typeof useAuth>
