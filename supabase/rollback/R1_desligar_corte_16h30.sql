-- R1 — DESLIGA SÓ O HORÁRIO DE CORTE DAS 16:30 (migração 17).
--
-- Quando usar: o corte está travando quem não devia e é preciso liberar agora.
-- O que faz: tira as duas travas e faz o banco responder "sempre aberto".
-- O que NÃO mexe: obs, transbordo, cadastro aprovado, usados e todos os dados.
-- A tela nova deixa de mostrar "encerrada" sozinha (não precisa novo deploy).
--
-- Para religar o corte depois: rodar de novo 17_availability_cutoff.sql.

begin;

drop trigger if exists trg_enforce_availability_cutoff on public.fleet_availability_submissions;
drop trigger if exists trg_enforce_availability_cutoff on public.fleet_availability_items;

create or replace function public.fleet_availability_is_open(p_date date, p_now timestamptz default now())
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select true;
$$;

create or replace function public.fleet_availability_window()
returns table (today date, cutoff_at timestamptz, server_now timestamptz, is_open boolean)
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'America/Sao_Paulo')::date, null::timestamptz, now(), true;
$$;

commit;
