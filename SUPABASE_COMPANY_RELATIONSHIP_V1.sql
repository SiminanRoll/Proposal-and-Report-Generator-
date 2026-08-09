-- Captain's Log + Client Compass company relationship classification.
-- IMPORTANT DIRECTIONAL RULE:
--   Client Compass remains CLIENT-ONLY and never imports company records from Supabase.
--   Existing companies already mapped from Client Compass are marked client here.
--   Captain's Log may create/link canonical companies, but that does not create Compass clients.
-- Safe to run after the universal company identity migrations already installed.

begin;

alter table public.companies
  add column if not exists relationship_type text not null default 'unknown';
alter table public.companies
  add column if not exists relationship_source text not null default '';
alter table public.companies
  add column if not exists relationship_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.companies'::regclass
       and conname = 'companies_relationship_type_check'
  ) then
    alter table public.companies
      add constraint companies_relationship_type_check
      check (relationship_type in ('unknown','client','former_client','prospect'));
  end if;
end $$;

create index if not exists companies_user_relationship_idx
  on public.companies (user_id, relationship_type, updated_at desc);

-- CRITICAL BACKFILL: every record already in Client Compass is a client.
-- The durable client_compass external mapping is the membership evidence; no name matching is used.
update public.companies c
   set relationship_type = 'client',
       relationship_source = 'client_compass_backfill',
       relationship_updated_at = now(),
       updated_at = now()
 where exists (
   select 1
     from public.company_external_ids x
    where x.user_id = c.user_id
      and x.company_id = c.id
      and x.source = 'client_compass'
 );

-- Existing Captain's Log sales-prospect identities can safely be labeled prospect
-- only when they are not already a Client Compass client. This never downgrades a client.
update public.companies c
   set relationship_type = 'prospect',
       relationship_source = 'captains_log_prospect_backfill',
       relationship_updated_at = now(),
       updated_at = now()
 where c.relationship_type = 'unknown'
   and exists (
     select 1
       from public.company_external_ids x
      where x.user_id = c.user_id
        and x.company_id = c.id
        and x.source = 'captains_log_prospect'
   )
   and not exists (
     select 1
       from public.company_external_ids x
      where x.user_id = c.user_id
        and x.company_id = c.id
        and x.source = 'client_compass'
   );

