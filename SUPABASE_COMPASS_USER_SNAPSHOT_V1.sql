-- Client Compass automatic user-level recovery snapshot.
-- Stores one current recovery snapshot per authenticated Supabase user.

begin;

create table if not exists public.client_compass_user_snapshots (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  snapshot jsonb not null,
  saved_at timestamptz not null default now(),
  app_version text not null default '',
  source_app text not null default 'client_compass'
);

create index if not exists client_compass_user_snapshots_saved_idx
  on public.client_compass_user_snapshots (saved_at desc);

alter table public.client_compass_user_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'client_compass_user_snapshots'
       and policyname = 'client_compass_user_snapshots_select_own'
  ) then
    create policy client_compass_user_snapshots_select_own
      on public.client_compass_user_snapshots
      for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'client_compass_user_snapshots'
       and policyname = 'client_compass_user_snapshots_insert_own'
  ) then
    create policy client_compass_user_snapshots_insert_own
      on public.client_compass_user_snapshots
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'client_compass_user_snapshots'
       and policyname = 'client_compass_user_snapshots_update_own'
  ) then
    create policy client_compass_user_snapshots_update_own
      on public.client_compass_user_snapshots
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'client_compass_user_snapshots'
       and policyname = 'client_compass_user_snapshots_delete_own'
  ) then
    create policy client_compass_user_snapshots_delete_own
      on public.client_compass_user_snapshots
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.client_compass_user_snapshots to authenticated;

commit;

select user_id, saved_at, app_version, source_app
from public.client_compass_user_snapshots
order by saved_at desc;
