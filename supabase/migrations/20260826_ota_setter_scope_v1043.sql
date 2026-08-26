alter table public.company_otas
  add column if not exists set_by text,
  add column if not exists setter_user_id uuid;

comment on column public.company_otas.set_by is
  'Authoritative human-readable person who set the OTA appointment. Separate from assigned tc_name.';
comment on column public.company_otas.setter_user_id is
  'Authenticated user provenance for explicitly owned sets. Null means ownership is not proven.';

create index if not exists company_otas_setter_scope_idx
  on public.company_otas(user_id, setter_user_id, appointment_date)
  where coalesce(tracker_cleared, false) = false;

create or replace function public.ota_performance_public_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner uuid;
begin
  select owner_user_id
  into v_owner
  from public.ota_tracker_share_config
  order by updated_at desc
  limit 1;

  if v_owner is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'OTA performance owner is not configured',
      'generated_at', now(),
      'otas', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'otas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'appointment_date', o.appointment_date,
          'tc_name', nullif(btrim(o.tc_name), ''),
          'is_my_set', coalesce(o.setter_user_id = v_owner, false)
        )
        order by o.appointment_date asc, o.created_at asc
      )
      from public.company_otas o
      where o.user_id = v_owner
        and coalesce(o.tracker_cleared, false) = false
        and o.appointment_date is not null
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.ota_tracker_shared_snapshot(p_share_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_code_hash text := encode(digest(btrim(coalesce(p_share_code, '')), 'sha256'), 'hex');
  v_owner uuid;
begin
  select owner_user_id into v_owner
  from public.ota_tracker_share_config
  where share_code_hash = v_code_hash
  order by updated_at desc
  limit 1;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid team view code');
  end if;

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'display_name', c.display_name,
        'normalized_name', c.normalized_name,
        'status', c.status
      ) order by c.display_name)
      from public.companies c
      where c.user_id = v_owner
        and exists (
          select 1
          from public.company_otas o
          where o.user_id = v_owner
            and o.company_id = c.id
        )
    ), '[]'::jsonb),
    'otas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'company_id', o.company_id,
        'appointment_date', o.appointment_date,
        'appointment_time', o.appointment_time,
        'time_zone', o.time_zone,
        'tc_name', o.tc_name,
        'contact_name', o.contact_name,
        'status', o.status,
        'source', o.source,
        'source_subject', o.source_subject,
        'set_date', o.set_date,
        'set_by', nullif(btrim(o.set_by), ''),
        'is_my_set', coalesce(o.setter_user_id = v_owner, false),
        'quoted', o.quoted,
        'quoted_date', o.quoted_date,
        'tracker_cleared', o.tracker_cleared,
        'tracker_cleared_at', o.tracker_cleared_at,
        'presentation_set', o.presentation_set,
        'presentation_date', o.presentation_date,
        'updated_at', o.updated_at
      ) order by o.appointment_date asc nulls last, o.created_at asc)
      from public.company_otas o
      where o.user_id = v_owner
    ), '[]'::jsonb)
  );
end;
$function$;
