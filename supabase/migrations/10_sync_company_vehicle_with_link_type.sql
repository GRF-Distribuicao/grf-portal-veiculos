create or replace function public.set_company_vehicle_from_link_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_type text;
begin
  select t.link_type into v_link_type
  from public.transporters t
  where t.id = new.transporter_id;

  new.company_vehicle := (coalesce(v_link_type, '') = 'Frota própria');
  return new;
end;
$$;

drop trigger if exists trg_set_company_vehicle_from_link_type on public.vehicle_registrations;
create trigger trg_set_company_vehicle_from_link_type
before insert or update of transporter_id, company_vehicle on public.vehicle_registrations
for each row
execute function public.set_company_vehicle_from_link_type();

create or replace function public.sync_master_company_vehicle_from_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vehicle_id is not null then
    update public.vehicles
       set company_vehicle = new.company_vehicle,
           updated_at = now()
     where id = new.vehicle_id
       and company_vehicle is distinct from new.company_vehicle;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_master_company_vehicle on public.vehicle_registrations;
create trigger trg_sync_master_company_vehicle
after insert or update of company_vehicle, vehicle_id on public.vehicle_registrations
for each row
execute function public.sync_master_company_vehicle_from_registration();

create or replace function public.sync_registrations_after_link_type_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.link_type is distinct from old.link_type then
    update public.vehicle_registrations
       set company_vehicle = (coalesce(new.link_type, '') = 'Frota própria')
     where transporter_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_registrations_after_link_type_change on public.transporters;
create trigger trg_sync_registrations_after_link_type_change
after update of link_type on public.transporters
for each row
execute function public.sync_registrations_after_link_type_change();

update public.vehicle_registrations vr
set company_vehicle = (coalesce(t.link_type, '') = 'Frota própria')
from public.transporters t
where t.id = vr.transporter_id
  and vr.company_vehicle is distinct from (coalesce(t.link_type, '') = 'Frota própria');

update public.vehicles v
set company_vehicle = vr.company_vehicle,
    updated_at = now()
from public.vehicle_registrations vr
where vr.vehicle_id = v.id
  and v.company_vehicle is distinct from vr.company_vehicle;
