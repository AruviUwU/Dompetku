-- Dompetku: tabel untuk menyimpan channel yang dipilih per Discord server
-- Jalankan di Supabase SQL Editor

-- ── server_channels ──────────────────────────────────────────────────────────
-- Satu server (guild) hanya punya satu channel aktif untuk bot Dompetku.
CREATE TABLE IF NOT EXISTS public.server_channels (
  guild_id      TEXT PRIMARY KEY,              -- Discord guild/server ID
  channel_id    TEXT NOT NULL,                 -- Discord channel ID yang dipilih
  set_by        TEXT NOT NULL DEFAULT '',       -- Discord user ID yang set
  set_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Tabel ini diakses oleh service role (bot backend), jadi RLS bisa disabled
-- atau kita buat policy yang permisif untuk service role.
ALTER TABLE public.server_channels ENABLE ROW LEVEL SECURITY;

-- Service role bypass RLS secara default, jadi tidak perlu policy tambahan.
-- Tapi jika ingin akses dari client-side (optional):
CREATE POLICY "server_channels: service role full access" ON public.server_channels
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
