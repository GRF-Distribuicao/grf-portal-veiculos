-- Observação por placa e dados do transbordo na disponibilidade diária.
--
-- - Observação: todo veículo informado pode levar uma observação livre (até
--   200 caracteres). A coluna fleet_availability_items.note já existia e nunca
--   foi usada.
-- - Transbordo: cavalo com modelo ou tipo "CARRETA" informa a placa da carreta
--   e a quantidade de pallets, escolhida numa lista de 1 até os pallets do
--   cadastro. Os dois são obrigatórios para esses cavalos e proibidos para os
--   demais.
--
-- O painel de performance não lê estas tabelas e continua usando o cadastro.
--
-- Nada existente é alterado: a função submit_fleet_availability continua como
-- está. A tela passa a usar a função nova submit_fleet_availability_items, que
-- faz o mesmo e grava também os campos novos.

-- 1) Colunas novas, vazias para o histórico.
alter table public.fleet_availability_items
  add column if not exists trailer_plate text,
  add column if not exists trailer_pallets integer;

-- 2) Validação no gatilho: cobre a função e o INSERT direto que a política
--    atual permite. O nome faz ele rodar depois dos gatilhos de dono e de
--    cadastro aprovado.
create or replace function public.validate_availability_vehicle_trailer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plate text;
  v_pallets integer;
  v_transbordo boolean;
begin
  new.note := nullif(btrim(new.note), '');
  if new.note is not null and char_length(new.note) > 200 then
    raise exception 'Observação da placa passa de 200 caracteres.';
  end if;

  new.trailer_plate := nullif(upper(regexp_replace(coalesce(new.trailer_plate, ''), '[^A-Za-z0-9]', '', 'g')), '');

  select v.plate,
         v.pallets,
         upper(coalesce(v.brand_model, '') || ' ' || coalesce(v.vehicle_type, '')) like '%CARRETA%'
    into v_plate, v_pallets, v_transbordo
    from public.vehicles v
   where v.id = new.vehicle_id;

  if not coalesce(v_transbordo, false) then
    if new.trailer_plate is not null or new.trailer_pallets is not null then
      raise exception 'Veículo % não é de transbordo: placa da carreta e pallets não se aplicam.', v_plate;
    end if;
    return new;
  end if;

  if coalesce(new.available, false) = false then
    return new;
  end if;

  if new.trailer_plate is null or new.trailer_pallets is null then
    raise exception 'Cavalo % é de transbordo: informe a placa da carreta e a quantidade de pallets.', v_plate;
  end if;

  if new.trailer_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' then
    raise exception 'Placa da carreta % inválida (cavalo %).', new.trailer_plate, v_plate;
  end if;

  if new.trailer_plate = v_plate then
    raise exception 'A placa da carreta não pode ser a mesma do cavalo %.', v_plate;
  end if;

  if v_pallets is null or v_pallets < 1 then
    raise exception 'O cavalo % está sem quantidade de pallets no cadastro. Fale com a GRF.', v_plate;
  end if;

  if new.trailer_pallets < 1 or new.trailer_pallets > v_pallets then
    raise exception 'Pallets do cavalo % devem ficar entre 1 e %.', v_plate, v_pallets;
  end if;

  if exists (
    select 1
      from public.fleet_availability_items fai
     where fai.submission_id = new.submission_id
       and fai.id <> new.id
       and fai.available
       and fai.trailer_plate = new.trailer_plate
  ) then
    raise exception 'A carreta % foi informada em mais de um cavalo.', new.trailer_plate;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_availability_vehicle_trailer() from public, anon, authenticated;

drop trigger if exists trg_validate_availability_vehicle_trailer on public.fleet_availability_items;
create trigger trg_validate_availability_vehicle_trailer
before insert or update on public.fleet_availability_items
for each row execute function public.validate_availability_vehicle_trailer();

