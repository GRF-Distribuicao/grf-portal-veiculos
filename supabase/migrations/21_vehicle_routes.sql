-- Rotas que cada veículo conhece, para a roteirização ver na aba
-- Disponibilidade da GRF.
--
-- Tabela própria, ligada ao veículo, e não colunas em vehicles: a importação
-- do cadastro (Sankhya) e os gatilhos de vehicles não tocam aqui, então as
-- rotas não se perdem. Só a GRF lê e grava, pelas funções do servidor
-- (service_role). Transportador não vê.
--
-- all_routes = carrega em todas as rotas (antes "Coringa", "Tudo" ou "Todas").
-- routes     = nomes completos (ex.: "Nova Iguaçu"); a tela abrevia.
--
-- Para voltar: supabase/rollback/R5_voltar_migracao_21_rotas.sql (apaga só
-- esta tabela).

create table if not exists public.vehicle_routes (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  all_routes boolean not null default false,
  routes text[] not null default '{}',
  source text,
  updated_at timestamptz not null default now()
);

alter table public.vehicle_routes enable row level security;

revoke all on table public.vehicle_routes from public, anon, authenticated;
grant select, insert, update, delete on table public.vehicle_routes to service_role;

-- Carga inicial: planilhas da Transgarra Rio (FROTA_ATUALIZADA_15-10) e da
-- Visão (Carros e rotas Visão), padronizadas e conferidas pela GRF em
-- 15/10/2026. Placa que não existir no portal é ignorada.
insert into public.vehicle_routes (vehicle_id, all_routes, routes, source)
select v.id, d.all_routes, d.routes, 'planilha 15/10/2026'
  from (values
  ('KRI8H54', false, array['Guapimirim','Magé','Nilópolis','São João de Meriti','Belford Roxo','Tijuca','Nova Iguaçu','Santa Cruz','Maricá']::text[]),
  ('PXI4B41', false, array['São João de Meriti','Mesquita','Penha','Ilha do Governador','Nilópolis','Madureira','Irajá','Seropédica','Itaguaí','Japeri']::text[]),
  ('QMQ0B11', false, array['Belford Roxo','Nova Iguaçu','Santa Cruz','Magé','Guapimirim']::text[]),
  ('HLP2J69', false, array['Bangu','Méier','Guapimirim','Magé','Tijuca','São Cristóvão','Ilha do Governador']::text[]),
  ('LKR7C39', true, '{}'::text[]),
  ('GTI5I93', false, array['Zona Norte','Duque de Caxias','Belford Roxo','Mesquita']::text[]),
  ('LDX6E94', false, array['Penha','Tijuca','Méier','Madureira','Zona Norte']::text[]),
  ('APH5G93', true, array['Duque de Caxias']::text[]),
  ('DTB4J31', false, array['Zona Oeste','Zona Norte','Baixada']::text[]),
  ('LTH3J31', true, '{}'::text[]),
  ('KUN9D46', true, '{}'::text[]),
  ('LQB1E20', false, array['São Gonçalo']::text[]),
  ('TTV7B77', true, '{}'::text[]),
  ('TTY5B58', true, '{}'::text[]),
  ('KZN3D94', false, array['Zona Norte','Duque de Caxias','Belford Roxo','Mesquita']::text[]),
  ('LQX2167', false, array['Nova Iguaçu','Mesquita','Zona Norte']::text[]),
  ('AOO9C12', false, array['Zona Oeste','Bonsucesso','Penha']::text[]),
  ('DXC0H63', false, array['Zona Norte']::text[]),
  ('KYJ8167', false, array['Baixada','Nova Iguaçu','Penha']::text[]),
  ('LQB9I53', true, array['Mesquita','Zona Oeste']::text[]),
  ('KZD5354', false, array['Penha','Tijuca','Méier','Madureira','Zona Norte']::text[]),
  ('KOP5F16', false, array['Penha','Tijuca','Méier','Madureira','Zona Norte']::text[]),
  ('KWA3A73', false, array['Zona Oeste']::text[]),
  ('AII7C64', false, array['Ilha do Governador','Tijuca','Botafogo','Copacabana']::text[]),
  ('LTH2H15', false, array['São Gonçalo','Itaboraí']::text[]),
  ('KWJ5C18', false, array['Zona Oeste','Méier']::text[]),
  ('DXV2G07', false, array['Zona Oeste','Méier']::text[]),
  ('LOY4E74', false, array['Maricá','Itaboraí','São Gonçalo']::text[]),
  ('KXV7E81', false, array['Baixada']::text[]),
  ('KOM7G49', false, array['São Gonçalo']::text[]),
  ('KWH2E81', false, array['Zona Norte','Zona Oeste','Baixada','Magé']::text[]),
  ('LVC4B85', true, array['Nova Iguaçu']::text[]),
  ('KRK1I02', true, '{}'::text[]),
  ('LQL3F45', true, '{}'::text[]),
  ('LQD8B88', false, array['Penha','Bonsucesso','Ilha do Governador']::text[]),
  ('LMY5G60', true, '{}'::text[]),
  ('KOB0G44', true, array['Zona Oeste']::text[]),
  ('KOX3328', false, array['Baixada','Méier','Penha']::text[]),
  ('LQF5I91', false, array['Duque de Caxias','Magé']::text[]),
  ('EKP4I65', false, array['Zona Norte','Zona Oeste','Baixada']::text[]),
  ('KXF1458', true, '{}'::text[]),
  ('KRU2I47', true, '{}'::text[]),
  ('KVX4I90', true, '{}'::text[]),
  ('LPE5893', true, '{}'::text[]),
  ('HJT6833', false, array['Santa Cruz','Zona Oeste']::text[]),
  ('KYL1J25', false, array['Penha','Bonsucesso','Ilha do Governador']::text[]),
  ('KNV9I76', false, array['Zona Oeste','Seropédica']::text[]),
  ('LPI9D43', true, array['Duque de Caxias']::text[]),
  ('LBP9410', false, array['Duque de Caxias','Magé']::text[]),
  ('KQD3G23', false, array['Baixada','Madureira','Méier','Tijuca']::text[]),
  ('GZG1633', false, array['Itaguaí','Madureira','Pavuna','Seropédica']::text[]),
  ('KPD1C82', true, '{}'::text[]),
  ('LOP9D74', false, array['Itaboraí']::text[]),
  ('KPD1480', false, array['Zona Norte','Zona Oeste','Baixada']::text[]),
  ('KRE2210', false, array['Centro']::text[]),
  ('CVR0153', false, array['Rocinha']::text[]),
  ('KRZ0E44', false, array['Botafogo']::text[]),
  ('DXA7I79', false, array['Centro']::text[]),
  ('LNU8E52', false, array['Botafogo']::text[]),
  ('EOF2C50', false, array['Botafogo']::text[]),
  ('GDB0E09', false, array['Jacarepaguá']::text[]),
  ('LQQ2G32', false, array['Jacarepaguá']::text[]),
  ('LOZ4416', false, array['Copacabana']::text[]),
  ('KLF2I19', false, array['Lagoa']::text[]),
  ('KNO4829', false, array['Barra da Tijuca']::text[]),
  ('KNX9I76', false, array['Campo Grande']::text[]),
  ('LRX6J91', false, array['Barra da Tijuca','Jacarepaguá']::text[]),
  ('KOL5I94', false, array['Centro','Zona Sul']::text[]),
  ('RTB1A50', false, array['Guaratiba']::text[]),
  ('KUC2154', false, array['Recreio','Jacarepaguá']::text[]),
  ('KOM8E93', false, array['Rocinha','Vidigal']::text[]),
  ('MKZ6G45', false, array['Rocinha','Vidigal']::text[]),
  ('PUQ1E21', false, array['Copacabana']::text[]),
  ('KWQ9C53', false, array['Guaratiba','Jacarepaguá','Campo Grande']::text[]),
  ('FHP5D95', false, array['Zona Sul']::text[]),
  ('LPG2303', false, array['Jacarepaguá']::text[])
  ) as d(plate, all_routes, routes)
  join public.vehicles v on v.plate = d.plate
on conflict (vehicle_id) do nothing;
