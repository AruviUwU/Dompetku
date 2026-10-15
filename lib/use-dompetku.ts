'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Profile } from '@/lib/data-store'
import { DEFAULT_PROFILE } from '@/lib/data-store'
import { store } from '@/lib/store'
import { newId, type Transaction, type TransactionInput } from '@/lib/transactions'

/**
 * Hook tunggal untuk semua data user (profil + transaksi).
 * - Tampilan diperbarui dulu (optimistic), lalu disimpan ke store.
 * - Penyimpanan diantre berurutan supaya dua edit beruntun tidak saling menimpa di server.
 * - Kalau gagal menyimpan: muat ulang dari store dan beri tahu lewat onError.
 * - Muat ulang menunggu antrean selesai, dan hasilnya dibuang kalau ada perubahan baru selama memuat.
 */
export function useDompetku({ onError }: { onError?: (message: string) => void } = {}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [rows, setRows] = useState<Transaction[]>([])

  const rowsRef = useRef(rows)
  const profileRef = useRef(profile)
  const onErrorRef = useRef(onError)
  const hasLoaded = useRef(false)
  const mutations = useRef(0)
  const writeChain = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => { rowsRef.current = rows }, [rows])
  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const refresh = useCallback(async () => {
    try {
      for (;;) {
        const startedAt = mutations.current
        await writeChain.current
        const data = await store.load()
        if (mutations.current !== startedAt) continue // ada perubahan baru saat memuat, hasil ini sudah usang
        setProfile(data.profile)
        setRows(data.transactions)
        hasLoaded.current = true
        setStatus('ready')
        break
      }
    } catch {
      // Gagal di muat pertama = jangan tampilkan onboarding kosong; gagal berikutnya cukup diberi tahu
      if (hasLoaded.current) onErrorRef.current?.('Gagal memuat data.')
      else setStatus('error')
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Muat ulang saat tab/app kembali dibuka (dasar sinkron multi-device)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && hasLoaded.current) refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const enqueue = useCallback((job: () => Promise<void>, failMessage: string): Promise<boolean> => {
    mutations.current += 1
    const run = writeChain.current.then(job)
    writeChain.current = run.catch(() => {})
    return run.then(() => true, (e: unknown) => {
      // Saat pengembangan, tampilkan penyebab aslinya supaya mudah dilacak
      const dev = process.env.NODE_ENV !== 'production'
      const detail = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
      if (dev) console.error('[data]', e)
      onErrorRef.current?.(dev ? `${failMessage} (${detail})` : failMessage)
      refresh()
      return false
    })
  }, [refresh])

  const persist = useCallback((row: Transaction) => {
    enqueue(() => store.upsertTransaction(row), 'Gagal menyimpan. Coba lagi.')
  }, [enqueue])

  const addTransaction = useCallback((input: TransactionInput) => {
    const now = new Date().toISOString()
    const row: Transaction = { ...input, id: newId(), createdAt: now, updatedAt: now, deletedAt: null }
    setRows(prev => [row, ...prev])
    persist(row)
  }, [persist])

  const updateTransaction = useCallback((id: string, input: TransactionInput) => {
    const current = rowsRef.current.find(t => t.id === id)
    if (!current) return
    const row: Transaction = { ...current, ...input, updatedAt: new Date().toISOString() }
    setRows(prev => prev.map(t => (t.id === id ? row : t)))
    persist(row)
  }, [persist])

  const removeTransaction = useCallback((id: string) => {
    const current = rowsRef.current.find(t => t.id === id)
    if (!current) return
    const now = new Date().toISOString()
    const row: Transaction = { ...current, updatedAt: now, deletedAt: now }
    setRows(prev => prev.map(t => (t.id === id ? row : t)))
    persist(row)
  }, [persist])

  const saveProfile = useCallback((patch: Partial<Profile>) => {
    const next = { ...profileRef.current, ...patch }
    profileRef.current = next
    setProfile(next)
    enqueue(() => store.saveProfile(next), 'Gagal menyimpan profil. Coba lagi.')
  }, [enqueue])

  // Pindahkan data dari perangkat ini ke akun (id yang sama tidak akan terduplikasi)
  const importData = useCallback((data: { profile: Profile; transactions: Transaction[] }): Promise<boolean> => {
    const known = new Set(rowsRef.current.map(t => t.id))
    const fresh = data.transactions.filter(t => !t.deletedAt && !known.has(t.id))
    setRows(prev => [...fresh, ...prev])
    profileRef.current = data.profile
    setProfile(data.profile)
    return enqueue(async () => {
      await store.upsertTransactions(fresh)
      await store.saveProfile(data.profile)
    }, 'Gagal memindahkan data. Coba lagi.')
  }, [enqueue])

  const transactions = useMemo(() => rows.filter(t => !t.deletedAt), [rows])

  return {
    ready: status === 'ready',
    loadFailed: status === 'error',
    profile, transactions, saveProfile, addTransaction, updateTransaction, removeTransaction, importData, refresh,
  }
}
