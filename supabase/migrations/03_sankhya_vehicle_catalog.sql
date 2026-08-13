-- Catálogo de referência de veículos já encontrados no Sankhya.
-- Mantido separado de vehicle_registrations para não interferir no fluxo
-- existente de cadastro, análise, aprovação, documentos e protocolos.

create table if not exists public.sankhya_vehicle_catalog (
  plate text primary key,
  sankhya_registered boolean not null default true,
  fleet_status text null,
  operation text null,
  support_point text null,
  transporter_name text null,
  driver_name text null,
  model text null,
  capacity_kg numeric null,
  pallets integer null,
  fleet_vehicle_type text null,
  source_occurrences integer null,
  source_rows text null,
  source_file text not null default 'SANKHYA X CAPACIDADE DA FROTA.xlsx',
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sankhya_vehicle_catalog_plate_format check (plate ~ '^[A-Z0-9]{7}$')
);

grant all on public.sankhya_vehicle_catalog to service_role;
alter table public.sankhya_vehicle_catalog enable row level security;

create index if not exists sankhya_vehicle_catalog_transporter_idx
  on public.sankhya_vehicle_catalog (transporter_name);

create index if not exists sankhya_vehicle_catalog_operation_idx
  on public.sankhya_vehicle_catalog (operation);

comment on table public.sankhya_vehicle_catalog is
  'Catálogo de referência de veículos já localizados no Sankhya, separado dos cadastros enviados pelo Portal GRF.';
