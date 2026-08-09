-- Shared company identity + account review state for Client Compass and Captain's Log.
-- Supabase/Postgres owns the UUID. Apps consume it; they do not invent it.
-- Idempotent and safe to rerun.

begin;

create extension if not exists pgcrypto;

create or replace function public.normalize_company_name(input text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(replace(coalesce(input, ''), '&', ' and ')), '[^a-z0-9]+', ' ', 'g'),
        '(^| )(llc|pllc|pc|inc|corp|corporation|company|co)( |$)', ' ', 'g'
      ),
      '[[:space:]]+', ' ', 'g'
    )
  );
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null,
  normalized_name text generated always as (public.normalize_company_name(display_name)) stored,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint companies_user_normalized_name_key unique (user_id, normalized_name)
);

create table if not exists public.company_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  alias_name text not null,
  normalized_alias text generated always as (public.normalize_company_name(alias_name)) stored,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint company_aliases_alias_not_blank check (length(trim(alias_name)) > 0),
  constraint company_aliases_user_normalized_alias_key unique (user_id, normalized_alias)
);

create table if not exists public.company_external_ids (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  source text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_external_ids_source_not_blank check (length(trim(source)) > 0),
  constraint company_external_ids_external_not_blank check (length(trim(external_id)) > 0),
  constraint company_external_ids_user_source_external_key unique (user_id, source, external_id)
);

create table if not exists public.company_review_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  review_status text not null default 'needs_review',
  last_completed_review_date date,
  cycle_resolved_date date,
  reviewed_activity_through date,
  next_review_date date,
  disposition text,
  note text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (user_id, company_id)
);

create table if not exists public.company_review_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null default 'review_state_changed',
  review_status text not null default '',
  disposition text not null default '',
  effective_date date,
  activity_through date,
  next_review_date date,
  note text not null default '',
  source_app text not null default '',
  created_at timestamptz not null default now()
);

alter table if exists public.task_events add column if not exists company_id uuid;
alter table if exists public.app_events add column if not exists company_id uuid;

do $$
begin
  if to_regclass('public.task_events') is not null and not exists (
    select 1 from pg_constraint where conname = 'task_events_company_id_fkey'
  ) then
    alter table public.task_events
      add constraint task_events_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete set null;
  end if;

  if to_regclass('public.app_events') is not null and not exists (
    select 1 from pg_constraint where conname = 'app_events_company_id_fkey'
  ) then
    alter table public.app_events
      add constraint app_events_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete set null;
  end if;
end $$;

create index if not exists companies_user_updated_idx on public.companies (user_id, updated_at desc);
create index if not exists company_aliases_user_company_idx on public.company_aliases (user_id, company_id);
create index if not exists company_external_ids_user_company_idx on public.company_external_ids (user_id, company_id);
create index if not exists company_review_state_user_status_idx on public.company_review_state (user_id, review_status, next_review_date);
create index if not exists company_review_history_user_company_created_idx on public.company_review_history (user_id, company_id, created_at desc);
create index if not exists task_events_user_company_cursor_idx on public.task_events (user_id, company_id, inserted_at, event_id) where company_id is not null;
create index if not exists app_events_user_company_cursor_idx on public.app_events (user_id, company_id, inserted_at, event_id) where company_id is not null;

alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.company_aliases enable row level security;
alter table public.company_aliases force row level security;
alter table public.company_external_ids enable row level security;
alter table public.company_external_ids force row level security;
alter table public.company_review_state enable row level security;
alter table public.company_review_state force row level security;
alter table public.company_review_history enable row level security;
alter table public.company_review_history force row level security;

revoke all on public.companies, public.company_aliases, public.company_external_ids, public.company_review_state, public.company_review_history from anon, public;
grant select, insert, update on public.companies, public.company_aliases, public.company_external_ids, public.company_review_state to authenticated;
grant select, insert on public.company_review_history to authenticated;

