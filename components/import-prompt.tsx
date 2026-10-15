'use client'

import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LocalData } from '@/lib/data-store'

type Props = { data: LocalData; onImport: () => Promise<boolean>; onSkip: () => void }

export default function ImportPrompt({ data, onImport, onSkip }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const count = data.transactions.length

  async function run() {
    setBusy(true)
    setError('')
    const ok = await onImport()
    if (!ok) { setError('Gagal memindahkan data. Periksa koneksi lalu coba lagi.'); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-background p-6">
      <div className="mb-8 grid size-16 place-items-center rounded-3xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/30"><Wallet className="size-8" /></div>
      <div className="w-full max-w-sm">
        <h2 className="mb-1 text-xl font-semibold">Data lama ditemukan 📦</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Di perangkat ini ada {count} transaksi{data.profile.name ? ` atas nama ${data.profile.name}` : ''}. Pindahkan ke akunmu supaya aman dan bisa dibuka di perangkat lain?
        </p>
        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
        <Button disabled={busy} onClick={run} className="h-12 w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
          {busy ? 'Memindahkan...' : 'Pindahkan ke akunku'}
        </Button>
        <Button variant="outline" disabled={busy} onClick={onSkip} className="mt-2 h-12 w-full rounded-xl">Mulai dari nol</Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">Data di perangkat ini tidak dihapus. Kalau kamu memilih mulai dari nol, tawaran ini tidak muncul lagi.</p>
      </div>
    </div>
  )
}
