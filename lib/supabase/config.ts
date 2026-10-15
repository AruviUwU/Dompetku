// NEXT_PUBLIC_* harus ditulis literal supaya ikut tertanam saat build
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim()

// Supabase hanya butuh alamat dasarnya (https://xxxx.supabase.co). Path tambahan seperti /rest/v1
// atau garis miring di akhir membuat semua panggilan auth gagal dengan "Invalid path specified in request URL",
// jadi path dibuang di sini.
function baseUrl(value: string | undefined) {
  if (!value) return undefined
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin
  } catch {
    return undefined
  }
}

export const supabaseUrl = baseUrl(rawUrl)
export const supabaseKey = rawKey || undefined

if (process.env.NODE_ENV !== 'production' && rawUrl && supabaseUrl && rawUrl.replace(/\/+$/, '') !== supabaseUrl) {
  console.warn(`[supabase] NEXT_PUBLIC_SUPABASE_URL berisi path tambahan; yang dipakai hanya ${supabaseUrl}`)
}
