-- Dompetku: skema database Supabase (jalankan sekali di SQL Editor)
-- Uang disimpan sebagai bigint rupiah (tanpa desimal). Tanggal transaksi bertipe `date` (tanpa jam).

-- ── Profil (1 baris per user) ───────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text    not null default '',
  monthly_budget  bigint  not null default 0 check (monthly_budget >= 0),
  initial_balance bigint  not null default 0,
  onboarding_done boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Transaksi ───────────────────────────────────────────────────────────────
-- id dibuat di perangkat (UUID) supaya bisa dicatat sebelum server menjawab.
-- Tidak ada hapus permanen dari app: hapus = isi deleted_at (soft delete).
create table public.transactions (
  id         uuid primary key,
  user_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  name       text   not null check (char_length(name) between 1 and 200),
  category   text   not null,
  date       date   not null,
  amount     bigint not null check (amount > 0),
  type       text   not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now(), -- boleh dikirim client (menjaga urutan data impor)
  updated_at timestamptz not null default now(), -- selalu diisi server lewat trigger
  deleted_at timestamptz
);

create index transactions_user_date_idx    on public.transactions (user_id, date desc);
create index transactions_user_updated_idx on public.transactions (user_id, updated_at);

-- ── updated_at diisi server (jam perangkat tidak dipercaya) ──────────────────
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at     before insert or update on public.profiles
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before insert or update on public.transactions
  for each row execute function public.set_updated_at();

-- ── Profil dibuat otomatis saat user mendaftar ──────────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security: user hanya melihat dan mengubah barisnya sendiri ─────
alter table public.profiles     enable row level security;
alter table public.transactions enable row level security;

create policy "profil: baca milik sendiri"  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profil: tambah milik sendiri" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "profil: ubah milik sendiri"  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "transaksi: baca milik sendiri"  on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "transaksi: tambah milik sendiri" on public.transactions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "transaksi: ubah milik sendiri"  on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Sengaja tanpa policy delete: hapus lewat soft delete. Menghapus akun ikut menghapus semua datanya (on delete cascade).
