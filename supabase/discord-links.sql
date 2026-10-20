-- Dompetku: tabel untuk menghubungkan akun Discord ↔ akun Supabase
-- Jalankan SETELAH schema.sql di Supabase SQL Editor

-- ── discord_links ─────────────────────────────────────────────────────────────
-- Satu Discord ID hanya bisa terhubung ke satu akun Supabase (dan sebaliknya).
CREATE TABLE IF NOT EXISTS public.discord_links (
  discord_id    TEXT PRIMARY KEY,           -- Discord user ID (snowflake, 18 digit)
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  discord_name  TEXT NOT NULL DEFAULT '',   -- Username Discord (untuk display)
  linked_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.discord_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discord_links: baca milik sendiri" ON public.discord_links
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "discord_links: tambah milik sendiri" ON public.discord_links
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "discord_links: hapus milik sendiri" ON public.discord_links
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
