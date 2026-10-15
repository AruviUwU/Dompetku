import { newId, normalizeDate, type Transaction } from '@/lib/transactions'

export type Profile = {
  onboardingDone: boolean
  name: string
  monthlyBudget: number
  initialBalance: number
}

export const DEFAULT_PROFILE: Profile = { onboardingDone: false, name: '', monthlyBudget: 0, initialBalance: 0 }

// Satu-satunya pintu akses data. Implementasi yang aktif dipilih di lib/store.ts.
export interface DataStore {
  load(): Promise<{ profile: Profile; transactions: Transaction[] }>
  saveProfile(profile: Profile): Promise<void>
  /** Insert atau update satu baris. Hapus = upsert dengan deletedAt terisi. */
  upsertTransaction(row: Transaction): Promise<void>
  /** Banyak baris sekaligus (dipakai saat memindahkan data lama ke akun). */
  upsertTransactions(rows: Transaction[]): Promise<void>
}

// ── Implementasi localStorage ───────────────────────────────────────────────
const KEY = 'dompetku-v2'
type Snapshot = { version: 2; profile: Profile; transactions: Transaction[] }

const read = (key: string) => window.localStorage.getItem(key)

function migrateLegacy(): Snapshot {
  let legacy: Array<Record<string, unknown>> = []
  try { legacy = JSON.parse(read('finansial-transactions') ?? '[]') } catch {}
  const base = Date.now()
  const snap: Snapshot = {
    version: 2,
    profile: {
      onboardingDone: read('dompetku-onboarding-done') === 'true',
      name: read('dompetku-user-name') ?? '',
      monthlyBudget: Number(read('dompetku-monthly-budget')) || 0,
      initialBalance: Number(read('dompetku-initial-balance')) || 0,
    },
    // Data lama diurutkan terbaru-dulu, jadi createdAt dibuat mundur supaya urutan tetap
    transactions: (Array.isArray(legacy) ? legacy : []).map((t, i) => {
      const stamp = new Date(base - i * 1000).toISOString()
      return {
        id: newId(),
        name: String(t.name ?? ''),
        category: String(t.category ?? 'Lainnya'),
        date: normalizeDate(String(t.date ?? '')),
        amount: Number(t.amount) || 0,
        type: t.type === 'income' ? 'income' : 'expense',
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      } satisfies Transaction
    }),
  }
  write(snap) // kunci lama dibiarkan sebagai cadangan
  return snap
}

function readSnapshot(): Snapshot {
  const raw = read(KEY)
  if (raw) {
    try {
      const s = JSON.parse(raw) as Snapshot
      if (s?.version === 2 && Array.isArray(s.transactions)) return { ...s, profile: { ...DEFAULT_PROFILE, ...s.profile } }
    } catch {}
  }
  return migrateLegacy()
}

function write(snap: Snapshot) {
  window.localStorage.setItem(KEY, JSON.stringify(snap))
}

export const localStore: DataStore = {
  async load() {
    const { profile, transactions } = readSnapshot()
    return { profile, transactions }
  },
  async saveProfile(profile) {
    write({ ...readSnapshot(), profile })
  },
  async upsertTransaction(row) {
    const snap = readSnapshot()
    const i = snap.transactions.findIndex(t => t.id === row.id)
    if (i >= 0) snap.transactions[i] = row
    else snap.transactions.unshift(row)
    write(snap)
  },
  async upsertTransactions(rows) {
    const snap = readSnapshot()
    for (const row of rows) {
      const i = snap.transactions.findIndex(t => t.id === row.id)
      if (i >= 0) snap.transactions[i] = row
      else snap.transactions.unshift(row)
    }
    write(snap)
  },
}

export type LocalData = { profile: Profile; transactions: Transaction[] }

/** Data di perangkat ini yang layak ditawarkan untuk dipindahkan ke akun, atau null kalau tidak ada. */
export function readLocalData(): LocalData | null {
  try {
    const hasAny = read(KEY) || read('finansial-transactions') || read('dompetku-user-name') || read('dompetku-onboarding-done')
    if (!hasAny) return null
    const { profile, transactions } = readSnapshot() // data lama otomatis dimigrasi (id tetap setelah itu)
    const live = transactions.filter(t => !t.deletedAt)
    if (live.length === 0 && !profile.onboardingDone) return null
    return { profile, transactions: live }
  } catch {
    return null
  }
}