drop policy if exists companies_owner_select on public.companies;
drop policy if exists companies_owner_insert on public.companies;
drop policy if exists companies_owner_update on public.companies;
create policy companies_owner_select on public.companies for select to authenticated using ((select auth.uid()) = user_id);
create policy companies_owner_insert on public.companies for insert to authenticated with check ((select auth.uid()) = user_id);
create policy companies_owner_update on public.companies for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists company_aliases_owner_select on public.company_aliases;
drop policy if exists company_aliases_owner_insert on public.company_aliases;
drop policy if exists company_aliases_owner_update on public.company_aliases;
create policy company_aliases_owner_select on public.company_aliases for select to authenticated using ((select auth.uid()) = user_id);
create policy company_aliases_owner_insert on public.company_aliases for insert to authenticated with check ((select auth.uid()) = user_id);
create policy company_aliases_owner_update on public.company_aliases for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists company_external_ids_owner_select on public.company_external_ids;
drop policy if exists company_external_ids_owner_insert on public.company_external_ids;
drop policy if exists company_external_ids_owner_update on public.company_external_ids;
create policy company_external_ids_owner_select on public.company_external_ids for select to authenticated using ((select auth.uid()) = user_id);
create policy company_external_ids_owner_insert on public.company_external_ids for insert to authenticated with check ((select auth.uid()) = user_id);
create policy company_external_ids_owner_update on public.company_external_ids for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists company_review_state_owner_select on public.company_review_state;
drop policy if exists company_review_state_owner_insert on public.company_review_state;
drop policy if exists company_review_state_owner_update on public.company_review_state;
create policy company_review_state_owner_select on public.company_review_state for select to authenticated using ((select auth.uid()) = user_id);
create policy company_review_state_owner_insert on public.company_review_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy company_review_state_owner_update on public.company_review_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists company_review_history_owner_select on public.company_review_history;
drop policy if exists company_review_history_owner_insert on public.company_review_history;
create policy company_review_history_owner_select on public.company_review_history for select to authenticated using ((select auth.uid()) = user_id);
create policy company_review_history_owner_insert on public.company_review_history for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.company_id_for_name(p_name text)
returns uuid
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_norm text := public.normalize_company_name(p_name);
  v_ids uuid[];
begin
  if v_user is null or v_norm = '' then return null; end if;

  select array_agg(distinct x.company_id)
    into v_ids
  from (
    select c.id as company_id
      from public.companies c
      where c.user_id = v_user and c.normalized_name = v_norm
    union
    select a.company_id
      from public.company_aliases a
      where a.user_id = v_user and a.normalized_alias = v_norm
  ) x;

  if coalesce(array_length(v_ids, 1), 0) = 1 then return v_ids[1]; end if;
  return null;
end;
$$;

create or replace function public.ensure_company_identity(
  p_display_name text,
  p_aliases text[] default '{}'::text[],
  p_source text default null,
  p_external_id text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_display_name, ''));
  v_norm text := public.normalize_company_name(p_display_name);
  v_company_id uuid;
  v_existing uuid;
  v_alias text;
  v_source text := trim(coalesce(p_source, ''));
  v_external text := trim(coalesce(p_external_id, ''));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_norm = '' then raise exception 'Company name is required'; end if;

  if v_source <> '' and v_external <> '' then
    select company_id into v_company_id
      from public.company_external_ids
      where user_id = v_user and source = v_source and external_id = v_external;
    if v_company_id is not null then return v_company_id; end if;
  end if;

  v_company_id := public.company_id_for_name(v_name);

  if v_company_id is null then
    insert into public.companies (user_id, display_name)
    values (v_user, v_name)
    on conflict (user_id, normalized_name)
    do update set display_name = excluded.display_name, updated_at = now()
    returning id into v_company_id;
  end if;

  foreach v_alias in array (array[v_name] || coalesce(p_aliases, '{}'::text[])) loop
    v_alias := trim(coalesce(v_alias, ''));
    if public.normalize_company_name(v_alias) = '' then continue; end if;

    select company_id into v_existing
      from public.company_aliases
      where user_id = v_user and normalized_alias = public.normalize_company_name(v_alias);

    if v_existing is not null and v_existing <> v_company_id then
      raise exception 'Alias "%" already belongs to another company UUID', v_alias;
    end if;

    insert into public.company_aliases (user_id, company_id, alias_name, source)
    values (v_user, v_company_id, v_alias, coalesce(nullif(v_source, ''), 'name'))
    on conflict (user_id, normalized_alias) do nothing;
  end loop;

  if v_source <> '' and v_external <> '' then
    select company_id into v_existing
      from public.company_external_ids
      where user_id = v_user and source = v_source and external_id = v_external;

    if v_existing is not null and v_existing <> v_company_id then
      raise exception 'External ID %:% already belongs to another company UUID', v_source, v_external;
    end if;

    insert into public.company_external_ids (user_id, company_id, source, external_id)
    values (v_user, v_company_id, v_source, v_external)
    on conflict (user_id, source, external_id)
    do update set company_id = excluded.company_id, updated_at = now();
  end if;

  update public.companies set updated_at = now() where user_id = v_user and id = v_company_id;
  return v_company_id;
end;
$$;