-- 3) Envio com observação e transbordo. Mesmo comportamento de
--    submit_fleet_availability (dono, trava por empresa e dia, retirar tudo
--    apaga o dia, reenvio substitui a lista), com os campos novos.
--    p_items: [{"vehicle_id": uuid, "note": text, "trailer_plate": text, "trailer_pallets": int}]
create or replace function public.submit_fleet_availability_items(
  p_availability_date date,
  p_items jsonb
)
returns table(submission_id uuid, revision integer, available_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_revision integer;
  v_submission_id uuid;
  v_invalid_count integer;
  v_available_count integer;
  v_distinct_count integer;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select tm.transporter_company_id
    into v_company_id
    from public.transporter_memberships tm
   where tm.user_id = v_user_id
     and tm.active = true
   limit 1;

  if v_company_id is null then
    raise exception 'Usuário sem transportadora vinculada.';
  end if;

  if not public.fleet_availability_is_open(p_availability_date) then
    raise exception 'Disponibilidade de % encerrada às 16:30. Depois do horário de corte não é possível alterar.',
      to_char(p_availability_date, 'DD/MM/YYYY');
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Formato de envio inválido.';
  end if;

  select count(*), count(distinct (e->>'vehicle_id'))
    into v_available_count, v_distinct_count
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e;

  if v_available_count <> v_distinct_count then
    raise exception 'O envio contém o mesmo veículo mais de uma vez.';
  end if;

  select count(*)
    into v_invalid_count
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
   where nullif(e->>'vehicle_id', '') is null
      or not exists (
        select 1
          from public.transporter_vehicle_links tvl
         where tvl.transporter_company_id = v_company_id
           and tvl.vehicle_id = (e->>'vehicle_id')::uuid
           and tvl.active = true
      );

  if v_invalid_count > 0 then
    raise exception 'A seleção contém veículo que não pertence à transportadora do usuário.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_company_id::text || ':' || p_availability_date::text));

  -- Sem veículos selecionados = a transportadora retirou a informação do dia.
  if coalesce(v_available_count, 0) = 0 then
    delete from public.fleet_availability_submissions fas
     where fas.transporter_company_id = v_company_id
       and fas.availability_date = p_availability_date;

    return query
    select null::uuid, 1, 0;
    return;
  end if;

  select fas.id, fas.revision
    into v_submission_id, v_revision
    from public.fleet_availability_submissions fas
   where fas.transporter_company_id = v_company_id
     and fas.availability_date = p_availability_date
   order by fas.is_current desc, fas.submitted_at desc, fas.revision desc
   limit 1
   for update;

  if v_submission_id is null then
    v_revision := 1;
    insert into public.fleet_availability_submissions(
      transporter_company_id,
      availability_date,
      revision,
      is_current,
      submitted_by,
      submitted_at,
      note
    ) values (
      v_company_id,
      p_availability_date,
      v_revision,
      true,
      v_user_id,
      now(),
      null
    )
    returning id into v_submission_id;
  else
    update public.fleet_availability_submissions fas
       set is_current = false
     where fas.transporter_company_id = v_company_id
       and fas.availability_date = p_availability_date
       and fas.id <> v_submission_id
       and fas.is_current = true;

    update public.fleet_availability_submissions fas
       set is_current = true,
           submitted_by = v_user_id,
           submitted_at = now(),
           note = null
     where fas.id = v_submission_id;

    delete from public.fleet_availability_items fai
     where fai.submission_id = v_submission_id;
  end if;

  insert into public.fleet_availability_items(submission_id, vehicle_id, available, note, trailer_plate, trailer_pallets)
  select v_submission_id,
         (e->>'vehicle_id')::uuid,
         true,
         e->>'note',
         e->>'trailer_plate',
         (e->>'trailer_pallets')::integer
    from jsonb_array_elements(p_items) e;

  return query
  select v_submission_id, v_revision, v_available_count;
end;
$$;

revoke all on function public.submit_fleet_availability_items(date, jsonb) from public, anon;
grant execute on function public.submit_fleet_availability_items(date, jsonb) to authenticated;
