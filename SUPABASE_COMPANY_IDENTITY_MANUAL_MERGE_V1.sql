-- Captain's Log + Client Compass manual company identity repair.
-- Adds an explicit, user-confirmed merge/link path for records that automation
-- correctly refuses to fuzzy-match (renames, punctuation changes, DBA/name drift,
-- historical transcript-only names, and mismatched Captain's Log / Compass UUIDs).
--
-- Safe to run after the universal company identity + relationship migrations.
-- Automatic identity remains conservative; ONLY this explicit RPC can merge two
-- different UUIDs.

begin;

create or replace function public.merge_company_identities(
  p_keep_company_id uuid,
  p_merge_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_keep public.companies%rowtype;
  v_merge public.companies%rowtype;
  v_relationship text := 'unknown';
  v_relationship_source text := 'manual_identity_merge';
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_keep_company_id is null or p_merge_company_id is null then
    raise exception 'Both company IDs are required';
  end if;
  if p_keep_company_id = p_merge_company_id then
    select * into v_keep from public.companies where user_id=v_user and id=p_keep_company_id;
    if v_keep.id is null then raise exception 'Company not found'; end if;
    return jsonb_build_object(
      'company_id', v_keep.id,
      'display_name', v_keep.display_name,
      'relationship_type', coalesce(v_keep.relationship_type, 'unknown'),
      'merged_company_id', p_merge_company_id,
      'already_linked', true
    );
  end if;

  -- Lock in deterministic UUID order so two repair attempts cannot deadlock.
  perform 1
    from public.companies
   where user_id=v_user and id in (p_keep_company_id, p_merge_company_id)
   order by id
   for update;

  select * into v_keep from public.companies where user_id=v_user and id=p_keep_company_id;
  select * into v_merge from public.companies where user_id=v_user and id=p_merge_company_id;
  if v_keep.id is null or v_merge.id is null then
    raise exception 'One or both company records were not found for this user';
  end if;

  -- Keep both visible names and every historical alias.
  insert into public.company_aliases (user_id, company_id, alias_name, source)
  values (v_user, p_keep_company_id, v_keep.display_name, 'manual_identity_merge')
  on conflict (user_id, company_id, normalized_alias) do nothing;
  insert into public.company_aliases (user_id, company_id, alias_name, source)
  values (v_user, p_keep_company_id, v_merge.display_name, 'manual_identity_merge')
  on conflict (user_id, company_id, normalized_alias) do nothing;
  insert into public.company_aliases (user_id, company_id, alias_name, source, created_at)
  select user_id, p_keep_company_id, alias_name, source, created_at
    from public.company_aliases
   where user_id=v_user and company_id=p_merge_company_id
  on conflict (user_id, company_id, normalized_alias) do nothing;
  delete from public.company_aliases
   where user_id=v_user and company_id=p_merge_company_id;

  -- Move every durable external identity (Compass, Captain's Log, HubSpot, etc.).
  update public.company_external_ids
     set company_id=p_keep_company_id, updated_at=now()
   where user_id=v_user and company_id=p_merge_company_id;

  -- Repoint cloud task/app history and embedded UUID copies.
  update public.task_events
     set company_id=case when company_id=p_merge_company_id or company_id is null then p_keep_company_id else company_id end,
         metadata=case when metadata is null then metadata else replace(metadata::text,p_merge_company_id::text,p_keep_company_id::text)::jsonb end
   where user_id=v_user and (
     company_id=p_merge_company_id or
     (metadata is not null and metadata::text like '%'||p_merge_company_id::text||'%')
   );
  update public.app_events
     set company_id=case when company_id=p_merge_company_id or company_id is null then p_keep_company_id else company_id end,
         payload=case when payload is null then payload else replace(payload::text,p_merge_company_id::text,p_keep_company_id::text)::jsonb end
   where user_id=v_user and (
     company_id=p_merge_company_id or
     (payload is not null and payload::text like '%'||p_merge_company_id::text||'%')
   );

  -- Preserve the newest Account Review state and all review history.
  insert into public.company_review_state (
    user_id, company_id, review_status, last_completed_review_date,
    cycle_resolved_date, reviewed_activity_through, next_review_date,
    disposition, note, updated_at, updated_by
  )
  select
    user_id, p_keep_company_id, review_status, last_completed_review_date,
    cycle_resolved_date, reviewed_activity_through, next_review_date,
    disposition, note, updated_at, updated_by
  from public.company_review_state
  where user_id=v_user and company_id=p_merge_company_id
  on conflict (user_id, company_id) do update
  set
    review_status=excluded.review_status,
    last_completed_review_date=excluded.last_completed_review_date,
    cycle_resolved_date=excluded.cycle_resolved_date,
    reviewed_activity_through=excluded.reviewed_activity_through,
    next_review_date=excluded.next_review_date,
    disposition=excluded.disposition,
    note=excluded.note,
    updated_at=excluded.updated_at,
    updated_by=excluded.updated_by
  where excluded.updated_at > public.company_review_state.updated_at;
  delete from public.company_review_state
   where user_id=v_user and company_id=p_merge_company_id;
  update public.company_review_history
     set company_id=p_keep_company_id
   where user_id=v_user and company_id=p_merge_company_id;

  -- Client is strongest membership evidence. Preserve explicit former-client over
  -- prospect/unknown when neither side is currently a Compass client.
  if coalesce(v_keep.relationship_type,'unknown')='client'
     or coalesce(v_merge.relationship_type,'unknown')='client'
     or exists (
       select 1 from public.company_external_ids
        where user_id=v_user and company_id=p_keep_company_id and source='client_compass'
     ) then
    v_relationship := 'client';
    v_relationship_source := 'manual_identity_merge_client';
  elsif coalesce(v_keep.relationship_type,'unknown')='former_client'
     or coalesce(v_merge.relationship_type,'unknown')='former_client' then
    v_relationship := 'former_client';
  elsif coalesce(v_keep.relationship_type,'unknown')='prospect'
     or coalesce(v_merge.relationship_type,'unknown')='prospect' then
    v_relationship := 'prospect';
  else
    v_relationship := 'unknown';
  end if;

  update public.companies
     set relationship_type=v_relationship,
         relationship_source=v_relationship_source,
         relationship_updated_at=now(),
         updated_at=now()
   where user_id=v_user and id=p_keep_company_id;

  delete from public.companies
   where user_id=v_user and id=p_merge_company_id;

  return jsonb_build_object(
    'company_id', p_keep_company_id,
    'display_name', v_keep.display_name,
    'merged_display_name', v_merge.display_name,
    'relationship_type', v_relationship,
    'merged_company_id', p_merge_company_id,
    'already_linked', false
  );
end;
$$;

create or replace function public.link_company_alias_to_identity(
  p_company_id uuid,
  p_alias_name text,
  p_source text default null,
  p_external_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_alias text := trim(coalesce(p_alias_name,''));
  v_source text := trim(coalesce(p_source,''));
  v_external text := trim(coalesce(p_external_id,''));
  v_existing uuid;
  v_company public.companies%rowtype;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_company_id is null then raise exception 'Company ID is required'; end if;
  if public.normalize_company_name(v_alias)='' then raise exception 'Alias name is required'; end if;

  select * into v_company
    from public.companies
   where user_id=v_user and id=p_company_id
   for update;
  if v_company.id is null then raise exception 'Target company not found'; end if;

  -- If the durable local record already belongs to another UUID, this is an
  -- explicit user-approved merge. The selected target remains canonical.
  if v_source<>'' and v_external<>'' then
    select company_id into v_existing
      from public.company_external_ids
     where user_id=v_user and source=v_source and external_id=v_external;
    if v_existing is not null and v_existing<>p_company_id then
      v_result := public.merge_company_identities(p_company_id, v_existing);
    end if;
  end if;

  insert into public.company_aliases (user_id, company_id, alias_name, source)
  values (v_user, p_company_id, v_alias, 'manual_identity_link')
  on conflict (user_id, company_id, normalized_alias) do nothing;

  if v_source<>'' and v_external<>'' then
    insert into public.company_external_ids (user_id, company_id, source, external_id)
    values (v_user, p_company_id, v_source, v_external)
    on conflict (user_id, source, external_id)
    do update set company_id=excluded.company_id, updated_at=now();
  end if;

  if v_source='client_compass' or exists (
    select 1 from public.company_external_ids
     where user_id=v_user and company_id=p_company_id and source='client_compass'
  ) then
    update public.companies
       set relationship_type='client',
           relationship_source='manual_identity_link_client',
           relationship_updated_at=now(),
           updated_at=now()
     where user_id=v_user and id=p_company_id;
  else
    update public.companies set updated_at=now()
     where user_id=v_user and id=p_company_id;
  end if;

  select * into v_company from public.companies where user_id=v_user and id=p_company_id;
  return jsonb_build_object(
    'company_id', p_company_id,
    'display_name', v_company.display_name,
    'relationship_type', coalesce(v_company.relationship_type,'unknown'),
    'alias_name', v_alias,
    'merged_company_id', coalesce(v_result->>'merged_company_id',''),
    'merged_display_name', coalesce(v_result->>'merged_display_name','')
  );
end;
$$;

revoke all on function public.merge_company_identities(uuid, uuid) from public;
revoke all on function public.link_company_alias_to_identity(uuid, text, text, text) from public;
grant execute on function public.merge_company_identities(uuid, uuid) to authenticated;
grant execute on function public.link_company_alias_to_identity(uuid, text, text, text) to authenticated;

commit;

-- Informational: show likely split identities. Nothing below mutates data.
select
  c.display_name,
  c.id as company_id,
  c.relationship_type,
  array_agg(distinct x.source) filter (where x.source is not null) as sources,
  array_agg(distinct a.alias_name) filter (where a.alias_name is not null) as aliases
from public.companies c
left join public.company_external_ids x on x.user_id=c.user_id and x.company_id=c.id
left join public.company_aliases a on a.user_id=c.user_id and a.company_id=c.id
group by c.user_id, c.display_name, c.id, c.relationship_type
order by c.display_name;
