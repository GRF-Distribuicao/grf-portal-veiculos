-- Disponibilidade de sábado informada na sexta.
--
-- Na sexta a roteirização planeja sábado e segunda. O transportador informa,
-- na sexta, duas listas: a de sexta (data de hoje) e a de sábado (data de
-- amanhã). As duas fecham sexta às 16:30 (horário de Brasília).
--
-- Regra nova do dia aberto:
-- - hoje, até 16:30, exceto sábado (a lista de sábado fecha na sexta);
-- - amanhã, só quando hoje é sexta e amanhã é sábado, até 16:30 de sexta.
-- Qualquer outra data fica fechada (antes, data futura ficava aberta, mas a
-- tela nunca permitiu informar data futura e não há nenhum envio assim).
--
-- Só esta função muda. Gatilho de corte, envio e janela continuam iguais e
-- passam a seguir a regra nova por chamá-la.
-- Para voltar: supabase/rollback/R4_voltar_migracao_20_sabado.sql

create or replace function public.fleet_availability_is_open(p_date date, p_now timestamptz default now())
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select (n.local_now)::time < time '16:30'
     and (
           (p_date = (n.local_now)::date and extract(isodow from p_date) <> 6)
        or (extract(isodow from (n.local_now)::date) = 5 and p_date = (n.local_now)::date + 1)
         )
    from (select p_now at time zone 'America/Sao_Paulo' as local_now) n;
$$;
