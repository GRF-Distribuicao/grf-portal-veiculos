-- Só veículo com cadastro APROVADO pode ser informado como disponível.
--
-- Regra da GRF: em análise não é aprovado; Sankhya sem complemento não é
-- aprovado; cadastro iniciado e não enviado não é aprovado. Devolvido aparece
-- para o transportador como pendência, mas também não pode ser informado.
--
-- A régua é o status do protocolo, não vehicles.completion_status: o gatilho
-- sync_vehicle_master_from_registration grava EM_ANALISE para PRONTO_INTEGRACAO,
-- que é um estado posterior à aprovação.
--
-- A trava fica num gatilho em fleet_availability_items porque o transportador
-- tem política de INSERT direto nessa tabela, além da função
-- submit_fleet_availability. O gatilho cobre os dois caminhos. Nada existente é
-- alterado: função, gatilhos e políticas atuais continuam como estão.

-- 1) Situação do cadastro de um veículo no portal.
--    APROVADO  -> APROVADO ou PRONTO_INTEGRACAO
--    DEVOLVIDO -> devolvido para correção
--    PENDENTE  -> todo o resto (sem cadastro, em análise, reprovado)
create or replace function public.vehicle_portal_status(p_vehicle_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when r.status in ('APROVADO', 'PRONTO_INTEGRACAO') then 'APROVADO'
           when r.status = 'DEVOLVIDO' then 'DEVOLVIDO'
           else 'PENDENTE'
         end
    from (select 1) as base
    left join lateral (
      select vr.status
        from public.vehicle_registrations vr
       where vr.vehicle_id = p_vehicle_id
       order by vr.updated_at desc, vr.created_at desc
       limit 1
    ) r on true;
$$;

revoke all on function public.vehicle_portal_status(uuid) from public, anon, authenticated;
grant execute on function public.vehicle_portal_status(uuid) to service_role;

-- 2) Situação da frota de quem está logado, para a Área do Transportador.
--    O transportador não lê vehicle_registrations; esta função expõe só o
--    status, e só dos veículos da própria empresa.
create or replace function public.transporter_fleet_status()
returns table (vehicle_id uuid, portal_status text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.vehicle_id, public.vehicle_portal_status(l.vehicle_id)
    from public.transporter_vehicle_links l
    join public.transporter_memberships tm
      on tm.transporter_company_id = l.transporter_company_id
     and tm.user_id = auth.uid()
     and tm.active
   where l.active;
$$;

revoke all on function public.transporter_fleet_status() from public, anon;
grant execute on function public.transporter_fleet_status() to authenticated, service_role;

-- 3) Trava: item disponível só para veículo aprovado.
--    O nome ordena este gatilho depois de trg_validate_availability_vehicle_owner,
--    então veículo de outra empresa continua recebendo a mensagem de dono.
create or replace function public.validate_availability_vehicle_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plate text;
begin
  if coalesce(new.available, false) = false then
    return new;
  end if;

  if public.vehicle_portal_status(new.vehicle_id) = 'APROVADO' then
    return new;
  end if;

  select plate into v_plate from public.vehicles where id = new.vehicle_id;
  raise exception 'Veículo % sem cadastro aprovado pela GRF. Finalize o cadastro para informar disponibilidade.',
    coalesce(v_plate, new.vehicle_id::text);
end;
$$;

revoke all on function public.validate_availability_vehicle_status() from public, anon, authenticated;

drop trigger if exists trg_validate_availability_vehicle_status on public.fleet_availability_items;
create trigger trg_validate_availability_vehicle_status
before insert or update of vehicle_id, available on public.fleet_availability_items
for each row execute function public.validate_availability_vehicle_status();
