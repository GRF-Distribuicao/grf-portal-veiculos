-- Volta o horário de corte de 16:30 (regra da migração 20 e janela da 17).
-- Não toca em envios, veículos nem em outras funções.
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

create or replace function public.fleet_availability_window()
returns table (today date, cutoff_at timestamptz, server_now timestamptz, is_open boolean)
language sql
stable
set search_path = public, pg_temp
as $$
  select d.today,
         (d.today + time '16:30') at time zone 'America/Sao_Paulo',
         now(),
         public.fleet_availability_is_open(d.today)
    from (select (now() at time zone 'America/Sao_Paulo')::date as today) d;
$$;
