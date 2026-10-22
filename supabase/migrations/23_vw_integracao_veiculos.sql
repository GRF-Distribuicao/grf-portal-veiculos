-- Visão para a integração com Sankhya e WMS: uma linha por veículo com os três
-- IDs do portal (veículo, transportadora e motorista). A TI faz a ponte com os
-- sistemas no servidor e busca os detalhes nas tabelas de origem.
--
-- Não copia nem altera dados: é montada na hora a partir de vehicles,
-- transporter_vehicle_links (vínculo ativo, no máximo 1 por veículo) e drivers
-- (motorista do cadastro mais recente). Sem vínculo ou sem cadastro, o ID sai
-- vazio. O ID do motorista é por cadastro; a mesma pessoa em dois cadastros
-- tem dois IDs (o CPF em drivers identifica a pessoa).
--
-- Só a integração lê (service_role); transportadoras e público não.
--
-- Para voltar: supabase/rollback/R7_voltar_migracao_23_visao_integracao.sql

create or replace view public.vw_integracao_veiculos as
select
  v.id as vehicle_id,
  v.plate,
  l.transporter_company_id,
  d.id as driver_id
from public.vehicles v
left join public.transporter_vehicle_links l
  on l.vehicle_id = v.id and l.active
left join lateral (
  select dr.id
  from public.vehicle_registrations r
  join public.drivers dr on dr.registration_id = r.id
  where r.vehicle_id = v.id
  order by r.submitted_at desc nulls last, r.created_at desc, dr.created_at desc
  limit 1
) d on true;

revoke all on public.vw_integracao_veiculos from public, anon, authenticated;
grant select on public.vw_integracao_veiculos to service_role;
