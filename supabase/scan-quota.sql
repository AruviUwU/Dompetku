-- Dompetku: batas pemakaian scan struk (jalankan SETELAH schema.sql)
-- Melindungi kuota API Gemini: tiap scan dicatat, dan server menolak kalau batas terlewat.
-- Ubah angka di fungsi di bawah sesuai kebutuhan, lalu jalankan ulang bagian `create or replace function`.

create table if not exists public.scan_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists scan_log_user_time_idx on public.scan_log (user_id, created_at desc);
create index if not exists scan_log_time_idx      on public.scan_log (created_at desc);

-- RLS aktif tanpa policy: tidak ada yang bisa membaca/menulis tabel ini langsung dari client.
alter table public.scan_log enable row level security;

create or replace function public.consume_scan_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid           uuid := auth.uid();
  per_user_hour constant int := 10;   -- scan per user per jam
  per_user_day  constant int := 40;   -- scan per user per 24 jam
  global_day    constant int := 500;  -- batas total semua user per 24 jam (pemutus biaya)
  n_hour int;
  n_day  int;
  n_all  int;
begin
  if uid is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text)); -- cegah dua scan bersamaan menembus batas

  select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
    into n_hour, n_day
    from public.scan_log
   where user_id = uid and created_at > now() - interval '1 day';

  select count(*) into n_all from public.scan_log where created_at > now() - interval '1 day';

  if n_hour >= per_user_hour or n_day >= per_user_day or n_all >= global_day then
    return false;
  end if;

  insert into public.scan_log (user_id) values (uid);
  return true;
end $$;

revoke execute on function public.consume_scan_quota() from public, anon;
grant  execute on function public.consume_scan_quota() to authenticated;
