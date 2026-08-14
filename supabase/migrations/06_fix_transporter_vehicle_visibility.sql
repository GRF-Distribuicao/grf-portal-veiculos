-- Corrige a visibilidade da frota na Área do Transportador.
-- O usuário autenticado só pode visualizar veículos vinculados à sua própria transportadora.

create or replace function public.current_transporter_can_view_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.transporter_memberships tm
    join public.transporter_vehicle_links tvl
      on tvl.transporter_company_id = tm.transporter_company_id
    where tm.user_id = auth.uid()
      and tm.active = true
      and tvl.active = true
      and tvl.vehicle_id = p_vehicle_id
  );
$$;

revoke all on function public.current_transporter_can_view_vehicle(uuid) from public;
grant execute on function public.current_transporter_can_view_vehicle(uuid) to authenticated;

grant select on table public.vehicles to authenticated;

drop policy if exists vehicles_read_linked_transporter on public.vehicles;
create policy vehicles_read_linked_transporter
on public.vehicles
for select
to authenticated
using (public.current_transporter_can_view_vehicle(id));
