-- Client Compass Account Review Workbench manual membership state.
-- Makes explicit Add to Workbench changes portable across browsers/devices by universal company UUID.
-- Safe to run after the universal company identity migration.

begin;

create table if not exists public.company_workbench_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  manual_included boolean not null default false,
  updated_at timestamptz not null default now(),
  source_app text not null default 'client_compass',
  primary key (user_id, company_id)
);

create index if not exists company_workbench_state_updated_idx
  on public.company_workbench_state (user_id, updated_at desc);

alter table public.company_workbench_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'company_workbench_state'
       and policyname = 'company_workbench_state_select_own'
  ) then
    create policy company_workbench_state_select_own
      on public.company_workbench_state
      for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'company_workbench_state'
       and policyname = 'company_workbench_state_insert_own'
  ) then
    create policy company_workbench_state_insert_own
      on public.company_workbench_state
      for insert to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.companies c
           where c.id = company_id and c.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'company_workbench_state'
       and policyname = 'company_workbench_state_update_own'
  ) then
    create policy company_workbench_state_update_own
      on public.company_workbench_state
      for update to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.companies c
           where c.id = company_id and c.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'company_workbench_state'
       and policyname = 'company_workbench_state_delete_own'
  ) then
    create policy company_workbench_state_delete_own
      on public.company_workbench_state
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.company_workbench_state to authenticated;

commit;

-- Verification: explicit Workbench membership rows are keyed by the universal company UUID.
select company_id, manual_included, updated_at, source_app
from public.company_workbench_state
order by updated_at desc;
