export type Transaction = {
  id: string // UUID, dibuat di perangkat
  name: string
  category: string
  date: string // selalu YYYY-MM-DD
  amount: number
  type: 'income' | 'expense'
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp, berubah tiap edit/hapus
  deletedAt: string | null // soft delete: baris tidak dihapus, hanya ditandai
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

export const CATEGORIES = ['Belanja', 'Makanan', 'Tagihan', 'Transportasi', 'Lainnya']

export const CATEGORY_COLORS: Record<string, string> = {
  Belanja: 'bg-violet-400',
  Makanan: 'bg-amber-300',
  Tagihan: 'bg-sky-400',
  Transportasi: 'bg-rose-400',
  Lainnya: 'bg-slate-400',
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export const formatIDR = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

// Tanggal lokal (bukan UTC) supaya tidak mundur sehari di WIB
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Ubah format lama ('Hari ini', '28 Mei 2024') ke YYYY-MM-DD
export function normalizeDate(raw: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = raw.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/)
  if (m) {
    const i = MONTHS.findIndex(n => n.toLowerCase().slice(0, 3) === m[2].slice(0, 3))
    if (i >= 0) return `${m[3]}-${String(i + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return todayISO()
}

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export const monthKey = (iso: string) => iso.slice(0, 7)

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()

// UUID v4; fallback untuk konteks non-HTTPS (mis. tes lewat IP LAN) yang tidak punya crypto.randomUUID
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
