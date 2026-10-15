import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_PROFILE, type DataStore } from '@/lib/data-store'
import { getSupabase } from '@/lib/supabase/client'
import type { Transaction } from '@/lib/transactions'

const PAGE = 1000 // batas baris per permintaan di Supabase

type ProfileRow = { name: string; monthly_budget: number; initial_balance: number; onboarding_done: boolean }
type TransactionRow = {
  id: string; name: string; category: string; date: string; amount: number; type: 'income' | 'expense'
  created_at: string; updated_at: string; deleted_at: string | null
}

const iso = (value: string) => new Date(value).toISOString()

// user_id diisi server (auth.uid()), updated_at diisi trigger
const toRow = (row: Transaction) => ({
  id: row.id, name: row.name, category: row.category, date: row.date, amount: Math.round(row.amount), type: row.type,
  created_at: row.createdAt, deleted_at: row.deletedAt,
})

export function createSupabaseStore(getClient: () => SupabaseClient | null): DataStore {
  const client = () => {
    const c = getClient()
    if (!c) throw new Error('Supabase belum dikonfigurasi')
    return c
  }
  const userId = async () => {
    const { data } = await client().auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('Belum masuk')
    return id
  }

  return {
    async load() {
      const sb = client()
      const uid = await userId()

      const { data: p, error: profileError } = await sb
        .from('profiles')
        .select('name, monthly_budget, initial_balance, onboarding_done')
        .eq('id', uid)
        .maybeSingle()
      if (profileError) throw profileError
      const pr = p as ProfileRow | null
      const profile = pr
        ? { name: pr.name, monthlyBudget: Number(pr.monthly_budget), initialBalance: Number(pr.initial_balance), onboardingDone: pr.onboarding_done }
        : DEFAULT_PROFILE

      // Hanya baris yang belum dihapus; diambil per halaman supaya tidak terpotong di 1000 baris
      const transactions: Transaction[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb
          .from('transactions')
          .select('id, name, category, date, amount, type, created_at, updated_at, deleted_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        const rows = (data ?? []) as TransactionRow[]
        for (const r of rows) {
          transactions.push({
            id: r.id, name: r.name, category: r.category, date: r.date, amount: Number(r.amount), type: r.type,
            createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), deletedAt: r.deleted_at ? iso(r.deleted_at) : null,
          })
        }
        if (rows.length < PAGE) break
      }
      return { profile, transactions }
    },

    async saveProfile(profile) {
      const sb = client()
      const uid = await userId()
      const values = {
        name: profile.name,
        monthly_budget: Math.round(profile.monthlyBudget), // kolom bigint: tidak menerima desimal
        initial_balance: Math.round(profile.initialBalance),
        onboarding_done: profile.onboardingDone,
      }
      // Profil biasanya sudah dibuat trigger saat daftar, jadi update dulu; insert hanya kalau barisnya belum ada
      const { data, error } = await sb.from('profiles').update(values).eq('id', uid).select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        const { error: insertError } = await sb.from('profiles').insert({ id: uid, ...values })
        if (insertError) throw insertError
      }
    },

    async upsertTransaction(row) {
      const { error } = await client().from('transactions').upsert(toRow(row))
      if (error) throw error
    },

    async upsertTransactions(rows) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await client().from('transactions').upsert(rows.slice(i, i + 500).map(toRow))
        if (error) throw error
      }
    },
  }
}

export const supabaseStore = createSupabaseStore(getSupabase)
