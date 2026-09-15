-- Reparo retroativo dos veículos que nasceram órfãos antes do gatilho da
-- migração 14. Idempotente: pode rodar de novo sem duplicar nada.
--
-- Já foi aplicado manualmente no RJ em 15/09/2026 (11 vínculos). Fica aqui
-- para o banco poder ser reconstruído do zero e para registro do que foi feito.

-- 1) Vínculo pelo CNPJ do cadastro, com as mesmas travas do gatilho:
--    um único CNPJ entre os cadastros, uma única empresa ativa com esse CNPJ,
--    nunca TRANSGARRA (a base decide), nunca veículo que já tem vínculo ativo.
with candidato as (
  select v.id as vehicle_id,
         min(regexp_replace(t.doc_number, '\D', '', 'g')) as cnpj,
         count(distinct regexp_replace(t.doc_number, '\D', '', 'g')) as cnpjs
    from public.vehicles v
    join public.vehicle_registrations r on r.vehicle_id = v.id
    join public.transporters t on t.id = r.transporter_id
   where not exists (
           select 1 from public.transporter_vehicle_links l
            where l.vehicle_id = v.id and l.active
         )
   group by v.id
), alvo as (
  select c.vehicle_id, emp.id as company_id
    from candidato c
    join lateral (
      select tc.id, count(*) over () as qtd
        from public.transporter_companies tc
       where tc.active
         and regexp_replace(coalesce(tc.cnpj, ''), '\D', '', 'g') = c.cnpj
    ) emp on emp.qtd = 1
   where c.cnpjs = 1
     and c.cnpj <> '53638584000191'
     and c.cnpj <> ''
)
insert into public.transporter_vehicle_links
  (transporter_company_id, vehicle_id, active, source, valid_from)
select a.company_id, a.vehicle_id, true, 'CADASTRO_CNPJ', current_date
  from alvo a;

-- 2) Nome operacional a partir da empresa vinculada — nunca da razão social
--    digitada, e nunca sobrescrevendo um nome que já existe.
update public.vehicles v
   set transporter_name = c.name,
       updated_at = now()
  from public.transporter_vehicle_links l
  join public.transporter_companies c on c.id = l.transporter_company_id
 where l.vehicle_id = v.id
   and l.active
   and coalesce(btrim(v.transporter_name), '') = '';
