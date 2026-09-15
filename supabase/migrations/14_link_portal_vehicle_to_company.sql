-- Veículo cadastrado pelo portal (placa nova) nascia sem transportadora e sem
-- vínculo, ficando invisível na Área do Transportador.
--
-- Causa: sync_vehicle_master_from_registration roda BEFORE INSERT em
-- vehicle_registrations e cria a linha de vehicles sem transporter_name. O
-- gatilho de vínculo (sync_vehicle_transporter_company) sai na primeira linha
-- quando transporter_name é nulo, e nunca mais dispara — nada atualiza esse
-- campo em veículo de portal. Mesmo que disparasse, o cadastro ainda não está
-- gravado nesse instante, então a busca por CNPJ não acharia nada.
--
-- Correção: um gatilho AFTER INSERT em vehicle_registrations, quando o cadastro
-- já está persistido e o CNPJ pode ser lido.

create or replace function public.link_portal_vehicle_to_company()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cnpj text;
  v_company_id uuid;
  v_company_name text;
  v_matches integer;
begin
  if new.vehicle_id is null then
    return null;
  end if;

  -- Nunca mexe em veículo que já pertence a alguém.
  if exists (
    select 1 from public.transporter_vehicle_links
     where vehicle_id = new.vehicle_id and active
  ) then
    return null;
  end if;

  select regexp_replace(coalesce(t.doc_number, ''), '\D', '', 'g')
    into v_cnpj
    from public.transporters t
   where t.id = new.transporter_id;

  if coalesce(v_cnpj, '') = '' then
    return null;
  end if;

  -- TRANSGARRA divide o mesmo CNPJ em duas operações: quem decide é a base,
  -- em apply_transgarra_registration_base. Aqui nunca.
  if v_cnpj = '53638584000191' then
    return null;
  end if;

  select count(*)
    into v_matches
    from public.transporter_companies tc
   where tc.active
     and regexp_replace(coalesce(tc.cnpj, ''), '\D', '', 'g') = v_cnpj;

  -- Sem empresa, ou com mais de uma, não há decisão segura.
  if v_matches <> 1 then
    return null;
  end if;

  select tc.id, tc.name
    into v_company_id, v_company_name
    from public.transporter_companies tc
   where tc.active
     and regexp_replace(coalesce(tc.cnpj, ''), '\D', '', 'g') = v_cnpj;

  if v_company_id is null then
    return null;
  end if;

  insert into public.transporter_vehicle_links
    (transporter_company_id, vehicle_id, active, source, valid_from)
  values
    (v_company_id, new.vehicle_id, true, 'CADASTRO_CNPJ', current_date);

  -- O nome operacional é o da empresa, não a razão social digitada: é ele que
  -- agrupa a frota no painel e no Sankhya. Só preenche quando está vazio, para
  -- não sobrescrever o nome de origem de veículo do Sankhya.
  -- O vínculo acima já existe, então sync_vehicle_transporter_company sai cedo
  -- neste update e não cria duplicata.
  update public.vehicles
     set transporter_name = v_company_name,
         updated_at = now()
   where id = new.vehicle_id
     and coalesce(btrim(transporter_name), '') = '';

  return null;
end;
$$;

revoke all on function public.link_portal_vehicle_to_company() from public, anon, authenticated;
grant execute on function public.link_portal_vehicle_to_company() to service_role;

drop trigger if exists trg_link_portal_vehicle_to_company on public.vehicle_registrations;
create trigger trg_link_portal_vehicle_to_company
after insert or update of vehicle_id, transporter_id on public.vehicle_registrations
for each row execute function public.link_portal_vehicle_to_company();
