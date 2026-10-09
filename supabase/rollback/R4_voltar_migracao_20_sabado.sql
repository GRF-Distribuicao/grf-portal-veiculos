-- Volta a regra do dia aberto para a da migração 17: hoje até 16:30 e
-- qualquer data futura aberta. Não apaga nenhuma disponibilidade informada.
create or replace function public.fleet_availability_is_open(p_date date, p_now timestamptz default now())
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_date > (p_now at time zone 'America/Sao_Paulo')::date
      or (
        p_date = (p_now at time zone 'America/Sao_Paulo')::date
        and (p_now at time zone 'America/Sao_Paulo')::time < time '16:30'
      );
$$;
