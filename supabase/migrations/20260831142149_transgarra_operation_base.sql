-- Additive migration: no backfill and no reassignment of existing vehicles.
alter table public.vehicle_registrations
  add column if not exists operation_base text,
  add column if not exists operation_base_required boolean not null default false;

alter table public.vehicle_registrations
  add constraint vehicle_registration_operation_base_check
  check (operation_base is null or operation_base in ('PENHA', 'CD TRÊS RIOS'));

comment on column public.vehicle_registrations.operation_base is
  'Base operacional escolhida para o veículo Transgarra e confirmada na aprovação GRF; não é a cidade do transportador.';
comment on column public.vehicle_registrations.operation_base_required is
  'Marcado pelo novo fluxo Transgarra; false preserva a compatibilidade dos protocolos anteriores.';

create or replace function public.apply_transgarra_registration_base()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_doc text;
  v_company_id uuid;
  v_existing_company_id uuid;
  v_company_name text;
begin
  select regexp_replace(coalesce(doc_number, ''), '[^0-9]', '', 'g')
    into v_doc from public.transporters where id = new.transporter_id;
  if v_doc is distinct from '53638584000191' then
    return new;
  end if;

  if new.operation_base_required and new.operation_base is null then
    raise exception 'Base Transgarra: selecione Penha ou CD Três Rios antes de enviar/aprovar.';
  end if;

  -- Protocolos antigos sem escolha explícita permanecem intocados.
  if new.operation_base is null or new.status not in ('APROVADO', 'PRONTO_INTEGRACAO') then
    return new;
  end if;

  if new.vehicle_id is null then
    raise exception 'Base Transgarra: cadastro mestre não encontrado. Contate a GRF.';
  end if;

  -- Serializa decisões concorrentes para o mesmo veículo.
  perform 1 from public.vehicles where id = new.vehicle_id for update;
  v_company_name := case new.operation_base
    when 'PENHA' then 'TRANSGARRA RIO'
    when 'CD TRÊS RIOS' then 'TRANSGARRA TRÊS RIOS'
  end;
  select id into v_company_id from public.transporter_companies
    where active and name = v_company_name;
  if v_company_id is null then
    raise exception 'Base Transgarra: operação não encontrada ou inativa. Contate a GRF.';
  end if;

  select transporter_company_id into v_existing_company_id
    from public.transporter_vehicle_links where vehicle_id = new.vehicle_id and active;
  if v_existing_company_id is not null then
    if v_existing_company_id <> v_company_id then
      raise exception 'Base Transgarra: a escolha conflita com o vínculo atual. Confira a base; nenhum veículo foi transferido.';
    end if;
    return new;
  end if;

  -- O gatilho existente de vehicles faz o vínculo por CNPJ + support_point.
  update public.vehicles set support_point = new.operation_base,
    transporter_name = v_company_name, updated_at = now()
    where id = new.vehicle_id;

  select transporter_company_id into v_existing_company_id
    from public.transporter_vehicle_links where vehicle_id = new.vehicle_id and active;
  if v_existing_company_id is distinct from v_company_id then
    raise exception 'Base Transgarra: não foi possível confirmar o vínculo da operação. A aprovação foi cancelada.';
  end if;
  return new;
end;
$$;

revoke all on function public.apply_transgarra_registration_base() from public, anon, authenticated;
grant execute on function public.apply_transgarra_registration_base() to service_role;

create trigger trg_apply_transgarra_registration_base
after insert or update of status, operation_base, operation_base_required on public.vehicle_registrations
for each row execute function public.apply_transgarra_registration_base();
