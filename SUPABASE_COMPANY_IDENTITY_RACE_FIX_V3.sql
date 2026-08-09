-- Client Compass universal company UUID race fix + conservative duplicate cleanup (V3).
-- Supersedes V2, which used an ON COMMIT DROP temp table that Supabase SQL Editor
-- could discard between statements.
--
-- Safe to run after SUPABASE_COMPANY_IDENTITY_V1_FINAL.sql.
-- Close all Client Compass tabs/windows before running this file.
--
-- V3 does two things:
--   1) Makes ensure_company_identity() concurrency-safe by serializing identity
--      creation on the authenticated user + normalized company name.
--   2) Cleans ONLY exact-display-name race duplicates where exactly one UUID owns
--      durable external IDs and the other UUID(s) own none.
--
-- No fuzzy matching is used. Similar-but-distinct company names are not merged.

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

  -- Serialize first on a durable external ID (when present), then on the
  -- normalized name. All callers acquire locks in this order, preventing both
  -- same-client races and an external ID being claimed under two names.
  if v_source <> '' and v_external <> '' then
    v_lock_key := v_user::text || '|external|' || v_source || '|' || v_external;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  end if;

  v_lock_key := v_user::text || '|company-name|' || v_norm;
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- Exact durable source mapping always wins.
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

  -- Reuse a name/alias only when it resolves to exactly one UUID.
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

    -- Same-name companies are allowed. If this source already has a different
    -- durable external ID on the candidate, this is a separate company.
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

-- Perform the cleanup in ONE PostgreSQL statement. This avoids the Supabase SQL
-- Editor temp-table lifetime issue that affected V2.
do $$
declare
  g record;
  l record;
  v_external_count integer;
begin
  for g in
    with external_counts as (
      select company_id, count(*)::int as external_count
        from public.company_external_ids
       group by company_id
    )
    select
      c.user_id,
      c.display_name,
      min(c.id::text) filter (where coalesce(ec.external_count, 0) > 0)::uuid as keeper,
      max(c.created_at) filter (where coalesce(ec.external_count, 0) > 0) as keeper_created_at
    from public.companies c
    left join external_counts ec on ec.company_id = c.id
    group by c.user_id, c.display_name
    having count(*) > 1
       and count(*) filter (where coalesce(ec.external_count, 0) > 0) = 1
  loop
    -- Use the same lock as ensure_company_identity() so a new identity cannot be
    -- created for this exact normalized name while its race duplicate is cleaned.
    perform pg_advisory_xact_lock(
      hashtextextended(
        g.user_id::text || '|company-name|' || public.normalize_company_name(g.display_name),
        0
      )
    );

    for l in
      select c.id as loser
        from public.companies c
       where c.user_id = g.user_id
         and c.display_name = g.display_name
         and c.id <> g.keeper
         -- Race duplicates in the observed rollout were created milliseconds apart.
         -- Requiring a tight creation window protects older legitimate same-name rows.
         and abs(extract(epoch from (c.created_at - g.keeper_created_at))) <= 10
         and not exists (
           select 1
             from public.company_external_ids x
            where x.company_id = c.id
         )
    loop
      -- Re-check immediately before mutation. If the orphan gained a durable
      -- external mapping, skip it rather than risk merging a legitimate company.
      select count(*)::int
        into v_external_count
        from public.company_external_ids
       where company_id = l.loser;

      if v_external_count <> 0 then
        continue;
      end if;

      -- Preserve aliases on the canonical mapped UUID.
      insert into public.company_aliases (user_id, company_id, alias_name, source, created_at)
      select a.user_id, g.keeper, a.alias_name, a.source, a.created_at
        from public.company_aliases a
       where a.company_id = l.loser
      on conflict (user_id, company_id, normalized_alias) do nothing;

      delete from public.company_aliases
       where company_id = l.loser;

      -- Repoint task rows and UUID copies embedded in metadata.
      update public.task_events e
         set company_id = case
               when e.company_id = l.loser or e.company_id is null then g.keeper
               else e.company_id
             end,
             metadata = case
               when e.metadata is null then e.metadata
               else replace(e.metadata::text, l.loser::text, g.keeper::text)::jsonb
             end
       where e.company_id = l.loser
          or (e.metadata is not null and e.metadata::text like '%' || l.loser::text || '%');

      -- Repoint app rows and UUID copies embedded in payload.
      update public.app_events e
         set company_id = case
               when e.company_id = l.loser or e.company_id is null then g.keeper
               else e.company_id
             end,
             payload = case
               when e.payload is null then e.payload
               else replace(e.payload::text, l.loser::text, g.keeper::text)::jsonb
             end
       where e.company_id = l.loser
          or (e.payload is not null and e.payload::text like '%' || l.loser::text || '%');

      -- Move review state. If keeper already has state, keep whichever state is newer.
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
        g.keeper,
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
      where s.company_id = l.loser
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

      delete from public.company_review_state
       where company_id = l.loser;

      update public.company_review_history
         set company_id = g.keeper
       where company_id = l.loser;

      -- Final safety gate: delete only an orphan that STILL has no durable IDs.
      delete from public.companies c
       where c.id = l.loser
         and not exists (
           select 1
             from public.company_external_ids x
            where x.company_id = c.id
         );
    end loop;
  end loop;
end $$;

-- Verification 1: SHOULD RETURN ZERO ROWS.
-- Any remaining exact display-name duplicates deserve manual review.
select
  display_name,
  count(*) as exact_name_count
from public.companies
group by user_id, display_name
having count(*) > 1
order by exact_name_count desc, display_name;

-- Verification 2: informational only. Similar normalized names may legitimately
-- remain when they are separate Compass clients (for example similarly named offices).
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

-- Verification 3: every Client Compass external ID should point to exactly one UUID.
select
  source,
  external_id,
  count(*) as mapping_count,
  array_agg(company_id order by company_id) as company_ids
from public.company_external_ids
where source = 'client_compass'
group by source, external_id
having count(*) <> 1
order by external_id;
