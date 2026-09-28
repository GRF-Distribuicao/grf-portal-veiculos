-- R3 — VOLTA O BANCO AO ESTADO DE ANTES DO PR #15 (migração 16).
--
-- Quando usar: a regra "só cadastro aprovado" precisa sair e o transportador
-- volta a poder informar qualquer veículo vinculado, como antes.
--
-- O que faz: remove o gatilho e as 3 funções da migração 16. Não apaga dados.
-- Independe do R2: pode rodar sozinho ou depois dele.
--
-- Ordem com o código: pode rodar antes ou depois de reverter o PR. Com o
-- código do PR #16 no ar, a tela detecta que a função sumiu e mostra toda a
-- frota vinculada, como antes. Com SÓ o código do PR #15 no ar (sem o #16),
-- reverta o código ANTES de rodar este arquivo: a tela do #15 trava o envio
-- se a função não existir.
--
-- Para reaplicar depois: rodar de novo 16.

begin;

drop trigger if exists trg_validate_availability_vehicle_status on public.fleet_availability_items;
drop function if exists public.validate_availability_vehicle_status();
drop function if exists public.transporter_fleet_status();
drop function if exists public.vehicle_portal_status(uuid);

commit;
