-- Disponibilidade sem horário de corte (temporário, pedido da GRF em 04/11/2026).
--
-- Antes (migração 20): hoje até 16:30, exceto sábado; e sábado, informado na
-- sexta até 16:30. Agora a mesma regra de datas, sem horário:
-- - hoje, o dia inteiro (até meia-noite), exceto sábado;
-- - sábado, informado na sexta, até o fim da sexta.
-- Dias passados continuam travados.
--
-- Só estas duas funções mudam. Os gatilhos de corte e a função de envio
-- continuam iguais e passam a seguir a regra nova por chamá-las.
-- fleet_availability_window deixa de informar horário de fechamento
-- (cutoff_at nulo), e a tela para de travar pelo relógio.
--
-- Para voltar ao corte de 16:30: supabase/rollback/R9_voltar_migracao_25_horario.sql

create or replace function public.fleet_availability_is_open(p_date date, p_now timestamptz default now())
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select (p_date = (n.local_now)::date and extract(isodow from p_date) <> 6)
      or (extract(isodow from (n.local_now)::date) = 5 and p_date = (n.local_now)::date + 1)
    from (select p_now at time zone 'America/Sao_Paulo' as local_now) n;
$$;

create or replace function public.fleet_availability_window()
returns table (today date, cutoff_at timestamptz, server_now timestamptz, is_open boolean)
language sql
stable
set search_path = public, pg_temp
as $$
  select d.today,
         null::timestamptz,
         now(),
         public.fleet_availability_is_open(d.today)
    from (select (now() at time zone 'America/Sao_Paulo')::date as today) d;
$$;
