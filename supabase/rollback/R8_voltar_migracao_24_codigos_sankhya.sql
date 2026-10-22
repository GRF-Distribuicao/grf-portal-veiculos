-- Desfaz a migração 24: a visão de integração volta à forma da migração 23 e
-- saem as funções e as duas colunas de vehicles. Não toca em outros dados.
drop view if exists public.vw_integracao_veiculos;

create view public.vw_integracao_veiculos as
select v.id as vehicle_id, v.plate, l.transporter_company_id, d.id as driver_id
from public.vehicles v
left join public.transporter_vehicle_links l on l.vehicle_id = v.id and l.active
left join lateral (
  select dr.id from public.vehicle_registrations r
  join public.drivers dr on dr.registration_id = r.id
  where r.vehicle_id = v.id
  order by r.submitted_at desc nulls last, r.created_at desc, dr.created_at desc
  limit 1
) d on true;

revoke all on public.vw_integracao_veiculos from public, anon, authenticated;
grant select on public.vw_integracao_veiculos to service_role;

drop function if exists public.grf_sankhya_tipo_carroceria(text, text);
drop function if exists public.grf_sankhya_tipo_rodado(text);
drop function if exists public.grf_sankhya_key(text);

alter table public.vehicles
  drop column if exists sankhya_tipo_carroceria,
  drop column if exists sankhya_tipo_rodado;