create or replace function public.backfill_company_ids()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_task_count integer := 0;
  v_app_count integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  if to_regclass('public.task_events') is not null then
    with candidates as (
      select e.event_id,
             public.company_id_for_name(
               coalesce(
                 e.metadata #>> '{patch,company}',
                 e.metadata ->> 'company',
                 e.metadata #>> '{mobile_context,company}',
                 e.metadata ->> 'transcript_company'
               )
             ) as cid
      from public.task_events e
      where e.user_id = v_user and e.company_id is null
    )
    update public.task_events e
       set company_id = c.cid,
           metadata = jsonb_set(coalesce(e.metadata, '{}'::jsonb), '{company_id}', to_jsonb(c.cid::text), true)
      from candidates c
     where e.event_id = c.event_id and c.cid is not null;
    get diagnostics v_task_count = row_count;

    insert into public.company_external_ids (user_id, company_id, source, external_id)
    select distinct v_user, e.company_id, 'client_compass', trim(e.metadata ->> 'client_compass_client_id')
      from public.task_events e
      where e.user_id = v_user and e.company_id is not null and trim(coalesce(e.metadata ->> 'client_compass_client_id', '')) <> ''
    on conflict (user_id, source, external_id) do nothing;

    insert into public.company_external_ids (user_id, company_id, source, external_id)
    select distinct v_user, e.company_id, 'captains_log_prospect', trim(coalesce(e.metadata ->> 'sales_prospect_id', e.metadata #>> '{patch,sales_prospect_id}'))
      from public.task_events e
      where e.user_id = v_user and e.company_id is not null
        and trim(coalesce(e.metadata ->> 'sales_prospect_id', e.metadata #>> '{patch,sales_prospect_id}', '')) <> ''
    on conflict (user_id, source, external_id) do nothing;

    insert into public.company_external_ids (user_id, company_id, source, external_id)
    select distinct v_user, e.company_id, 'captains_log_company_instance', trim(coalesce(e.metadata ->> 'company_instance_id', e.metadata #>> '{patch,company_instance_id}'))
      from public.task_events e
      where e.user_id = v_user and e.company_id is not null
        and trim(coalesce(e.metadata ->> 'company_instance_id', e.metadata #>> '{patch,company_instance_id}', '')) <> ''
    on conflict (user_id, source, external_id) do nothing;
  end if;

  if to_regclass('public.app_events') is not null then
    with candidates as (
      select e.event_id,
             public.company_id_for_name(
               coalesce(
                 e.payload #>> '{sales_task,company}',
                 e.payload #>> '{prospect,company}',
                 e.payload #>> '{activity,company}',
                 e.payload #>> '{extra,company}'
               )
             ) as cid
      from public.app_events e
      where e.user_id = v_user and e.event_type = 'call_mode_event' and e.company_id is null
    )
    update public.app_events e
       set company_id = c.cid,
           payload = jsonb_set(
             coalesce(e.payload, '{}'::jsonb),
             '{extra}',
             coalesce(e.payload -> 'extra', '{}'::jsonb) || jsonb_build_object('company_id', c.cid::text),
             true
           )
      from candidates c
     where e.event_id = c.event_id and c.cid is not null;
    get diagnostics v_app_count = row_count;

    insert into public.company_external_ids (user_id, company_id, source, external_id)
    select distinct v_user, e.company_id, 'captains_log_prospect', trim(e.payload #>> '{prospect,id}')
      from public.app_events e
      where e.user_id = v_user and e.event_type = 'call_mode_event' and e.company_id is not null
        and trim(coalesce(e.payload #>> '{prospect,id}', '')) <> ''
    on conflict (user_id, source, external_id) do nothing;

    insert into public.company_external_ids (user_id, company_id, source, external_id)
    select distinct v_user, e.company_id, 'hubspot_company', trim(e.payload #>> '{prospect,hubspot_company_id}')
      from public.app_events e
      where e.user_id = v_user and e.event_type = 'call_mode_event' and e.company_id is not null
        and trim(coalesce(e.payload #>> '{prospect,hubspot_company_id}', '')) <> ''
    on conflict (user_id, source, external_id) do nothing;
  end if;

  return jsonb_build_object('task_events_backfilled', v_task_count, 'app_events_backfilled', v_app_count);
end;
$$;

revoke all on function public.company_id_for_name(text) from public;
revoke all on function public.ensure_company_identity(text, text[], text, text) from public;
revoke all on function public.backfill_company_ids() from public;
grant execute on function public.company_id_for_name(text) to authenticated;
grant execute on function public.ensure_company_identity(text, text[], text, text) to authenticated;
grant execute on function public.backfill_company_ids() to authenticated;

commit;
