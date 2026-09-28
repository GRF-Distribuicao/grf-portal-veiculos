-- Veículos usados pela roteirização em cada dia.
--
-- A roteirização marca na aba Disponibilidade o veículo que usou; ele sai da
-- lista de disponíveis e vai para "Usados", de onde pode voltar se a marcação
-- foi errada (a linha é apagada).
--
-- Tabela própria, e não uma coluna em fleet_availability_items, porque o
-- reenvio do transportador apaga e recria os itens do dia: a marcação se
-- perderia. Aqui ela fica por dia e veículo.
--
-- A marcação não segue o horário de corte: a roteirização trabalha depois das
-- 16:30. Só a equipe GRF grava, pelas funções do servidor (service_role).
-- Transportador não lê nem grava.

create table if not exists public.routing_vehicle_usage (
  id uuid primary key default gen_random_uuid(),
  availability_date date not null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz not null default now(),
  unique (availability_date, vehicle_id)
);

alter table public.routing_vehicle_usage enable row level security;

revoke all on table public.routing_vehicle_usage from public, anon, authenticated;
grant select, insert, delete on table public.routing_vehicle_usage to service_role;
