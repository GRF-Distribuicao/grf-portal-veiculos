-- Horário de corte da disponibilidade: 16:30, horário de Brasília.
--
-- Regra da GRF: o transportador informa hoje os veículos que carregam hoje e
-- pode alterar até 16:30. Depois disso o dia fica travado para todo mundo
-- (transportador e GRF). Dia anterior também fica travado.
--
-- A trava fica em gatilhos nas duas tabelas porque o transportador grava por
-- dois caminhos: a função de envio e as políticas de INSERT direto que já
-- existem. O gatilho cobre os dois. Nada existente é alterado.
--
-- O relógio é o do banco, não o do computador do transportador.
--
-- A trava vale para toda chamada que chega pelo aplicativo (a API sempre
-- preenche request.jwt.claims: transportador, GRF e service_role). Manutenção
-- feita direto no banco, sem passar pela API, não é bloqueada.

-- 1) O dia ainda aceita alteração? p_now existe só para teste; o padrão é o
--    relógio do banco.
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

revoke all on function public.fleet_availability_is_open(date, timestamptz) from public, anon;
grant execute on function public.fleet_availability_is_open(date, timestamptz) to authenticated, service_role;

-- 2) Janela de hoje, para a tela usar a data e o relógio do banco.
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

revoke all on function public.fleet_availability_window() from public, anon;
grant execute on function public.fleet_availability_window() to authenticated, service_role;

-- 3) Trava nas duas tabelas.
create or replace function public.enforce_fleet_availability_cutoff()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_date date;
  v_submission_id uuid;
begin
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'fleet_availability_submissions' then
    if tg_op in ('UPDATE', 'DELETE') and not public.fleet_availability_is_open(old.availability_date) then
      v_date := old.availability_date;
    elsif tg_op in ('INSERT', 'UPDATE') and not public.fleet_availability_is_open(new.availability_date) then
      v_date := new.availability_date;
    end if;
  else
    foreach v_submission_id in array array_remove(array[
      case when tg_op in ('UPDATE', 'DELETE') then old.submission_id end,
      case when tg_op in ('INSERT', 'UPDATE') then new.submission_id end
    ], null)
    loop
      -- Na exclusão em cascata o envio já saiu e foi conferido no gatilho dele.
      select fas.availability_date into v_date
        from public.fleet_availability_submissions fas
       where fas.id = v_submission_id;
      exit when v_date is not null and not public.fleet_availability_is_open(v_date);
      v_date := null;
    end loop;
  end if;

  if v_date is not null then
    raise exception 'Disponibilidade de % encerrada às 16:30. Depois do horário de corte não é possível alterar.',
      to_char(v_date, 'DD/MM/YYYY');
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_fleet_availability_cutoff() from public, anon, authenticated;

drop trigger if exists trg_enforce_availability_cutoff on public.fleet_availability_submissions;
create trigger trg_enforce_availability_cutoff
before insert or update or delete on public.fleet_availability_submissions
for each row execute function public.enforce_fleet_availability_cutoff();

drop trigger if exists trg_enforce_availability_cutoff on public.fleet_availability_items;
create trigger trg_enforce_availability_cutoff
before insert or update or delete on public.fleet_availability_items
for each row execute function public.enforce_fleet_availability_cutoff();
