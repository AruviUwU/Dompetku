'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CATEGORY_COLORS, formatDate, formatIDR, monthKey, monthLabel, todayISO, type Transaction } from '@/lib/transactions'

const sum = (list: Transaction[]) => list.reduce((s, t) => s + t.amount, 0)

function build(all: Transaction[], key: string) {
  const [y, m] = key.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  const items = all.filter(t => monthKey(t.date) === key)
  const expenses = items.filter(t => t.type === 'expense')
  const cats = new Map<string, number>()
  for (const t of expenses) cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount)
  return {
    days,
    count: items.length,
    income: sum(items.filter(t => t.type === 'income')),
    expense: sum(expenses),
    perDay: Array.from({ length: days }, (_, i) => sum(expenses.filter(t => Number(t.date.slice(8, 10)) === i + 1))),
    cats: Array.from(cats.entries()).sort((a, b) => b[1] - a[1]),
    top: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    prevExpense: sum(all.filter(t => t.type === 'expense' && monthKey(t.date) === prevKey)),
    elapsed: key === monthKey(todayISO()) ? new Date().getDate() : days,
  }
}

export default function ReportView({ transactions, monthlyBudget }: { transactions: Transaction[]; monthlyBudget: number }) {
  const months = useMemo(() => Array.from(new Set(transactions.map(t => monthKey(t.date)))).sort().reverse(), [transactions])
  const [picked, setPicked] = useState<string | null>(null)
  const key = picked && months.includes(picked) ? picked : months[0]
  const r = useMemo(() => (key ? build(transactions, key) : null), [transactions, key])

  if (!key || !r) {
    return <section className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">Belum ada data untuk dibuat laporan.</section>
  }

  const idx = months.indexOf(key)
  const older = months[idx + 1]
  const newer = months[idx - 1]
  const net = r.income - r.expense
  const delta = r.prevExpense > 0 ? ((r.expense - r.prevExpense) / r.prevExpense) * 100 : null
  const maxDay = Math.max(...r.perDay, 1)
  const budgetPct = monthlyBudget > 0 ? (r.expense / monthlyBudget) * 100 : 0
  const [, mm] = key.split('-')

  return (
    <div className="flex flex-col gap-5">
      {/* Pemilih bulan */}
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-3 py-2">
        <button aria-label="Bulan sebelumnya" disabled={!older} onClick={() => setPicked(older)} className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:opacity-30"><ChevronLeft className="size-5" /></button>
        <div className="text-center">
          <h2 className="font-semibold">{monthLabel(key)}</h2>
          <p className="text-xs text-muted-foreground">{r.count} transaksi</p>
        </div>
        <button aria-label="Bulan berikutnya" disabled={!newer} onClick={() => setPicked(newer)} className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:opacity-30"><ChevronRight className="size-5" /></button>
      </div>

      {/* Ringkasan */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-sm text-muted-foreground">Pemasukan</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-400">{formatIDR(r.income)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-sm text-muted-foreground">Pengeluaran</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{formatIDR(r.expense)}</p>
          {delta !== null && (
            <p className={`mt-2 text-xs ${delta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}% dibanding bulan lalu
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-emerald-400 p-5 text-slate-950">
          <p className="text-sm font-medium">Selisih bulan ini</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{net < 0 ? '-' : ''}{formatIDR(Math.abs(net))}</p>
          <p className="mt-2 text-xs text-slate-950/65">Rata-rata keluar {formatIDR(Math.round(r.expense / r.elapsed))}/hari</p>
        </div>
      </div>

      {/* Budget */}
      {monthlyBudget > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-semibold">Budget bulanan</span>
            <span className={budgetPct >= 80 ? 'text-rose-400' : 'text-emerald-400'}>{Math.round(budgetPct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${budgetPct >= 80 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatIDR(r.expense)} dari {formatIDR(monthlyBudget)} ·{' '}
            {r.expense > monthlyBudget ? `lebih ${formatIDR(r.expense - monthlyBudget)}` : `sisa ${formatIDR(monthlyBudget - r.expense)}`}
          </p>
        </div>
      )}

      {/* Pengeluaran harian */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-semibold">Pengeluaran harian</h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">Total keluar per tanggal</p>
        <div className="flex h-40 items-end gap-0.5 border-b border-border/60">
          {r.perDay.map((v, i) => (
            <div key={i} title={`${i + 1}/${mm}: ${formatIDR(v)}`} className="flex h-full flex-1 flex-col justify-end">
              <div className="w-full rounded-t-sm bg-emerald-400/80 transition hover:bg-emerald-300" style={{ height: `${(v / maxDay) * 100}%`, minHeight: v ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-0.5">
          {r.perDay.map((_, i) => (
            <span key={i} className="flex-1 whitespace-nowrap text-center text-[9px] text-muted-foreground">{i === 0 || (i + 1) % 5 === 0 ? i + 1 : ''}</span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Per kategori */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold">Per kategori</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Dari total pengeluaran</p>
          {r.cats.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengeluaran.</p>}
          <div className="flex flex-col gap-5">
            {r.cats.map(([cat, amount]) => {
              const pct = Math.round((amount / r.expense) * 100)
              return (
                <div key={cat}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{cat}</span>
                    <span className="text-muted-foreground">{formatIDR(amount)} · {pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${CATEGORY_COLORS[cat] ?? 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Terbesar */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold">Pengeluaran terbesar</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">5 teratas bulan ini</p>
          {r.top.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengeluaran.</p>}
          {r.top.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 border-t border-border/50 py-3 first:border-t-0">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.category} · {formatDate(t.date)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatIDR(t.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
