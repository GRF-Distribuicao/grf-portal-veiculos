-- R2 — VOLTA O BANCO AO ESTADO DE ANTES DO PR #16 (migrações 17, 18 e 19).
--
-- Quando usar: o corte, a obs, o transbordo ou os usados deram problema e a
-- disponibilidade tem que voltar a funcionar como antes do PR #16.
-- Mantém a regra do PR #15 (só cadastro aprovado). Para voltar também o #15,
-- rode depois o R3.
--
-- O que faz: remove os gatilhos e funções criados por 17 e 18. A função
-- submit_fleet_availability e os gatilhos que já existiam não são tocados —
-- eles nunca foram alterados.
--
-- O que NÃO apaga: nenhum dado. As colunas trailer_plate/trailer_pallets e a
-- tabela routing_vehicle_usage ficam, sem efeito no funcionamento antigo.
-- Apagar é opcional (fim do arquivo).
--
-- Ordem com o código: pode rodar antes ou depois de reverter o PR. A tela nova
-- detecta que as funções sumiram e volta ao comportamento antigo.
--
-- Para reaplicar depois: rodar de novo 17, 18 e 19, nessa ordem.

begin;

-- 18 — obs e transbordo
drop trigger if exists trg_validate_availability_vehicle_trailer on public.fleet_availability_items;
drop function if exists public.validate_availability_vehicle_trailer();
drop function if exists public.submit_fleet_availability_items(date, jsonb);

-- 17 — horário de corte
drop trigger if exists trg_enforce_availability_cutoff on public.fleet_availability_submissions;
drop trigger if exists trg_enforce_availability_cutoff on public.fleet_availability_items;
drop function if exists public.enforce_fleet_availability_cutoff();
drop function if exists public.fleet_availability_window();
drop function if exists public.fleet_availability_is_open(date, timestamptz);

-- 19 — usados: nada a desligar. A tabela só é lida pela aba da GRF.

commit;

-- OPCIONAL — APAGA DADOS. Só rode se quiser remover também o que foi gravado
-- (carretas, pallets informados e marcações de usado). Não é necessário para
-- voltar a funcionar como antes.
--
-- drop table if exists public.routing_vehicle_usage;
-- alter table public.fleet_availability_items
--   drop column if exists trailer_plate,
--   drop column if exists trailer_pallets;
