import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase/config'

// Client di sisi server yang bertindak sebagai user pemilik token (RLS tetap berlaku).
export function createUserClient(accessToken: string) {
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase belum dikonfigurasi')
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
