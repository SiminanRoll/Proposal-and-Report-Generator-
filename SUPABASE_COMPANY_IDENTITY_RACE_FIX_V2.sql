-- Client Compass universal company UUID race fix + conservative duplicate cleanup.
-- Safe for the current schema after SUPABASE_COMPANY_IDENTITY_V1_FINAL.sql.
--
-- IMPORTANT:
-- 1) Close all Client Compass tabs/windows before running this patch.
-- 2) Run the entire file as one query.
-- 3) Reopen Client Compass only after this transaction commits successfully.
--
-- What this does:
-- - Makes ensure_company_identity() concurrency-safe with a PostgreSQL advisory lock.
-- - Deduplicates ONLY exact-display-name race orphans where exactly one UUID in the
--   exact-name group owns durable external IDs and the duplicate UUID owns none.
-- - Preserves genuinely separate same/similar-name companies.
-- - Repoints any task/app/review references from the race orphan to the mapped UUID.

begin;

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
  v_candidate_ids uuid[];
  v_source_conflict boolean := false;
  v_alias text;
  v_source text := trim(coalesce(p_source, ''));
  v_external text := trim(coalesce(p_external_id, ''));
  v_lock_key text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_norm = '' then raise exception 'Company name is required'; end if;

  -- Durable source+external_id is the safest serialization key. When no durable
  -- external ID exists, serialize by exact normalized name instead.
  v_lock_key := v_user::text || '|' ||
    case
      when v_source <> '' and v_external <> ''
        then 'external|' || v_source || '|' || v_external
      else 'name|' || v_norm
    end;

  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- Re-check AFTER acquiring the lock. A concurrent request may have created
  -- the mapping while this transaction was waiting.
  if v_source <> '' and v_external <> '' then
    select company_id
      into v_company_id
      from public.company_external_ids
     where user_id = v_user
       and source = v_source
       and external_id = v_external;

    if v_company_id is not null then
      update public.companies
         set updated_at = now()
       where user_id = v_user and id = v_company_id;
      return v_company_id;
    end if;
  end if;

  select array_agg(distinct x.company_id order by x.company_id)
    into v_candidate_ids
    from (
      select c.id as company_id
        from public.companies c
       where c.user_id = v_user
         and c.normalized_name = v_norm
      union
      select a.company_id
        from public.company_aliases a
       where a.user_id = v_user
         and a.normalized_alias = v_norm
    ) x;

  if coalesce(array_length(v_candidate_ids, 1), 0) = 1 then
    v_company_id := v_candidate_ids[1];

    -- Same-name companies are allowed. A durable ID from the same source already
    -- attached to the candidate means this external ID represents a different company.
    if v_source <> '' and v_external <> '' then
      select exists (
        select 1
          from public.company_external_ids x
         where x.user_id = v_user
           and x.company_id = v_company_id
           and x.source = v_source
           and x.external_id <> v_external
      ) into v_source_conflict;

      if v_source_conflict then
        v_company_id := null;
      end if;
    end if;
  end if;

  if v_company_id is null then
    insert into public.companies (user_id, display_name)
    values (v_user, v_name)
    returning id into v_company_id;
  end if;

  foreach v_alias in array (array[v_name] || coalesce(p_aliases, '{}'::text[])) loop
    v_alias := trim(coalesce(v_alias, ''));
    if public.normalize_company_name(v_alias) = '' then continue; end if;

    insert into public.company_aliases (user_id, company_id, alias_name, source)
    values (v_user, v_company_id, v_alias, coalesce(nullif(v_source, ''), 'name'))
    on conflict (user_id, company_id, normalized_alias) do nothing;
  end loop;

  if v_source <> '' and v_external <> '' then
    insert into public.company_external_ids (user_id, company_id, source, external_id)
    values (v_user, v_company_id, v_source, v_external)
    on conflict (user_id, source, external_id)
    do update set updated_at = now();
  end if;

  update public.companies
     set updated_at = now()
   where user_id = v_user and id = v_company_id;

  return v_company_id;
end;
$$;

-- Identify only race-created exact-name orphans:
--   * exact display_name is duplicated
--   * exactly one UUID in that exact-name group has durable external mappings
--   * the loser UUID has zero durable external mappings
create temporary table tmp_company_race_merge (
  loser uuid primary key,
  keeper uuid not null,
  user_id uuid not null,
  display_name text not null
) on commit drop;

