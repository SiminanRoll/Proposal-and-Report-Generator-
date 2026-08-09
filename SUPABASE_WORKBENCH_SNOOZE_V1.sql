-- Client Compass Account Review Workbench snooze state.
-- Keeps Workbench deferrals separate from actual account-review dates/status.
-- Safe to run after the universal company identity migration.

begin;

create table if not exists public.company_workbench_snoozes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  snoozed_until date not null,
  snoozed_at timestamptz not null default now(),
  source_app text not null default 'client_compass',
  primary key (user_id, company_id)
);

create index if not exists company_workbench_snoozes_due_idx
  on public.company_workbench_snoozes (user_id, snoozed_until);

alter table public.company_workbench_snoozes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'company_workbench_snoozes'
       and policyname = 'company_workbench_snoozes_select_own'
  ) then
    create policy company_workbench_snoozes_select_own
      on public.company_workbench_snoozes
      for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'company_workbench_snoozes'
       and policyname = 'company_workbench_snoozes_insert_own'
  ) then
    create policy company_workbench_snoozes_insert_own
      on public.company_workbench_snoozes
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
       and tablename = 'company_workbench_snoozes'
       and policyname = 'company_workbench_snoozes_update_own'
  ) then
    create policy company_workbench_snoozes_update_own
      on public.company_workbench_snoozes
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
       and tablename = 'company_workbench_snoozes'
       and policyname = 'company_workbench_snoozes_delete_own'
  ) then
    create policy company_workbench_snoozes_delete_own
      on public.company_workbench_snoozes
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.company_workbench_snoozes to authenticated;

commit;

-- Verification: this should run successfully and normally return no rows initially.
select company_id, snoozed_until, snoozed_at, source_app
from public.company_workbench_snoozes
order by snoozed_until, snoozed_at;