-- Shared setter. Client wins over prospect/unknown so a Captain's Log sales row can
-- never downgrade a company already proven to be in the Compass client book.
create or replace function public.set_company_relationship(
  p_company_id uuid,
  p_relationship_type text,
  p_source text default ''
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_requested text := lower(trim(coalesce(p_relationship_type, 'unknown')));
  v_source text := trim(coalesce(p_source, ''));
  v_current text;
  v_next text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_company_id is null then raise exception 'Company ID is required'; end if;
  if v_requested not in ('unknown','client','former_client','prospect') then
    raise exception 'Unsupported relationship type: %', v_requested;
  end if;

  select relationship_type
    into v_current
    from public.companies
   where id = p_company_id and user_id = v_user
   for update;

  if v_current is null then raise exception 'Company not found'; end if;

  -- Client Compass membership is authoritative evidence of an active client.
  if v_requested = 'client' then
    v_next := 'client';
  -- Generic/prospect automation must never downgrade an established client.
  elsif v_current = 'client' and v_requested in ('prospect','unknown') then
    v_next := 'client';
  -- Former-client is an explicit lifecycle decision and is allowed to replace client.
  elsif v_requested = 'former_client' then
    v_next := 'former_client';
  -- A client found again in the Ninja/Compass book is restored to client by the branch above.
  elsif v_current = 'former_client' and v_requested in ('prospect','unknown') then
    v_next := 'former_client';
  else
    v_next := v_requested;
  end if;

  update public.companies
     set relationship_type = v_next,
         relationship_source = case when v_next <> v_current or relationship_source = '' then v_source else relationship_source end,
         relationship_updated_at = case when v_next <> v_current or relationship_updated_at is null then now() else relationship_updated_at end,
         updated_at = now()
   where id = p_company_id and user_id = v_user;

  return v_next;
end;
$$;

-- Protect shared review state at the database boundary without breaking task/event sync.
-- Completing an Account Review-tagged task for a non-client simply does NOT create
-- review state; the task/event itself still succeeds normally.
create or replace function public.record_completed_account_review(
  p_user_id uuid,
  p_company_id uuid,
  p_review_date date,
  p_source_app text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_company_id is null or p_review_date is null then
    return;
  end if;

  if not exists (
    select 1
      from public.companies c
     where c.user_id = p_user_id
       and c.id = p_company_id
       and c.relationship_type = 'client'
  ) then
    return;
  end if;

  insert into public.company_review_state (
    user_id, company_id, review_status, last_completed_review_date,
    cycle_resolved_date, reviewed_activity_through, next_review_date,
    disposition, note, updated_at, updated_by
  )
  values (
    p_user_id, p_company_id, 'completed', p_review_date,
    p_review_date, p_review_date, null,
    'review-completed', '', now(), coalesce(nullif(p_source_app, ''), 'captains_log')
  )
  on conflict (user_id, company_id) do update set
    review_status = 'completed',
    last_completed_review_date = case
      when company_review_state.last_completed_review_date is null then excluded.last_completed_review_date
      else greatest(company_review_state.last_completed_review_date, excluded.last_completed_review_date)
    end,
    cycle_resolved_date = case
      when company_review_state.cycle_resolved_date is null then excluded.cycle_resolved_date
      else greatest(company_review_state.cycle_resolved_date, excluded.cycle_resolved_date)
    end,
    reviewed_activity_through = case
      when company_review_state.reviewed_activity_through is null then excluded.reviewed_activity_through
      else greatest(company_review_state.reviewed_activity_through, excluded.reviewed_activity_through)
    end,
    next_review_date = null,
    disposition = 'review-completed',
    updated_at = now(),
    updated_by = excluded.updated_by;

  insert into public.company_review_history (
    user_id, company_id, event_type, review_status, disposition,
    effective_date, activity_through, next_review_date, note, source_app, created_at
  ) values (
    p_user_id, p_company_id, 'review_completed_from_task', 'completed', 'review-completed',
    p_review_date, p_review_date, null, '', coalesce(nullif(p_source_app, ''), 'captains_log'), now()
  );
end;
$$;

-- One-call Compass reconciliation. It only updates canonical companies that already
-- have a durable client_compass mapping; it cannot create or import Compass records.
create or replace function public.reconcile_client_compass_relationships()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  update public.companies c
     set relationship_type = 'client',
         relationship_source = 'client_compass',
         relationship_updated_at = case when c.relationship_type <> 'client' or c.relationship_updated_at is null then now() else c.relationship_updated_at end,
         updated_at = now()
   where c.user_id = v_user
     and exists (
       select 1
         from public.company_external_ids x
        where x.user_id = v_user
          and x.company_id = c.id
          and x.source = 'client_compass'
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.set_company_relationship(uuid, text, text) to authenticated;
grant execute on function public.reconcile_client_compass_relationships() to authenticated;

commit;

-- VERIFICATION 1: Every Client Compass-mapped company MUST now be client.
select
  count(*) filter (where c.relationship_type = 'client') as compass_clients_marked_client,
  count(*) filter (where c.relationship_type <> 'client') as compass_clients_not_client
from public.companies c
join public.company_external_ids x
  on x.company_id = c.id and x.user_id = c.user_id
where x.source = 'client_compass';

-- VERIFICATION 2: Show relationship counts. Former clients remain zero/unknown until
-- explicitly classified; we do not guess that lifecycle state from names.
select relationship_type, count(*) as company_count
from public.companies
group by relationship_type
order by relationship_type;

-- VERIFICATION 3: Any review state attached to a non-client is surfaced for inspection,
-- but nothing is deleted automatically.
select c.display_name, c.id as company_id, c.relationship_type, r.review_status, r.updated_at
from public.company_review_state r
join public.companies c on c.id = r.company_id and c.user_id = r.user_id
where c.relationship_type <> 'client'
order by r.updated_at desc;
