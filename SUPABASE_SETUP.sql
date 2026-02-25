create table if not exists public.route_addresses (
  route_no integer not null,
  address_index integer not null,
  address text not null,
  city text not null,
  primary key (route_no, address_index)
);

create table if not exists public.route_status (
  route_no integer not null,
  address_index integer not null,
  delivered boolean not null default false,
  problem boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (route_no, address_index)
);

create table if not exists public.route_reports (
  id bigint generated always as identity primary key,
  route_no integer not null,
  address_index integer not null,
  address text not null,
  city text not null,
  problem_type text not null,
  comment text not null default '',
  image_data text not null default '',
  reported_at timestamptz not null default now()
);

alter table public.route_reports add column if not exists image_data text not null default '';

alter table public.route_addresses enable row level security;
alter table public.route_status enable row level security;
alter table public.route_reports enable row level security;

-- Slet gamle policies
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'route_addresses' LOOP
    EXECUTE format('drop policy if exists %I on public.route_addresses', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'route_status' LOOP
    EXECUTE format('drop policy if exists %I on public.route_status', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'route_reports' LOOP
    EXECUTE format('drop policy if exists %I on public.route_reports', p.policyname);
  END LOOP;
END $$;

-- Simpel opsaetning: alle kan laese/skrive med anon key
create policy route_addresses_all
on public.route_addresses
for all
using (true)
with check (true);

create policy route_status_all
on public.route_status
for all
using (true)
with check (true);

create policy route_reports_all
on public.route_reports
for all
using (true)
with check (true);
