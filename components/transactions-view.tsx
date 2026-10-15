'use client'

import { useMemo, useState } from 'react'
import { Pencil, Search, Trash2 } from 'lucide-react'
import { CATEGORIES, formatDate, formatIDR, initial, type Transaction } from '@/lib/transactions'

type Props = {
  transactions: Transaction[]
  onEdit: (t: Transaction) => void
  onDelete: (id: string) => void
}

const TYPE_CHIPS = [['all', 'Semua'], ['expense', 'Pengeluaran'], ['income', 'Pemasukan']] as const

export default function TransactionsView({ transactions, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | Transaction['type']>('all')
  const [category, setCategory] = useState('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const categories = useMemo(
    () => Array.from(new Set(['Pemasukan', ...CATEGORIES, ...transactions.map(t => t.category)])),
    [transactions],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions
      .filter(t =>
        (type === 'all' || t.type === type) &&
        (category === 'all' || t.category === category) &&
        (!q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [transactions, search, type, category])

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return Array.from(map.entries())
  }, [filtered])

  const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-5">
        <h2 className="font-semibold">Semua transaksi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} transaksi · masuk {formatIDR(income)} · keluar {formatIDR(expense)}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Cari transaksi"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau kategori..."
            className="h-10 w-full rounded-xl border border-border/60 bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>
        <select
          aria-label="Filter kategori"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
        >
          <option value="all">Semua kategori</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="mb-2 flex gap-2">
        {TYPE_CHIPS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setType(value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              type === value
                ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                : 'border-border text-muted-foreground hover:border-emerald-400/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {transactions.length === 0 ? 'Belum ada transaksi.' : 'Tidak ada transaksi yang cocok dengan filter.'}
        </p>
      )}

      {groups.map(([date, items]) => (
        <div key={date}>
          <p className="mb-1 mt-5 text-xs font-medium text-muted-foreground">{formatDate(date)}</p>
          {items.map(t => (
            <div key={t.id} className="flex items-center gap-3 border-t border-border/50 py-3 first:border-t-0">
              <div className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ${t.type === 'income' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{initial(t.name)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.category}</p>
              </div>
              <p className={`shrink-0 text-sm font-semibold ${t.type === 'income' ? 'text-emerald-400' : ''}`}>
                {t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}
              </p>
              {confirmId === t.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => { onDelete(t.id); setConfirmId(null) }} className="rounded-lg bg-rose-400/15 px-2.5 py-1.5 text-xs font-medium text-rose-300">Hapus</button>
                  <button onClick={() => setConfirmId(null)} className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground">Batal</button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center">
                  <button aria-label={`Edit ${t.name}`} onClick={() => onEdit(t)} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"><Pencil className="size-4" /></button>
                  <button aria-label={`Hapus ${t.name}`} onClick={() => setConfirmId(t.id)} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-rose-400/10 hover:text-rose-400"><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
