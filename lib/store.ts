import type { DataStore } from '@/lib/data-store'
import { supabaseStore } from '@/lib/supabase-store'

// Store yang dipakai app. (localStore di lib/data-store.ts disimpan untuk mengimpor data lama di Tahap 5.)
export const store: DataStore = supabaseStore