with external_counts as (
  select company_id, count(*)::int as external_count
    from public.company_external_ids
   group by company_id
),
groups as (
  select
    c.user_id,
    c.display_name,
    count(*)::int as company_count,
    count(*) filter (where coalesce(ec.external_count, 0) > 0)::int as mapped_count,
    min(c.id::text) filter (where coalesce(ec.external_count, 0) > 0)::uuid as keeper
  from public.companies c
  left join external_counts ec on ec.company_id = c.id
  group by c.user_id, c.display_name
  having count(*) > 1
     and count(*) filter (where coalesce(ec.external_count, 0) > 0) = 1
)
insert into tmp_company_race_merge (loser, keeper, user_id, display_name)
select c.id, g.keeper, c.user_id, c.display_name
  from groups g
  join public.companies c
    on c.user_id = g.user_id
   and c.display_name = g.display_name
  left join external_counts ec on ec.company_id = c.id
 where c.id <> g.keeper
   and coalesce(ec.external_count, 0) = 0;

-- Preserve aliases on the canonical mapped UUID.
insert into public.company_aliases (user_id, company_id, alias_name, source, created_at)
select a.user_id, m.keeper, a.alias_name, a.source, a.created_at
  from public.company_aliases a
  join tmp_company_race_merge m on m.loser = a.company_id
on conflict (user_id, company_id, normalized_alias) do nothing;

delete from public.company_aliases a
using tmp_company_race_merge m
where a.company_id = m.loser;

-- Repoint task rows and any duplicated UUID copies in metadata.
update public.task_events e
   set company_id = case when e.company_id = m.loser or e.company_id is null then m.keeper else e.company_id end,
       metadata = case
         when e.metadata is null then e.metadata
         else replace(e.metadata::text, m.loser::text, m.keeper::text)::jsonb
       end
  from tmp_company_race_merge m
 where e.company_id = m.loser
    or (e.metadata is not null and e.metadata::text like '%' || m.loser::text || '%');

-- Repoint app rows and any duplicated UUID copies in payload.
update public.app_events e
   set company_id = case when e.company_id = m.loser or e.company_id is null then m.keeper else e.company_id end,
       payload = case
         when e.payload is null then e.payload
         else replace(e.payload::text, m.loser::text, m.keeper::text)::jsonb
       end
  from tmp_company_race_merge m
 where e.company_id = m.loser
    or (e.payload is not null and e.payload::text like '%' || m.loser::text || '%');

-- Move review state. If both UUIDs somehow have state, keep the newer state.
insert into public.company_review_state (
  user_id,
  company_id,
  review_status,
  last_completed_review_date,
  cycle_resolved_date,
  reviewed_activity_through,
  next_review_date,
  disposition,
  note,
  updated_at,
  updated_by
)
select
  s.user_id,
  m.keeper,
  s.review_status,
  s.last_completed_review_date,
  s.cycle_resolved_date,
  s.reviewed_activity_through,
  s.next_review_date,
  s.disposition,
  s.note,
  s.updated_at,
  s.updated_by
from public.company_review_state s
join tmp_company_race_merge m on m.loser = s.company_id
on conflict (user_id, company_id) do update
set
  review_status = excluded.review_status,
  last_completed_review_date = excluded.last_completed_review_date,
  cycle_resolved_date = excluded.cycle_resolved_date,
  reviewed_activity_through = excluded.reviewed_activity_through,
  next_review_date = excluded.next_review_date,
  disposition = excluded.disposition,
  note = excluded.note,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by
where excluded.updated_at > public.company_review_state.updated_at;

delete from public.company_review_state s
using tmp_company_race_merge m
where s.company_id = m.loser;

update public.company_review_history h
   set company_id = m.keeper
  from tmp_company_race_merge m
 where h.company_id = m.loser;

-- Losers selected above own no external IDs by definition. Delete only those orphans.
delete from public.companies c
using tmp_company_race_merge m
where c.id = m.loser;

commit;

-- Verification result 1: should return zero exact-display-name race duplicates.
select
  display_name,
  count(*) as exact_name_count
from public.companies
group by user_id, display_name
having count(*) > 1
order by exact_name_count desc, display_name;

-- Verification result 2: normalized-name collisions can legitimately remain when
-- two distinct companies normalize similarly. This is informational, not an error.
select
  public.normalize_company_name(display_name) as normalized_name,
  count(*) as company_count,
  array_agg(jsonb_build_object(
    'display_name', display_name,
    'company_id', id
  ) order by display_name, id) as companies
from public.companies
group by user_id, public.normalize_company_name(display_name)
having count(*) > 1
order by company_count desc, normalized_name;
