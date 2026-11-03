create table public.flight_stats (
  id uuid primary key default gen_random_uuid(),
  site_name text not null,
  mode text not null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.flight_stats to anon, authenticated;
grant all on public.flight_stats to service_role;

alter table public.flight_stats enable row level security;

create policy "Anyone can log a finished flight"
  on public.flight_stats for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read flight counts"
  on public.flight_stats for select
  to anon, authenticated
  using (true);

create policy "A logged flight can be removed when it is submitted"
  on public.flight_stats for delete
  to anon, authenticated
  using (created_at > now() - interval '1 day');

create or replace function public.flight_summary()
returns table (flights_total bigint, flights_unranked bigint, pilots bigint)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*) from public.leaderboard_entries) + (select count(*) from public.flight_stats),
    (select count(*) from public.flight_stats),
    (select count(distinct lower(btrim(pilot_name))) from public.leaderboard_entries)
$$;

grant execute on function public.flight_summary() to anon, authenticated;