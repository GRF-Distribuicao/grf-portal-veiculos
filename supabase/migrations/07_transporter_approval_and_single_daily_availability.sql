create or replace function public.confirm_transporter_email_on_membership()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.active = true then
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now())
     where id = new.user_id
       and email_confirmed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_confirm_transporter_email_on_membership on public.transporter_memberships;
create trigger trg_confirm_transporter_email_on_membership
after insert or update of active on public.transporter_memberships
for each row
execute function public.confirm_transporter_email_on_membership();

update auth.users u
   set email_confirmed_at = coalesce(u.email_confirmed_at, now())
 where u.email_confirmed_at is null
   and exists (
     select 1
       from public.transporter_memberships tm
      where tm.user_id = u.id
        and tm.active = true
   );

create or replace function public.submit_fleet_availability(
  p_availability_date date,
  p_vehicle_ids uuid[],
  p_note text default null
)
returns table(submission_id uuid, revision integer, available_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_revision integer;
  v_submission_id uuid;
  v_invalid_count integer;
  v_available_count integer;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select tm.transporter_company_id
    into v_company_id
    from public.transporter_memberships tm
   where tm.user_id = v_user_id
     and tm.active = true
   limit 1;

  if v_company_id is null then
    raise exception 'Usuário sem transportadora vinculada.';
  end if;

  select count(*)
    into v_invalid_count
    from unnest(coalesce(p_vehicle_ids, array[]::uuid[])) as x(vehicle_id)
   where not exists (
     select 1
       from public.transporter_vehicle_links tvl
      where tvl.transporter_company_id = v_company_id
        and tvl.vehicle_id = x.vehicle_id
        and tvl.active = true
   );

  if v_invalid_count > 0 then
    raise exception 'A seleção contém veículo que não pertence à transportadora do usuário.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_company_id::text || ':' || p_availability_date::text));

  select fas.id, fas.revision
    into v_submission_id, v_revision
    from public.fleet_availability_submissions fas
   where fas.transporter_company_id = v_company_id
     and fas.availability_date = p_availability_date
   order by fas.is_current desc, fas.submitted_at desc, fas.revision desc
   limit 1
   for update;

  if v_submission_id is null then
    v_revision := 1;
    insert into public.fleet_availability_submissions(
      transporter_company_id,
      availability_date,
      revision,
      is_current,
      submitted_by,
      submitted_at,
      note
    ) values (
      v_company_id,
      p_availability_date,
      v_revision,
      true,
      v_user_id,
      now(),
      nullif(btrim(p_note), '')
    )
    returning id into v_submission_id;
  else
    update public.fleet_availability_submissions
       set is_current = false
     where transporter_company_id = v_company_id
       and availability_date = p_availability_date
       and id <> v_submission_id
       and is_current = true;

    update public.fleet_availability_submissions
       set is_current = true,
           submitted_by = v_user_id,
           submitted_at = now(),
           note = nullif(btrim(p_note), '')
     where id = v_submission_id;

    delete from public.fleet_availability_items
     where submission_id = v_submission_id;
  end if;

  insert into public.fleet_availability_items(submission_id, vehicle_id, available)
  select v_submission_id, x.vehicle_id, true
    from (
      select distinct vehicle_id
        from unnest(coalesce(p_vehicle_ids, array[]::uuid[])) as u(vehicle_id)
    ) x;

  select count(distinct vehicle_id)
    into v_available_count
    from unnest(coalesce(p_vehicle_ids, array[]::uuid[])) as u(vehicle_id);

  return query
  select v_submission_id, v_revision, coalesce(v_available_count, 0);
end;
$$;

drop policy if exists fleet_availability_submissions_read_own on public.fleet_availability_submissions;
create policy fleet_availability_submissions_read_own
on public.fleet_availability_submissions
for select
to authenticated
using (
  is_current = true
  and exists (
    select 1
      from public.transporter_memberships tm
     where tm.transporter_company_id = fleet_availability_submissions.transporter_company_id
       and tm.user_id = auth.uid()
       and tm.active = true
  )
);

drop policy if exists fleet_availability_items_read_own on public.fleet_availability_items;
create policy fleet_availability_items_read_own
on public.fleet_availability_items
for select
to authenticated
using (
  exists (
    select 1
      from public.fleet_availability_submissions fas
      join public.transporter_memberships tm
        on tm.transporter_company_id = fas.transporter_company_id
     where fas.id = fleet_availability_items.submission_id
       and fas.is_current = true
       and tm.user_id = auth.uid()
       and tm.active = true
  )
);