'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BarChart2, CalendarDays, Camera, ChevronDown, CreditCard, Home, ImagePlus, LogOut, Moon, Plus, Search, Sun, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TransactionsView from '@/components/transactions-view'
import ReportView from '@/components/report-view'
import AuthScreen from '@/components/auth-screen'
import ImportPrompt from '@/components/import-prompt'
import { useAuth } from '@/lib/use-auth'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { readLocalData } from '@/lib/data-store'
import { useDompetku } from '@/lib/use-dompetku'
import { CATEGORIES, CATEGORY_COLORS, formatDate, formatIDR, initial, monthKey, monthLabel, normalizeDate, todayISO, type Transaction } from '@/lib/transactions'


const blankForm = () => ({ name: '', amount: '', type: 'expense' as Transaction['type'], category: 'Belanja', date: todayISO() })

// ── Onboarding ──────────────────────────────────────────────────────────────
function OnboardingScreen({ onComplete }: { onComplete: (name: string, balance: number, budget: number) => void }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [budget, setBudget] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [step])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6">
      {/* Branding */}
      <div className="mb-10 flex flex-col items-center gap-4">
        <div className="grid size-20 place-items-center rounded-3xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/30">
          <Wallet className="size-9" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Dompetku</h1>
          <p className="mt-1 text-muted-foreground text-sm">Kelola keuanganmu dengan lebih tenang.</p>
        </div>
      </div>

      {/* Step dots */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map(n => (
          <div key={n} className={`h-2 rounded-full transition-all duration-300 ${step === n ? 'w-8 bg-emerald-400' : step > n ? 'w-2 bg-emerald-400/40' : 'w-2 bg-muted'}`} />
        ))}
      </div>

      <div className="w-full max-w-sm">
        {step === 1 && (
          <div key="step1">
            <h2 className="mb-1 text-xl font-semibold">Halo! Siapa namamu? 👋</h2>
            <p className="mb-6 text-sm text-muted-foreground">Kami akan menyapa kamu dengan nama ini setiap hari.</p>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
              className="mb-4 h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-emerald-400/40"
              placeholder="Nama kamu..."
            />
            <Button
              disabled={!name.trim()}
              onClick={() => setStep(2)}
              className="h-12 w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-40"
            >
              Lanjut →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div key="step-balance">
            <h2 className="mb-1 text-xl font-semibold">Berapa uangmu sekarang? 👛</h2>
            <p className="mb-6 text-sm text-muted-foreground">Total tunai, rekening, dan e-wallet. Boleh perkiraan, bisa kamu sesuaikan nanti.</p>
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <input
                ref={inputRef}
                type="number"
                min="0"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && balance !== '' && setStep(3)}
                className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-base outline-none focus:ring-2 focus:ring-emerald-400/40"
                placeholder="2.000.000"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="h-12 flex-1 rounded-xl">← Kembali</Button>
              <Button disabled={balance === ''} onClick={() => setStep(3)} className="h-12 flex-1 rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-40">Lanjut →</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div key="step-budget">
            <h2 className="mb-1 text-xl font-semibold">Budget bulananmu, {name}? 💰</h2>
            <p className="mb-6 text-sm text-muted-foreground">Kami bantu pantau pengeluaranmu supaya tidak melebihi batas.</p>
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
              <input
                ref={inputRef}
                type="number"
                min="0"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && budget && onComplete(name, Number(balance || 0), Number(budget))}
                className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-base outline-none focus:ring-2 focus:ring-emerald-400/40"
                placeholder="5.000.000"
              />
            </div>
            {/* Quick-pick chips */}
            <div className="mb-5 flex gap-2">
              {[3_000_000, 5_000_000, 10_000_000].map(v => (
                <button
                  key={v}
                  onClick={() => setBudget(String(v))}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition ${
                    budget === String(v)
                      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                      : 'border-border text-muted-foreground hover:border-emerald-400/40'
                  }`}
                >
                  {formatIDR(v)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="h-12 flex-1 rounded-xl">← Kembali</Button>
              <Button
                disabled={!budget}
                onClick={() => onComplete(name, Number(balance || 0), Number(budget))}
                className="h-12 flex-1 rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-40"
              >
                Mulai! 🎉
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
function Dompetku({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const [dark, setDark] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(blankForm)
  const [showScanner, setShowScanner] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [scanStep, setScanStep] = useState<'upload' | 'scanning' | 'result'>('upload')
  const [scanForm, setScanForm] = useState({ name: '', date: todayISO(), amount: '', category: 'Belanja', note: '' })
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState<'home' | 'transaksi' | 'laporan'>('home')

  // Semua data user lewat satu hook (nanti disambungkan ke database)
  const { ready, loadFailed, refresh, profile, transactions, saveProfile, addTransaction, updateTransaction, removeTransaction, importData } = useDompetku({ onError: setNotice })
  const { name: userName, monthlyBudget, initialBalance } = profile

  // Tawarkan pemindahan data lama dari perangkat ini, hanya untuk akun yang masih kosong
  const importKey = `dompetku-import-done:${userId}`
  const [offerDismissed, setOfferDismissed] = useState(false)
  const offer = useMemo(() => {
    if (!ready || transactions.length > 0 || profile.onboardingDone) return null
    if (window.localStorage.getItem(importKey)) return null
    return readLocalData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustValue, setAdjustValue] = useState('')

  // Tema disimpan per perangkat, bukan di akun
  const [themeReady, setThemeReady] = useState(false)
  useEffect(() => {
    const savedTheme = window.localStorage.getItem('finansial-theme')
    if (savedTheme) setDark(savedTheme === 'dark')
    setThemeReady(true)
  }, [])
  useEffect(() => {
    if (themeReady) window.localStorage.setItem('finansial-theme', dark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', dark)
  }, [dark, themeReady])

  const thisMonth = monthKey(todayISO())
  const monthTx   = useMemo(() => transactions.filter(t => monthKey(t.date) === thisMonth), [transactions, thisMonth])
  const income    = useMemo(() => monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthTx])
  const expense   = useMemo(() => monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthTx])
  const txNet     = useMemo(() => transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0), [transactions])
  const balance   = initialBalance + txNet

  // Arus kas per minggu (1–7, 8–14, 15–21, 22–28, sisa) dan pengeluaran per kategori, khusus bulan ini
  const weeks = useMemo(() => {
    const [y, m] = thisMonth.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const ranges: number[][] = [[1, 7], [8, 14], [15, 21], [22, 28]]
    if (days > 28) ranges.push([29, days])
    return ranges.map(([from, to]) => {
      const inRange = monthTx.filter(t => { const d = Number(t.date.slice(8, 10)); return d >= from && d <= to })
      return {
        label: from === to ? String(from) : `${from}–${to}`,
        income: inRange.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: inRange.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      }
    })
  }, [monthTx, thisMonth])
  const weekMax = Math.max(1, ...weeks.flatMap(w => [w.income, w.expense]))
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTx) if (t.type === 'expense') map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [monthTx])
  const recent = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5), [transactions])

  const budgetPercent = monthlyBudget > 0 ? Math.min((expense / monthlyBudget) * 100, 100) : 0
  const budgetWarning = monthlyBudget > 0 && expense >= monthlyBudget * 0.8

  function handleOnboardingComplete(name: string, startBalance: number, budget: number) {
    saveProfile({ onboardingDone: true, name, initialBalance: startBalance, monthlyBudget: budget })
  }

  function selectReceipt(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setNotice('File harus berupa gambar.'); return }
    if (file.size > 10 * 1024 * 1024) { setNotice('Ukuran foto maksimal 10 MB.'); return }
    setNotice('')
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
    setScanStep('upload')
  }

  const continueScan = async () => {
    if (!receiptFile) return
    setIsScanning(true)
    setScanStep('scanning')
    try {
      const fd = new FormData()
      fd.append('file', receiptFile)
      const { data: sessionData } = await getSupabase()!.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw Object.assign(new Error('Sesi berakhir. Masuk lagi.'), { status: 401 })
      const res  = await fetch('/api/scan-receipt', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw Object.assign(new Error(data.error || 'Gagal membaca struk'), { status: res.status })
      setScanForm({
        name: data.merchant || '',
        date: data.date ? normalizeDate(data.date) : todayISO(),
        amount: data.total ? String(data.total) : '',
        category: data.category || 'Belanja',
        note: data.description || '',
      })
      setScanStep('result')
    } catch (error) {
      console.error(error)
      setScanStep('upload')
      const status = (error as { status?: number }).status
      // Pesan dari server ditampilkan untuk masalah login, batas pemakaian, atau file; sisanya pesan umum
      setNotice(status && status < 500 && error instanceof Error ? error.message : 'Gagal membaca struk. Coba foto yang lebih jelas.')
    } finally {
      setIsScanning(false)
    }
  }

  function saveScannedTransaction(event: React.FormEvent) {
    event.preventDefault()
    if (!scanForm.name || !scanForm.amount) return
    addTransaction({ name: scanForm.name, category: scanForm.category, date: scanForm.date, amount: Number(scanForm.amount), type: 'expense' })
    setShowScanner(false); setReceiptFile(null); setReceiptPreview(''); setScanStep('upload')
    setNotice('✓ Transaksi dari struk berhasil disimpan!')
  }

  function openAdd() { setEditingId(null); setForm(blankForm()); setShowForm(true) }
  function openEdit(t: Transaction) {
    setEditingId(t.id)
    setForm({ name: t.name, amount: String(t.amount), type: t.type, category: t.category, date: t.date })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditingId(null) }
  function deleteTransaction(id: string) {
    removeTransaction(id)
    setNotice('Transaksi dihapus.')
  }
  function saveTransaction(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    if (!name || !form.amount) return
    const data = { name, category: form.category, date: form.date || todayISO(), amount: Number(form.amount), type: form.type }
    if (editingId !== null) {
      updateTransaction(editingId, data)
      setNotice('✓ Transaksi diperbarui.')
    } else {
      addTransaction(data)
    }
    closeForm()
  }

  function openAdjust() { setAdjustValue(String(balance)); setShowAdjust(true) }
  function saveAdjust(event: React.FormEvent) {
    event.preventDefault()
    if (adjustValue === '') return
    saveProfile({ initialBalance: Number(adjustValue) - txNet }) // koreksi dicatat di saldo awal, bukan sebagai transaksi
    setShowAdjust(false)
    setNotice('✓ Saldo disesuaikan.')
  }

  function closeScannerModal() { setShowScanner(false); setScanStep('upload') }

  // Show onboarding if not done
  if (loadFailed) return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
      <div>
        <p className="mb-1 font-medium">Gagal memuat datamu</p>
        <p className="mb-5 text-sm text-muted-foreground">Periksa koneksi internet, lalu coba lagi.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => refresh()} className="rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">Coba lagi</Button>
          <Button variant="outline" onClick={onSignOut} className="rounded-xl">Keluar</Button>
        </div>
      </div>
    </main>
  )
  if (!ready) return <main className="min-h-screen bg-background" />
  if (offer && !offerDismissed) return (
    <ImportPrompt
      data={offer}
      onSkip={() => { window.localStorage.setItem(importKey, 'skipped'); setOfferDismissed(true) }}
      onImport={async () => {
        const ok = await importData(offer)
        if (ok) {
          window.localStorage.setItem(importKey, 'imported')
          setOfferDismissed(true)
          setNotice(`✓ ${offer.transactions.length} transaksi dipindahkan ke akunmu.`)
        }
        return ok
      }}
    />
  )
  if (!profile.onboardingDone) return <OnboardingScreen onComplete={handleOnboardingComplete} />

  const SCAN_STEPS = [
    { key: 'upload',   label: 'Foto' },
    { key: 'scanning', label: 'AI Baca' },
    { key: 'result',   label: 'Hasil' },
  ] as const

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground lg:pb-0">
      <div className="mx-auto flex max-w-[1440px]">

        {/* ── Desktop Sidebar ── */}
        <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-card/40 p-6 lg:flex">
          <div className="mb-12 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-400 text-slate-950"><Wallet className="size-5" /></div>
            <span className="text-lg font-semibold tracking-tight">Dompetku</span>
          </div>
          <nav className="flex flex-col gap-2">
            {([['home', 'Ringkasan', Wallet], ['transaksi', 'Transaksi', CreditCard], ['laporan', 'Laporan', BarChart2]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${activeTab === key ? 'bg-emerald-400/10 font-medium text-emerald-300' : 'text-muted-foreground hover:bg-muted'}`}><Icon className="size-4" />{label}</button>
            ))}
          </nav>

          {/* User card */}
          {userName && (
            <div className="mt-6 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Masuk sebagai</p>
              <p className="mt-0.5 font-medium">{userName} 👋</p>
            </div>
          )}

          {/* Budget progress */}
          {monthlyBudget > 0 && (
            <div className="mt-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Budget bulan ini</p>
                <span className={`text-xs font-semibold ${budgetWarning ? 'text-rose-400' : 'text-emerald-400'}`}>{Math.round(budgetPercent)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${budgetWarning ? 'bg-rose-400' : 'bg-emerald-400'}`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{formatIDR(expense)} / {formatIDR(monthlyBudget)}</p>
            </div>
          )}

          <div className="mt-auto pt-10"><p className="px-4 text-xs leading-5 text-muted-foreground">Kelola keuanganmu dengan lebih tenang.</p></div>
        </aside>

        {/* ── Main Content ── */}
        <section className="min-w-0 flex-1 px-5 py-5 sm:px-8 lg:px-12 lg:py-9">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Selamat datang kembali,</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {userName ? `${userName} 👋` : 'Ringkasan keuangan'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button aria-label="Ubah tema" className="grid size-10 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground transition hover:text-foreground" onClick={() => setDark(!dark)}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <button aria-label="Keluar" title="Keluar" className="grid size-10 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground transition hover:text-foreground" onClick={onSignOut}>
                <LogOut className="size-4" />
              </button>
              <div className="hidden items-center gap-2 sm:flex">
                <Button variant="outline" onClick={() => setShowScanner(true)} className="rounded-xl border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10"><Camera data-icon="inline-start" />Scan Struk</Button>
                <Button onClick={openAdd} className="rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300"><Plus data-icon="inline-start" />Tambah transaksi</Button>
              </div>
            </div>
          </header>

          {activeTab === 'home' && (<>
          {/* Budget warning banner */}
          {budgetWarning && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3">
              <span className="shrink-0 text-xl">⚠️</span>
              <div>
                <p className="text-sm font-medium text-rose-300">{expense >= monthlyBudget ? 'Budget bulan ini terlampaui!' : 'Pengeluaran mendekati batas budget!'}</p>
                <p className="mt-0.5 text-xs text-rose-300/70">
                  Sudah {Math.round((expense / monthlyBudget) * 100)}% dari {formatIDR(monthlyBudget)} — {expense > monthlyBudget ? `lebih ${formatIDR(expense - monthlyBudget)}` : `sisa ${formatIDR(monthlyBudget - expense)}`}
                </p>
              </div>
            </div>
          )}

          {/* Mobile quick actions (shown above cards, hidden on desktop) */}
          <div className="mb-5 grid gap-2 sm:hidden">
            <Button variant="outline" onClick={() => setShowScanner(true)} className="w-full rounded-xl border-emerald-400/40 text-emerald-300"><Camera data-icon="inline-start" />Scan Struk</Button>
            <Button onClick={openAdd} className="w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300"><Plus data-icon="inline-start" />Tambah transaksi</Button>
          </div>

          {/* Summary cards */}
          <div id="ringkasan" className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-emerald-400 p-5 text-slate-950"><div className="mb-8 flex items-center justify-between"><span className="text-sm font-medium">Saldo saat ini</span><Wallet className="size-5" /></div><p className="text-3xl font-semibold tracking-tight">{formatIDR(balance)}</p><p className="mt-2 text-sm text-slate-950/65">Bulan ini {income - expense < 0 ? '-' : '+'}{formatIDR(Math.abs(income - expense))}</p><button onClick={openAdjust} className="mt-3 text-xs font-medium text-slate-950/70 underline underline-offset-2 hover:text-slate-950">Sesuaikan saldo</button></div>
            <div className="rounded-2xl border border-border/60 bg-card p-5"><div className="mb-8 flex items-center justify-between"><span className="text-sm text-muted-foreground">Total pemasukan</span><span className="grid size-8 place-items-center rounded-lg bg-emerald-400/10 text-emerald-400"><ArrowDownLeft className="size-4" /></span></div><p className="text-2xl font-semibold tracking-tight">{formatIDR(income)}</p><p className="mt-2 text-sm text-emerald-400">Bulan ini</p></div>
            <div className="rounded-2xl border border-border/60 bg-card p-5"><div className="mb-8 flex items-center justify-between"><span className="text-sm text-muted-foreground">Total pengeluaran</span><span className="grid size-8 place-items-center rounded-lg bg-rose-400/10 text-rose-400"><ArrowUpRight className="size-4" /></span></div><p className="text-2xl font-semibold tracking-tight">{formatIDR(expense)}</p><p className="mt-2 text-sm text-rose-400">Bulan ini</p></div>
          </div>

          {/* Charts (data bulan ini) */}
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="mb-6 flex items-center justify-between">
                <div><h2 className="font-semibold">Arus kas</h2><p className="mt-1 text-sm text-muted-foreground">Pemasukan dan pengeluaran per minggu</p></div>
                <span className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">{monthLabel(thisMonth)}</span>
              </div>
              {monthTx.length === 0 ? (
                <div className="grid h-52 place-items-center border-b border-border/60 text-sm text-muted-foreground">Belum ada transaksi bulan ini.</div>
              ) : (
                <div className="flex h-52 items-end gap-3 border-b border-border/60 sm:gap-6">
                  {weeks.map(w => (
                    <div key={w.label} className="flex h-full flex-1 flex-col items-center gap-2">
                      <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-1">
                        <div title={`Pemasukan ${formatIDR(w.income)}`} className="w-full max-w-6 rounded-t-md bg-emerald-400/80" style={{ height: `${(w.income / weekMax) * 100}%`, minHeight: w.income ? 3 : 0 }} />
                        <div title={`Pengeluaran ${formatIDR(w.expense)}`} className="w-full max-w-6 rounded-t-md bg-rose-400/80" style={{ height: `${(w.expense / weekMax) * 100}%`, minHeight: w.expense ? 3 : 0 }} />
                      </div>
                      <span className="pb-2 text-[10px] text-muted-foreground">{w.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5 flex gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-emerald-400" />Pemasukan</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-rose-400" />Pengeluaran</span></div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">Pengeluaran</h2><p className="mt-1 text-sm text-muted-foreground">Berdasarkan kategori bulan ini</p></div><CalendarDays className="size-4 text-muted-foreground" /></div>
              {expenseByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pengeluaran bulan ini.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {expenseByCategory.map(([cat, amount]) => {
                    const pct = Math.round((amount / expense) * 100)
                    return (
                      <div key={cat}>
                        <div className="mb-2 flex justify-between text-sm"><span>{cat}</span><span className="text-muted-foreground">{formatIDR(amount)} · {pct}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${CATEGORY_COLORS[cat] ?? 'bg-slate-400'}`} style={{ width: `${pct}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Transactions list */}
          <section id="transaksi" className="mt-5 rounded-2xl border border-border/60 bg-card p-5">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-semibold">Transaksi terbaru</h2><p className="mt-1 text-sm text-muted-foreground">Catatan transaksi manual kamu</p></div>
              <button onClick={() => setActiveTab('transaksi')} className="text-sm text-emerald-400 hover:text-emerald-300">Lihat semua →</button>
            </div>
            <div className="flex flex-col">
              {recent.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada transaksi. Tekan Tambah atau Scan Struk untuk mulai.</p>}
              {recent.map(t => (
                <div key={t.id} className="flex items-center gap-3 border-t border-border/50 py-4 first:border-t-0">
                  <div className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ${t.type === 'income' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{initial(t.name)}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.name}</p><p className="mt-1 text-xs text-muted-foreground">{t.category} · {formatDate(t.date)}</p></div>
                  <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-400' : 'text-foreground'}`}>{t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}</p>
                </div>
              ))}
            </div>
          </section>
          </>)}

          {activeTab === 'transaksi' && <TransactionsView transactions={transactions} onEdit={openEdit} onDelete={deleteTransaction} />}
          {activeTab === 'laporan' && <ReportView transactions={transactions} monthlyBudget={monthlyBudget} />}
        </section>
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav aria-label="Navigasi utama" className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur-md lg:hidden">
        <div className="flex items-end justify-around px-2 pb-2 pt-2">
          <button id="nav-home" onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition ${activeTab === 'home' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
            <Home className="size-5" />
            <span className="text-[10px]">Beranda</span>
          </button>
          <button id="nav-transaksi" onClick={() => setActiveTab('transaksi')} className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition ${activeTab === 'transaksi' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
            <CreditCard className="size-5" />
            <span className="text-[10px]">Transaksi</span>
          </button>
          {/* Center FAB */}
          <div className="relative -top-5">
            <button id="nav-scan" onClick={() => setShowScanner(true)} className="grid size-14 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/25 transition active:scale-95 hover:bg-emerald-300">
              <Camera className="size-6" />
            </button>
            <span className="mt-1 block text-center text-[10px] text-muted-foreground">Scan</span>
          </div>
          <button id="nav-tambah" onClick={openAdd} className="flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-muted-foreground transition hover:text-foreground">
            <Plus className="size-5" />
            <span className="text-[10px]">Tambah</span>
          </button>
          <button id="nav-laporan" onClick={() => setActiveTab('laporan')} className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition ${activeTab === 'laporan' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
            <BarChart2 className="size-5" />
            <span className="text-[10px]">Laporan</span>
          </button>
        </div>
      </nav>

      {/* ── Add Transaction Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-5">
          <form onSubmit={saveTransaction} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-semibold">{editingId !== null ? 'Edit transaksi' : 'Tambah transaksi'}</h2><p className="mt-1 text-sm text-muted-foreground">{editingId !== null ? 'Ubah catatan keuangan' : 'Simpan catatan keuangan baru'}</p></div><button type="button" aria-label="Tutup" onClick={closeForm}><X className="size-5 text-muted-foreground" /></button></div>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm">Nama transaksi<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-emerald-400/40" placeholder="Contoh: Makan malam" /></label>
              <label className="flex flex-col gap-2 text-sm">Jumlah (IDR)<input required type="number" min="1" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-emerald-400/40" placeholder="150000" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2 text-sm">Jenis<select value={form.type} onChange={e => { const type = e.target.value as Transaction['type']; setForm({ ...form, type, category: type === 'income' ? 'Pemasukan' : form.category === 'Pemasukan' ? 'Belanja' : form.category }) }} className="h-11 rounded-xl border border-border bg-background px-3"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
                <label className="flex flex-col gap-2 text-sm">Kategori<select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3">{(form.type === 'income' ? ['Pemasukan'] : CATEGORIES).map(c => <option key={c}>{c}</option>)}</select></label>
              </div>
              <label className="flex flex-col gap-2 text-sm">Tanggal<input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-emerald-400/40" /></label>
              <Button type="submit" className="mt-2 h-11 rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">{editingId !== null ? 'Simpan perubahan' : 'Simpan transaksi'}</Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Adjust Balance Modal ── */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-5" onClick={() => setShowAdjust(false)}>
          <form onSubmit={saveAdjust} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Sesuaikan saldo</h2>
                <p className="mt-1 text-sm text-muted-foreground">Samakan saldo di app dengan uang kamu yang sebenarnya.</p>
              </div>
              <button type="button" aria-label="Tutup" onClick={() => setShowAdjust(false)}><X className="size-5 text-muted-foreground" /></button>
            </div>
            <label className="flex flex-col gap-2 text-sm">Saldo sebenarnya sekarang
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <input autoFocus required type="number" value={adjustValue} onChange={e => setAdjustValue(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 outline-none focus:ring-2 focus:ring-emerald-400/40" />
              </div>
            </label>
            <p className="mt-3 text-xs text-muted-foreground">
              Saldo di app saat ini {formatIDR(balance)}.
              {adjustValue !== '' && Number(adjustValue) !== balance && ` Selisih ${Number(adjustValue) - balance > 0 ? '+' : '-'}${formatIDR(Math.abs(Number(adjustValue) - balance))}.`}
              {' '}Penyesuaian tidak dihitung sebagai pemasukan atau pengeluaran di laporan.
            </p>
            <Button type="submit" className="mt-5 h-11 w-full rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">Simpan saldo</Button>
          </form>
        </div>
      )}

      {/* ── Toast Notice ── */}
      {notice && (
        <div role="status" className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-xl border border-emerald-400/30 bg-card px-4 py-3 text-sm shadow-xl lg:bottom-6">
          {notice}
          <button className="ml-3 text-muted-foreground" onClick={() => setNotice('')} aria-label="Tutup notifikasi"><X className="inline size-4" /></button>
        </div>
      )}

      {/* ── Scan Receipt Modal ── */}
      {showScanner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" onClick={closeScannerModal}>
          <div role="dialog" aria-modal="true" aria-labelledby="scan-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-emerald-400">AI Receipt Scanner</p>
                <h2 id="scan-title" className="text-lg font-semibold">Scan Struk</h2>
              </div>
              <button type="button" aria-label="Tutup scan struk" onClick={closeScannerModal}><X className="size-5 text-muted-foreground" /></button>
            </div>

            {/* Step indicator */}
            <div className="mb-6 flex items-center gap-1">
              {SCAN_STEPS.map((s, i) => {
                const stepIndex  = SCAN_STEPS.findIndex(x => x.key === scanStep)
                const isDone     = i < stepIndex
                const isCurrent  = i === stepIndex
                return (
                  <div key={s.key} className="flex items-center gap-1">
                    <div className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                      isCurrent ? 'bg-emerald-400 text-slate-950 scale-110' :
                      isDone    ? 'bg-emerald-400/30 text-emerald-400' :
                                  'bg-muted text-muted-foreground'
                    }`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs transition-colors ${isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                    {i < SCAN_STEPS.length - 1 && <div className={`mx-1 h-px w-8 transition-all ${isDone ? 'bg-emerald-400/40' : 'bg-muted'}`} />}
                  </div>
                )
              })}
            </div>

            {/* Step: Upload */}
            {scanStep === 'upload' && (
              <div className="flex flex-col gap-4">
                <label htmlFor="receipt-input" className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-400/40 bg-emerald-400/5 p-5 text-center transition hover:bg-emerald-400/10">
                  {receiptPreview
                    ? <img src={receiptPreview} alt="Pratinjau foto struk" className="max-h-64 rounded-xl object-contain" />
                    : <><ImagePlus className="mb-3 size-9 text-emerald-400" /><span className="font-medium">Tarik foto struk ke sini</span><span className="mt-1 text-sm text-muted-foreground">JPG, JPEG, PNG, atau WEBP · maks 10 MB</span></>
                  }
                  <input id="receipt-input" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => selectReceipt(e.target.files?.[0])} />
                </label>
                {receiptFile && (
                  <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{receiptFile.name}</span>
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setReceiptFile(null); setReceiptPreview('') }}>Hapus</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => document.getElementById('receipt-input')?.click()}>Pilih Foto</Button>
                  <Button type="button" disabled={!receiptFile} className="flex-1 rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={continueScan}>
                    Analisis dengan AI →
                  </Button>
                </div>
              </div>
            )}

            {/* Step: AI scanning animation */}
            {scanStep === 'scanning' && (
              <div className="flex flex-col items-center gap-6 py-8">
                {receiptPreview && (
                  <div className="relative">
                    <img src={receiptPreview} alt="Struk diproses" className="max-h-36 rounded-xl object-contain opacity-50 blur-[2px]" />
                    {/* Scan line animation */}
                    <div className="absolute inset-0 overflow-hidden rounded-xl">
                      <div className="animate-scan-line absolute left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="relative flex size-16 items-center justify-center rounded-2xl bg-emerald-400/10">
                    <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-400/20" />
                    <div className="absolute inset-0 animate-pulse rounded-2xl bg-emerald-400/10" style={{ animationDelay: '0.5s' }} />
                    <span className="relative text-2xl">🤖</span>
                  </div>
                  <p className="font-medium">AI sedang membaca struk...</p>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="size-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="max-w-xs text-sm text-muted-foreground">Mengekstrak nama toko, tanggal, dan total pembayaran dari foto kamu...</p>
                </div>
              </div>
            )}

            {/* Step: Result form */}
            {scanStep === 'result' && (
              <form onSubmit={saveScannedTransaction} className="flex flex-col gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                  <span>✅</span>
                  <span>AI berhasil membaca struk! Periksa dan lengkapi data sebelum menyimpan.</span>
                </div>
                <label className="flex flex-col gap-2 text-sm">Nama toko<input required value={scanForm.name} onChange={e => setScanForm({...scanForm, name: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-emerald-400/40" placeholder="Contoh: Kopi Senja" /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">Tanggal<input required type="date" value={scanForm.date} onChange={e => setScanForm({...scanForm, date: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-emerald-400/40" /></label>
                  <label className="flex flex-col gap-2 text-sm">Total pembayaran<input required min="1" type="number" value={scanForm.amount} onChange={e => setScanForm({...scanForm, amount: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-emerald-400/40" placeholder="150000" /></label>
                </div>
                <label className="flex flex-col gap-2 text-sm">Kategori
                  <select value={scanForm.category} onChange={e => setScanForm({...scanForm, category: e.target.value})} className="h-11 rounded-xl border border-border bg-background px-3">
                    <option>Belanja</option><option>Makanan</option><option>Tagihan</option><option>Transportasi</option><option>Lainnya</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">Catatan<textarea value={scanForm.note} onChange={e => setScanForm({...scanForm, note: e.target.value})} className="min-h-20 rounded-xl border border-border bg-background p-3 outline-none focus:ring-2 focus:ring-emerald-400/40" placeholder="Tambahkan catatan (opsional)" /></label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setScanStep('upload')}>← Ganti Foto</Button>
                  <Button type="submit" className="flex-1 rounded-xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">Simpan transaksi</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

// ── Gerbang login: tanpa akun, app tidak menampilkan data apa pun ────────────
export default function Page() {
  const auth = useAuth()

  // Terapkan tema tersimpan sejak layar login (Dompetku mengambil alih setelah masuk)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', (window.localStorage.getItem('finansial-theme') ?? 'dark') === 'dark')
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6">
          <h1 className="mb-2 text-lg font-semibold">Supabase belum dikonfigurasi</h1>
          <p className="text-sm text-muted-foreground">
            Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> di <code>.env.local</code> (lihat <code>.env.example</code>), lalu restart <code>npm run dev</code>.
          </p>
        </div>
      </main>
    )
  }
  if (auth.loading) return <main className="min-h-screen bg-background" />
  if (!auth.user || auth.recovery) return <AuthScreen auth={auth} />
  return <Dompetku key={auth.user.id} userId={auth.user.id} onSignOut={auth.signOut} />
}
