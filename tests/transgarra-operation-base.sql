-- Run inside a transaction and ROLLBACK: fixtures never persist.
do $$
declare
  t uuid;
  r uuid;
  v uuid;
  rio uuid;
  tres uuid;
  link_before uuid;
begin
  if exists(select 1 from public.vehicles where plate in ('ZZT0A01','ZZT0A02','ZZT0A03','ZZT0A04')) then
    raise exception 'Test fixture plates already exist; aborting.';
  end if;
  select id into rio from public.transporter_companies where name='TRANSGARRA RIO' and active;
  select id into tres from public.transporter_companies where name='TRANSGARRA TRÊS RIOS' and active;
  if rio is null or tres is null then raise exception 'Missing operations'; end if;

  insert into public.transporters(name,doc_type,doc_number,phone,email,city,uf,link_type)
    values('TESTE TRANSGARRA','CNPJ','53.638.584/0001-91','24999999999','','TRÊS RIOS','RJ','Agregado') returning id into t;

  -- Rio: no premature link; approval uses the selected base, not company address.
  insert into public.vehicle_registrations(protocol,transporter_id,plate,status,operation_base,operation_base_required)
    values('TESTE-BASE-RIO',t,'ZZT0A01','AGUARDANDO_ANALISE','PENHA',true) returning id,vehicle_id into r,v;
  if exists(select 1 from public.transporter_vehicle_links where vehicle_id=v and active) then raise exception 'Premature link'; end if;
  update public.vehicle_registrations set status='APROVADO' where id=r;
  if not exists(select 1 from public.transporter_vehicle_links where vehicle_id=v and transporter_company_id=rio and active) then raise exception 'Rio routing failed'; end if;
  if not exists(select 1 from public.vehicles where id=v and support_point='PENHA') then raise exception 'Base not copied'; end if;
  select id into link_before from public.transporter_vehicle_links where vehicle_id=v and active;

  -- Conflicting approval is atomic and cannot transfer or change the original base.
  begin
    update public.vehicle_registrations set operation_base='CD TRÊS RIOS',status='APROVADO' where id=r;
    raise exception 'Expected conflicting link rejection';
  exception when raise_exception then
    if sqlerrm not like 'Base Transgarra: a escolha conflita%' then raise; end if;
  end;
  if not exists(select 1 from public.transporter_vehicle_links where id=link_before and active) then raise exception 'Existing link changed'; end if;
  if not exists(select 1 from public.vehicle_registrations where id=r and operation_base='PENHA') then raise exception 'Conflict did not roll back'; end if;
  update public.vehicle_registrations set status='APROVADO' where id=r;
  if (select count(*) from public.transporter_vehicle_links where vehicle_id=v and active) <> 1 then raise exception 'Duplicate link'; end if;

  -- GRF may correct the choice before the first approval.
  insert into public.vehicle_registrations(protocol,transporter_id,plate,status,operation_base,operation_base_required)
    values('TESTE-BASE-TRES',t,'ZZT0A02','AGUARDANDO_ANALISE','PENHA',true) returning id,vehicle_id into r,v;
  update public.vehicle_registrations set status='APROVADO',operation_base='CD TRÊS RIOS' where id=r;
  if not exists(select 1 from public.transporter_vehicle_links where vehicle_id=v and transporter_company_id=tres and active) then raise exception 'Tres Rios routing failed'; end if;

  -- Missing base on new flow rejected, including the master insert (same transaction).
  begin
    insert into public.vehicle_registrations(protocol,transporter_id,plate,status,operation_base_required)
      values('TESTE-BASE-MISSING',t,'ZZT0A03','AGUARDANDO_ANALISE',true);
    raise exception 'Expected missing base rejection';
  exception when raise_exception then
    if sqlerrm not like 'Base Transgarra: selecione%' then raise; end if;
  end;
  if exists(select 1 from public.vehicles where plate='ZZT0A03') then raise exception 'Orphan master'; end if;

  -- Legacy protocol remains compatible without base.
  insert into public.vehicle_registrations(protocol,transporter_id,plate,status)
    values('TESTE-BASE-LEGACY',t,'ZZT0A03','AGUARDANDO_ANALISE') returning id into r;
  update public.vehicle_registrations set status='APROVADO' where id=r;

  -- Another CNPJ remains unchanged.
  insert into public.transporters(name,doc_type,doc_number,phone,email,city,uf,link_type)
    values('TESTE OUTRA','CNPJ','00.000.000/0000-00','24999999999','','TRÊS RIOS','RJ','Agregado') returning id into t;
  insert into public.vehicle_registrations(protocol,transporter_id,plate,status)
    values('TESTE-BASE-OTHER',t,'ZZT0A04','AGUARDANDO_ANALISE') returning id,vehicle_id into r,v;
  update public.vehicle_registrations set status='APROVADO' where id=r;
  if exists(select 1 from public.transporter_vehicle_links where vehicle_id=v and transporter_company_id in (rio,tres) and active) then raise exception 'Other carrier affected'; end if;
end;
$$;
select 'PASS: Rio, Três Rios, correction before approval, missing base, legacy, unrelated carrier, link preservation, repeated approval' as test_result;
