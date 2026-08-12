-- Client Compass Phase 1 sync optimization.
--
-- Purpose:
--   1) Resolve many Client Compass records to universal company UUIDs in one call.
--   2) Ask Supabase which client UUIDs changed since the local cursor in one call.
--   3) Return compact current task/activity state for only the requested companies,
--      so Compass no longer downloads and reconstructs each company's full ledger.
--
-- Safe to run after the universal company identity + relationship migrations.
-- This migration does not delete or rewrite task/app history.

begin;

create index if not exists task_events_user_company_inserted_idx
  on public.task_events (user_id, company_id, inserted_at desc)
  where company_id is not null;

create index if not exists app_events_user_company_type_inserted_idx
  on public.app_events (user_id, company_id, event_type, inserted_at desc)
  where company_id is not null;

create index if not exists company_external_ids_user_source_external_idx
  on public.company_external_ids (user_id, source, external_id, company_id);

-- One network request for all missing Client Compass UUIDs. The existing
-- ensure_company_identity() function remains the identity authority and keeps its
-- ambiguity-safe behavior; this RPC only batches the calls server-side.
create or replace function public.resolve_client_compass_companies(p_clients jsonb)
returns table (
  client_id text,
  company_id uuid,
  display_name text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_client_id text;
  v_display_name text;
  v_aliases text[];
  v_company_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_clients is null then return; end if;
  if jsonb_typeof(p_clients) <> 'array' then raise exception 'p_clients must be a JSON array'; end if;
  if jsonb_array_length(p_clients) > 2000 then raise exception 'Too many clients in one identity batch'; end if;

  for v_item in select value from jsonb_array_elements(p_clients)
  loop
    v_client_id := trim(coalesce(v_item->>'client_id', ''));
    v_display_name := trim(coalesce(v_item->>'display_name', ''));
    if v_client_id = '' or v_display_name = '' then continue; end if;

    select coalesce(array_agg(trim(value)) filter (where trim(value) <> ''), '{}'::text[])
      into v_aliases
      from jsonb_array_elements_text(
        case when jsonb_typeof(v_item->'aliases') = 'array' then v_item->'aliases' else '[]'::jsonb end
      );

    v_company_id := public.ensure_company_identity(
      v_display_name,
      v_aliases,
      'client_compass',
      v_client_id
    );

    -- Client Compass membership is authoritative client evidence. Keep this update
    -- in the same round trip so a newly resolved client does not need a later sweep.
    update public.companies c
       set relationship_type = 'client',
           relationship_source = 'client_compass_bulk',
           relationship_updated_at = case when c.relationship_type <> 'client' or c.relationship_updated_at is null then now() else c.relationship_updated_at end,
           updated_at = now()
     where c.user_id = v_user and c.id = v_company_id;

    client_id := v_client_id;
    company_id := v_company_id;
    display_name := v_display_name;
    return next;
  end loop;
end;
$$;

-- One lightweight delta request replaces two payload-heavy event requests.
create or replace function public.client_compass_changed_company_ids(
  p_since timestamptz,
  p_limit integer default 10000
)
returns table (
  company_id uuid,
  changed_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  with changed as (
    select e.company_id, e.inserted_at as changed_at
      from public.task_events e
     where e.user_id = auth.uid()
       and e.company_id is not null
       and e.inserted_at >= coalesce(p_since, now() - interval '5 minutes')
    union all
    select e.company_id, e.inserted_at as changed_at
      from public.app_events e
     where e.user_id = auth.uid()
       and e.company_id is not null
       and e.event_type = 'call_mode_event'
       and e.inserted_at >= coalesce(p_since, now() - interval '5 minutes')
  )
  select c.company_id, max(c.changed_at) as changed_at
    from changed c
   group by c.company_id
   order by max(c.changed_at) asc
   limit greatest(1, least(coalesce(p_limit, 10000), 10000));
$$;

-- Current-state projection for requested UUIDs only. The event ledger remains the
-- durable source of truth, but reconstruction runs next to the data and only the
-- compact task/activity result crosses the network.
create or replace function public.client_compass_current_state(
  p_company_ids uuid[],
  p_recent_limit integer default 40
)
returns table (
  company_id uuid,
  linked_company text,
  focus_tasks jsonb,
  sales_tasks jsonb,
  sales_activities jsonb,
  contact jsonb,
  last_account_review date,
  synced_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_company_name text;
  v_focus_map jsonb;
  v_sales_map jsonb;
  v_activity_rows jsonb;
  v_focus_rows jsonb;
  v_sales_rows jsonb;
  v_contact jsonb;
  v_contact_at text;
  v_review date;
  r record;
  v_meta jsonb;
  v_patch jsonb;
  v_mobile jsonb;
  v_payload jsonb;
  v_prospect jsonb;
  v_sales_task jsonb;
  v_activity jsonb;
  v_task jsonb;
  v_task_id text;
  v_event_type text;
  v_when text;
  v_title text;
  v_tag text;
  v_scheduled text;
  v_completed_at text;
  v_created_at text;
  v_source text;
  v_task_contact text;
  v_done boolean;
  v_deleted boolean;
  v_action_type text;
  v_due_date text;
  v_phone text;
  v_updated_at text;
  v_prospect_id text;
  v_contact_name text;
  v_contact_phone text;
  v_contact_updated text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_company_ids is null or coalesce(array_length(p_company_ids, 1), 0) = 0 then return; end if;
  if array_length(p_company_ids, 1) > 1000 then raise exception 'Too many company IDs in one current-state request'; end if;

  foreach v_company in array p_company_ids
  loop
    select c.display_name
      into v_company_name
      from public.companies c
     where c.user_id = v_user and c.id = v_company;
    if v_company_name is null then continue; end if;

    v_focus_map := '{}'::jsonb;
    v_sales_map := '{}'::jsonb;
    v_activity_rows := '[]'::jsonb;
    v_contact := '{}'::jsonb;
    v_contact_at := '';

    -- Rebuild Focus/current-task state in PostgreSQL using the same transition
    -- semantics as the existing browser bridge.
    for r in
      select
        e.event_id, e.event_type, e.local_task_id, e.task_title, e.tag, e.done,
        e.occurred_at, e.inserted_at, e.metadata
      from public.task_events e
      where e.user_id = v_user and e.company_id = v_company
      order by coalesce(e.occurred_at, e.inserted_at) asc, e.event_id asc
    loop
      v_task_id := trim(coalesce(r.local_task_id, ''));
      if v_task_id = '' then continue; end if;
      v_meta := case when jsonb_typeof(coalesce(r.metadata, '{}'::jsonb)) = 'object' then coalesce(r.metadata, '{}'::jsonb) else '{}'::jsonb end;
      v_patch := case when jsonb_typeof(v_meta->'patch') = 'object' then v_meta->'patch' else '{}'::jsonb end;
      v_mobile := case when jsonb_typeof(v_meta->'mobile_context') = 'object' then v_meta->'mobile_context' else '{}'::jsonb end;
      v_event_type := regexp_replace(lower(trim(coalesce(r.event_type, ''))), '_retro$', '');
      v_when := coalesce(nullif(r.occurred_at::text, ''), nullif(r.inserted_at::text, ''), now()::text);
      v_task := coalesce(v_focus_map->v_task_id, '{}'::jsonb);

      v_title := coalesce(nullif(trim(coalesce(v_task->>'title', '')), ''), nullif(trim(coalesce(r.task_title, '')), ''), 'Task');
      v_tag := coalesce(v_task->>'tag', '');
      v_done := coalesce((v_task->>'done')::boolean, false);
      v_deleted := coalesce((v_task->>'deleted')::boolean, false);
      v_scheduled := coalesce(v_task->>'scheduled_at', '');
      v_completed_at := coalesce(v_task->>'completed_at', '');
      v_created_at := coalesce(nullif(v_task->>'created_at', ''), nullif(v_meta->>'created_at', ''), v_when);
      v_source := coalesce(nullif(v_task->>'source', ''), 'focus');
      v_task_contact := coalesce(v_task->>'contact', '');

      if trim(coalesce(r.task_title, '')) <> '' then v_title := trim(r.task_title); end if;
      if trim(coalesce(r.tag, '')) <> '' then v_tag := trim(r.tag); end if;
      v_task_contact := coalesce(
        nullif(trim(coalesce(v_patch->>'contact', '')), ''),
        nullif(trim(coalesce(v_meta->>'contact', '')), ''),
        nullif(trim(coalesce(v_mobile->>'contact', '')), ''),
        nullif(trim(coalesce(v_meta->>'transcript_contact', '')), ''),
        v_task_contact
      );
      v_source := coalesce(nullif(trim(coalesce(v_patch->>'source', '')), ''), nullif(trim(coalesce(v_meta->>'source', '')), ''), v_source);

      if v_patch ? 'title' then v_title := coalesce(nullif(trim(coalesce(v_patch->>'title', '')), ''), v_title); end if;
      if v_patch ? 'tag' then v_tag := coalesce(nullif(trim(coalesce(v_patch->>'tag', '')), ''), v_tag); end if;
      if v_patch ? 'scheduled_at' then
        v_scheduled := trim(coalesce(v_patch->>'scheduled_at', ''));
      elsif v_meta ? 'scheduled_at' then
        v_scheduled := trim(coalesce(v_meta->>'scheduled_at', ''));
      end if;
      if v_patch ? 'completed_at' then v_completed_at := trim(coalesce(v_patch->>'completed_at', '')); end if;
      if v_patch ? 'done' then
        v_done := lower(trim(coalesce(v_patch->>'done', ''))) in ('1','true','yes','done','completed');
      elsif r.done is not null and v_event_type <> 'task_created' then
        v_done := r.done;
      end if;

      if v_event_type in ('task_deleted', 'task_removed') then
        v_deleted := true;
      elsif position('reopened' in v_event_type) > 0 then
        v_deleted := false;
        v_done := false;
        v_completed_at := '';
      elsif position('completed' in v_event_type) > 0 then
        v_done := true;
        v_completed_at := coalesce(nullif(trim(coalesce(v_meta->>'completed_at', '')), ''), v_when);
        v_scheduled := '';
      elsif position('unscheduled' in v_event_type) > 0 then
        v_scheduled := '';
      elsif position('scheduled' in v_event_type) > 0 then
        if not v_done then v_scheduled := coalesce(nullif(trim(coalesce(v_meta->>'scheduled_at', '')), ''), v_scheduled); end if;
      elsif v_event_type like 'task_created%' then
        v_deleted := false;
        if not v_done then v_done := coalesce(r.done, false); end if;
      end if;

      v_focus_map := jsonb_set(v_focus_map, array[v_task_id], jsonb_build_object(
        'id', v_task_id,
        'title', v_title,
        'tag', v_tag,
        'done', v_done,
        'deleted', v_deleted,
        'scheduled_at', v_scheduled,
        'completed_at', v_completed_at,
        'created_at', v_created_at,
        'contact', v_task_contact,
        'source', v_source
      ), true);
    end loop;

    -- Rebuild Call Mode current task state and compact standalone activities.
    for r in
      select e.event_id, e.payload, e.created_at, e.inserted_at
      from public.app_events e
      where e.user_id = v_user
        and e.company_id = v_company
        and e.event_type = 'call_mode_event'
      order by coalesce(e.created_at, e.inserted_at) asc, e.event_id asc
    loop
      v_payload := case when jsonb_typeof(coalesce(r.payload, '{}'::jsonb)) = 'object' then coalesce(r.payload, '{}'::jsonb) else '{}'::jsonb end;
      if trim(coalesce(v_payload->>'schema', '')) <> 'call_mode_v1' then continue; end if;
      v_event_type := lower(trim(coalesce(v_payload->>'call_event_type', '')));
      v_when := coalesce(nullif(trim(coalesce(v_payload->>'occurred_at', '')), ''), nullif(r.created_at::text, ''), nullif(r.inserted_at::text, ''), now()::text);

      v_prospect := case when jsonb_typeof(v_payload->'prospect') = 'object' then v_payload->'prospect' else '{}'::jsonb end;
      v_contact_name := trim(coalesce(v_prospect->>'contact', ''));
      v_contact_phone := trim(coalesce(v_prospect->>'phone', ''));
      v_prospect_id := trim(coalesce(v_prospect->>'id', ''));
      v_contact_updated := coalesce(nullif(trim(coalesce(v_prospect->>'updated_at', '')), ''), v_when);
      if (v_contact_name <> '' or v_contact_phone <> '') and (v_contact_at = '' or v_contact_updated >= v_contact_at) then
        v_contact_at := v_contact_updated;
        v_contact := jsonb_build_object(
          'name', v_contact_name,
          'role', '',
          'email', '',
          'phone', v_contact_phone,
          'source', 'supabase_call_mode',
          'prospect_id', v_prospect_id
        );
      end if;

      v_sales_task := case when jsonb_typeof(v_payload->'sales_task') = 'object' then v_payload->'sales_task' else '{}'::jsonb end;
      v_task_id := trim(coalesce(v_sales_task->>'id', ''));
      if v_task_id <> '' then
        v_task := coalesce(v_sales_map->v_task_id, '{}'::jsonb);
        v_action_type := coalesce(nullif(v_task->>'action_type', ''), 'Call');
        v_tag := coalesce(v_task->>'tag', '');
        v_due_date := coalesce(v_task->>'due_date', '');
        v_done := coalesce((v_task->>'completed')::boolean, false);
        v_deleted := coalesce((v_task->>'deleted')::boolean, false);
        v_completed_at := coalesce(v_task->>'completed_at', '');
        v_created_at := coalesce(nullif(v_task->>'created_at', ''), v_when);
        v_updated_at := coalesce(nullif(v_task->>'updated_at', ''), v_when);
        v_task_contact := coalesce(v_task->>'contact', '');
        v_phone := coalesce(v_task->>'phone', '');

        v_task_contact := coalesce(nullif(trim(coalesce(v_sales_task->>'contact', '')), ''), v_task_contact);
        v_phone := coalesce(nullif(trim(coalesce(v_sales_task->>'phone', '')), ''), v_phone);
        v_action_type := coalesce(nullif(trim(coalesce(v_sales_task->>'action_type', '')), ''), v_action_type);
        if v_sales_task ? 'task_tag' then v_tag := trim(coalesce(v_sales_task->>'task_tag', '')); end if;
        if v_sales_task ? 'due_date' then v_due_date := trim(coalesce(v_sales_task->>'due_date', '')); end if;
        if v_sales_task ? 'completed' then v_done := lower(trim(coalesce(v_sales_task->>'completed', ''))) in ('1','true','yes','done','completed'); end if;
        v_completed_at := coalesce(nullif(trim(coalesce(v_sales_task->>'completed_at', '')), ''), v_completed_at);
        v_updated_at := coalesce(nullif(trim(coalesce(v_sales_task->>'updated_at', '')), ''), v_when, v_updated_at);

        if v_event_type in ('task_deleted', 'prospect_deleted') then
          v_deleted := true;
        elsif v_event_type in ('task_completed', 'queue_closed') then
          v_done := true;
          v_completed_at := coalesce(nullif(v_completed_at, ''), v_when);
        elsif v_event_type in ('task_reopened', 'queue_restored') then
          v_deleted := false;
          v_done := false;
          v_completed_at := '';
        end if;

        v_sales_map := jsonb_set(v_sales_map, array[v_task_id], jsonb_build_object(
          'id', v_task_id,
          'action_type', v_action_type,
          'tag', v_tag,
          'due_date', v_due_date,
          'completed', v_done,
          'deleted', v_deleted,
          'completed_at', v_completed_at,
          'created_at', v_created_at,
          'updated_at', v_updated_at,
          'contact', v_task_contact,
          'phone', v_phone
        ), true);
      end if;

      v_activity := case when jsonb_typeof(v_payload->'activity') = 'object' then v_payload->'activity' else '{}'::jsonb end;
      if v_activity <> '{}'::jsonb then
        v_activity_rows := v_activity_rows || jsonb_build_array(jsonb_build_object(
          'id', coalesce(nullif(trim(coalesce(v_activity->>'id', '')), ''), 'activity-' || coalesce(r.event_id, md5(v_when))),
          'type', coalesce(nullif(trim(coalesce(v_activity->>'activity_type', '')), ''), 'Activity'),
          'title', coalesce(nullif(trim(coalesce(v_activity->>'label', '')), ''), 'Client activity'),
          'created_at', coalesce(nullif(trim(coalesce(v_activity->>'created_at', '')), ''), v_when)
        ));
      end if;
    end loop;

    select coalesce(jsonb_agg(value), '[]'::jsonb)
      into v_focus_rows
      from jsonb_each(v_focus_map)
     where not coalesce((value->>'deleted')::boolean, false);

    select coalesce(jsonb_agg(value), '[]'::jsonb)
      into v_sales_rows
      from jsonb_each(v_sales_map)
     where not coalesce((value->>'deleted')::boolean, false);

    select coalesce(jsonb_agg(value order by coalesce(value->>'created_at', '') desc), '[]'::jsonb)
      into v_activity_rows
      from (
        select value
          from jsonb_array_elements(v_activity_rows)
         order by coalesce(value->>'created_at', '') desc
         limit greatest(1, least(coalesce(p_recent_limit, 40), 100))
      ) recent;

    select s.last_completed_review_date
      into v_review
      from public.company_review_state s
     where s.user_id = v_user and s.company_id = v_company;

    company_id := v_company;
    linked_company := v_company_name;
    focus_tasks := v_focus_rows;
    sales_tasks := v_sales_rows;
    sales_activities := v_activity_rows;
    contact := v_contact;
    last_account_review := v_review;
    synced_at := now();
    return next;
  end loop;
end;
$$;

revoke all on function public.resolve_client_compass_companies(jsonb) from public;
revoke all on function public.client_compass_changed_company_ids(timestamptz, integer) from public;
revoke all on function public.client_compass_current_state(uuid[], integer) from public;

grant execute on function public.resolve_client_compass_companies(jsonb) to authenticated;
grant execute on function public.client_compass_changed_company_ids(timestamptz, integer) to authenticated;
grant execute on function public.client_compass_current_state(uuid[], integer) to authenticated;

commit;

-- Verification: all three Phase 1 RPCs should be visible.
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'resolve_client_compass_companies',
    'client_compass_changed_company_ids',
    'client_compass_current_state'
  )
order by proname;
