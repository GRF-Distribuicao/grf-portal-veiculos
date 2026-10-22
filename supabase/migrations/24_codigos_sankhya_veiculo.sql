-- Tipo de Rodado e Tipo de Carroceria no formato do Sankhya, para a integração
-- ler direto do banco (visão vw_integracao_veiculos), sem planilha.
--
-- 1. Duas colunas opcionais em vehicles, só com os valores das listas do
--    Sankhya. Preenchidas aqui com o que já está no Sankhya (relatório de
--    veículos de 21/10/2026, 330 placas do portal, sem conflito).
-- 2. Funções que convertem as opções do formulário do portal (Truck, Toco, Baú,
--    Sider…) para o código do Sankhya; tipo antigo ou vazio fica sem código.
-- 3. A visão passa a trazer rodado, carroceria e o código do parceiro: usa a
--    coluna gravada e, se vazia, a conversão do veículo ou do cadastro mais
--    recente.
--
-- Nada existente muda: nenhuma tela, gatilho ou dado além das colunas novas.
-- Para voltar: supabase/rollback/R8_voltar_migracao_24_codigos_sankhya.sql

alter table public.vehicles
  add column if not exists sankhya_tipo_rodado text
    check (sankhya_tipo_rodado is null or sankhya_tipo_rodado in ('00-Não Aplicável', '01-Truck', '02-Toco', '03-Cavalo Mecânico', '04-Van', '05-Utilitário', '06-Outros')),
  add column if not exists sankhya_tipo_carroceria text
    check (sankhya_tipo_carroceria is null or sankhya_tipo_carroceria in ('00-Não Aplicável', '01-Aberta', '02-Fechada/Baú', '03-Graneleira', '04-Porta Container', '05-Sider'));

create or replace function public.grf_sankhya_key(value text)
returns text language sql immutable as $$
  select upper(btrim(translate(coalesce(value, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')))
$$;

-- Mesmo mapeamento de src/lib/grf-sankhya-codes.ts (opções do formulário).
create or replace function public.grf_sankhya_tipo_rodado(vehicle_type text)
returns text language sql immutable as $$
  select case public.grf_sankhya_key(vehicle_type)
    when 'TRUCK' then '01-Truck'
    when 'TOCO' then '02-Toco'
    when 'CAVALO MECANICO' then '03-Cavalo Mecânico'
    when 'VAN' then '04-Van'
    when 'UTILITARIO' then '05-Utilitário'
    when 'CARRETA' then '00-Não Aplicável'
    when 'VUC' then '06-Outros'
    when 'BITREM' then '06-Outros'
    when 'RODOTREM' then '06-Outros'
  end
$$;

create or replace function public.grf_sankhya_tipo_carroceria(body_type text, vehicle_type text)
returns text language sql immutable as $$
  select case
    when public.grf_sankhya_key(vehicle_type) = 'CAVALO MECANICO' then '00-Não Aplicável'
    else case public.grf_sankhya_key(body_type)
      when 'CARGA SECA' then '01-Aberta'
      when 'PRANCHA' then '01-Aberta'
      when 'TANQUE' then '01-Aberta'
      when 'BASCULANTE' then '01-Aberta'
      when 'BAU' then '02-Fechada/Baú'
      when 'BAU FRIGORIFICO' then '02-Fechada/Baú'
      when 'GRANELEIRO' then '03-Graneleira'
      when 'PORTA-CONTAINER' then '04-Porta Container'
      when 'SIDER' then '05-Sider'
    end
  end
$$;

update public.vehicles v
set sankhya_tipo_rodado = s.rodado,
    sankhya_tipo_carroceria = s.carroceria
from (values
  ('AII7C64', '05-Utilitário', '00-Não Aplicável'),
  ('AOO9C12', '06-Outros', '02-Fechada/Baú'),
  ('APH5G93', '05-Utilitário', '00-Não Aplicável'),
  ('AQV4B60', '05-Utilitário', '00-Não Aplicável'),
  ('ASB1B67', '05-Utilitário', '00-Não Aplicável'),
  ('ASY1E37', '06-Outros', '02-Fechada/Baú'),
  ('AWG0G22', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('AYW1D03', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('AZU8G57', '04-Van', '02-Fechada/Baú'),
  ('BAP0E21', '05-Utilitário', '00-Não Aplicável'),
  ('BTP0270', '06-Outros', '00-Não Aplicável'),
  ('BUP8C58', '04-Van', '02-Fechada/Baú'),
  ('CHP9C36', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('CPJ5788', '00-Não Aplicável', '02-Fechada/Baú'),
  ('CQW3F29', '06-Outros', '02-Fechada/Baú'),
  ('CUD5I57', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('CVN9C85', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('CVR0153', '02-Toco', '02-Fechada/Baú'),
  ('DBG8E52', '04-Van', '02-Fechada/Baú'),
  ('DFZ2B82', '06-Outros', '02-Fechada/Baú'),
  ('DLL4B83', '06-Outros', '02-Fechada/Baú'),
  ('DQG8C51', '05-Utilitário', '00-Não Aplicável'),
  ('DSA0G20', '05-Utilitário', '00-Não Aplicável'),
  ('DSA8B05', '05-Utilitário', '02-Fechada/Baú'),
  ('DTB4J31', '05-Utilitário', '02-Fechada/Baú'),
  ('DUM6C79', '05-Utilitário', '00-Não Aplicável'),
  ('DXA7I79', '06-Outros', '02-Fechada/Baú'),
  ('DXC0463', '06-Outros', '02-Fechada/Baú'),
  ('DXC0H63', '00-Não Aplicável', '00-Não Aplicável'),
  ('DXV2607', '06-Outros', '02-Fechada/Baú'),
  ('DXV2G07', '05-Utilitário', '02-Fechada/Baú'),
  ('EKP4I65', '05-Utilitário', '00-Não Aplicável'),
  ('ELQ3279', '06-Outros', '02-Fechada/Baú'),
  ('ELW6I37', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('EMI4G65', '02-Toco', '02-Fechada/Baú'),
  ('EMP7B41', '05-Utilitário', '02-Fechada/Baú'),
  ('EOF2C50', '04-Van', '00-Não Aplicável'),
  ('EVB7D03', '05-Utilitário', '00-Não Aplicável'),
  ('FCR0I94', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('FEI3C36', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('FHP5D95', '05-Utilitário', '00-Não Aplicável'),
  ('FLC8A01', '03-Cavalo Mecânico', '05-Sider'),
  ('FLC8A12', '03-Cavalo Mecânico', '05-Sider'),
  ('FMY3G87', '05-Utilitário', '00-Não Aplicável'),
  ('FRO4G04', '06-Outros', '00-Não Aplicável'),
  ('GDB0E09', '05-Utilitário', '02-Fechada/Baú'),
  ('GGB5F06', '05-Utilitário', '00-Não Aplicável'),
  ('GSO6F49', '05-Utilitário', '02-Fechada/Baú'),
  ('GSV8F03', '06-Outros', '02-Fechada/Baú'),
  ('GSV8G63', '06-Outros', '00-Não Aplicável'),
  ('GSW0E00', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('GTI5I93', '06-Outros', '02-Fechada/Baú'),
  ('GUD5B90', '06-Outros', '02-Fechada/Baú'),
  ('GVI4I08', '05-Utilitário', '00-Não Aplicável'),
  ('GYP8383', '02-Toco', '02-Fechada/Baú'),
  ('GZG1633', '02-Toco', '02-Fechada/Baú'),
  ('HCJ2J54', '05-Utilitário', '02-Fechada/Baú'),
  ('HDI1490', '01-Truck', '02-Fechada/Baú'),
  ('HDI7C05', '03-Cavalo Mecânico', '05-Sider'),
  ('HHS2I22', '05-Utilitário', '02-Fechada/Baú'),
  ('HIJ7D42', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('HJF4G77', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('HJL5J40', '05-Utilitário', '02-Fechada/Baú'),
  ('HJS0411', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('HJT6833', '05-Utilitário', '00-Não Aplicável'),
  ('HKW5F97', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('HLP2J69', '04-Van', '02-Fechada/Baú'),
  ('HNX0340', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('IKS3G39', '02-Toco', '02-Fechada/Baú'),
  ('ILV9G09', '03-Cavalo Mecânico', '05-Sider'),
  ('IOR9E47', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('JOA4A14', '03-Cavalo Mecânico', '05-Sider'),
  ('JRF6541', '00-Não Aplicável', '00-Não Aplicável'),
  ('JXB1H62', '01-Truck', '02-Fechada/Baú'),
  ('KDV9B42', '02-Toco', '02-Fechada/Baú'),
  ('KLF2I19', '06-Outros', '00-Não Aplicável'),
  ('KMQ9915', '04-Van', '02-Fechada/Baú'),
  ('KNH8J05', '04-Van', '00-Não Aplicável'),
  ('KNO4829', '06-Outros', '02-Fechada/Baú'),
  ('KNO9D83', '04-Van', '02-Fechada/Baú'),
  ('KNP6039', '02-Toco', '02-Fechada/Baú'),
  ('KNV9I76', '04-Van', '02-Fechada/Baú'),
  ('KNW4A30', '05-Utilitário', '00-Não Aplicável'),
  ('KNX9I76', '04-Van', '02-Fechada/Baú'),
  ('KNZ3632', '02-Toco', '02-Fechada/Baú'),
  ('KOB0G44', '05-Utilitário', '02-Fechada/Baú'),
  ('KOB5E36', '02-Toco', '02-Fechada/Baú'),
  ('KOG0007', '00-Não Aplicável', '00-Não Aplicável'),
  ('KOL5894', '04-Van', '02-Fechada/Baú'),
  ('KOL5I94', '06-Outros', '02-Fechada/Baú'),
  ('KOM7G49', '05-Utilitário', '00-Não Aplicável'),
  ('KOM8E93', '05-Utilitário', '02-Fechada/Baú'),
  ('KOP5F16', '06-Outros', '02-Fechada/Baú'),
  ('KOW5677', '05-Utilitário', '02-Fechada/Baú'),
  ('KOX3328', '05-Utilitário', '00-Não Aplicável'),
  ('KOX4D83', '01-Truck', '02-Fechada/Baú'),
  ('KOY8I01', '05-Utilitário', '02-Fechada/Baú'),
  ('KPB8I00', '06-Outros', '02-Fechada/Baú'),
  ('KPC3D19', '02-Toco', '02-Fechada/Baú'),
  ('KPD1480', '06-Outros', '02-Fechada/Baú'),
  ('KPD1C82', '06-Outros', '02-Fechada/Baú'),
  ('KPL8C77', '01-Truck', '02-Fechada/Baú'),
  ('KPR4G87', '05-Utilitário', '02-Fechada/Baú'),
  ('KPU7F76', '00-Não Aplicável', '00-Não Aplicável'),
  ('KPW8F43', '05-Utilitário', '02-Fechada/Baú'),
  ('KPW8F46', '05-Utilitário', '00-Não Aplicável'),
  ('KQB7243', '02-Toco', '02-Fechada/Baú'),
  ('KQD3G23', '02-Toco', '02-Fechada/Baú'),
  ('KQF8683', '02-Toco', '02-Fechada/Baú'),
  ('KQG1300', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('KQP3F00', '06-Outros', '02-Fechada/Baú'),
  ('KQW7F43', '05-Utilitário', '00-Não Aplicável'),
  ('KQY5I93', '06-Outros', '02-Fechada/Baú'),
  ('KRD5225', '04-Van', '02-Fechada/Baú'),
  ('KRE2210', '04-Van', '02-Fechada/Baú'),
  ('KRE4529', '04-Van', '02-Fechada/Baú'),
  ('KRF2I19', '04-Van', '02-Fechada/Baú'),
  ('KRG0C82', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('KRI8H54', '05-Utilitário', '02-Fechada/Baú'),
  ('KRK0539', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('KRK1I02', '06-Outros', '00-Não Aplicável'),
  ('KRL3J28', '05-Utilitário', '00-Não Aplicável'),
  ('KRL5I63', '06-Outros', '01-Aberta'),
  ('KRN9733', '05-Utilitário', '00-Não Aplicável'),
  ('KRO8D21', '05-Utilitário', '02-Fechada/Baú'),
  ('KRU2I47', '00-Não Aplicável', '02-Fechada/Baú'),
  ('KRZ0E44', '02-Toco', '02-Fechada/Baú'),
  ('KSD0D54', '04-Van', '02-Fechada/Baú'),
  ('KSM7C81', '02-Toco', '02-Fechada/Baú'),
  ('KSQ9177', '06-Outros', '02-Fechada/Baú'),
  ('KSR1429', '04-Van', '02-Fechada/Baú'),
  ('KSV5B13', '06-Outros', '02-Fechada/Baú'),
  ('KTC6H53', '05-Utilitário', '02-Fechada/Baú'),
  ('KTD7B45', '06-Outros', '02-Fechada/Baú'),
  ('KTJ2568', '01-Truck', '02-Fechada/Baú'),
  ('KTK0A33', '02-Toco', '02-Fechada/Baú'),
  ('KTO7F74', '02-Toco', '02-Fechada/Baú'),
  ('KTV0139', '04-Van', '02-Fechada/Baú'),
  ('KTZ4688', '06-Outros', '02-Fechada/Baú'),
  ('KUC2154', '06-Outros', '02-Fechada/Baú'),
  ('KUN9D46', '05-Utilitário', '00-Não Aplicável'),
  ('KUP1J37', '04-Van', '02-Fechada/Baú'),
  ('KUQ7193', '05-Utilitário', '00-Não Aplicável'),
  ('KVI4I41', '05-Utilitário', '02-Fechada/Baú'),
  ('KVM3G99', '05-Utilitário', '00-Não Aplicável'),
  ('KVP3857', '05-Utilitário', '00-Não Aplicável'),
  ('KVP4J14', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('KVU8286', '02-Toco', '02-Fechada/Baú'),
  ('KVX2B16', '00-Não Aplicável', '00-Não Aplicável'),
  ('KVX4I90', '06-Outros', '00-Não Aplicável'),
  ('KVZ2B61', '06-Outros', '00-Não Aplicável'),
  ('KWA3A73', '05-Utilitário', '00-Não Aplicável'),
  ('KWH2E81', '05-Utilitário', '00-Não Aplicável'),
  ('KWJ5C18', '05-Utilitário', '02-Fechada/Baú'),
  ('KWK9E80', '02-Toco', '02-Fechada/Baú'),
  ('KWN1580', '05-Utilitário', '00-Não Aplicável'),
  ('KWN7H48', '06-Outros', '02-Fechada/Baú'),
  ('KWQ9C53', '05-Utilitário', '02-Fechada/Baú'),
  ('KWR3037', '00-Não Aplicável', '00-Não Aplicável'),
  ('KWY2I14', '05-Utilitário', '00-Não Aplicável'),
  ('KXE0365', '02-Toco', '02-Fechada/Baú'),
  ('KXF1458', '05-Utilitário', '02-Fechada/Baú'),
  ('KXG4154', '05-Utilitário', '02-Fechada/Baú'),
  ('KXV7E81', '05-Utilitário', '00-Não Aplicável'),
  ('KYG9099', '02-Toco', '02-Fechada/Baú'),
  ('KYI0E85', '05-Utilitário', '00-Não Aplicável'),
  ('KYI3A27', '05-Utilitário', '00-Não Aplicável'),
  ('KYI4E26', '05-Utilitário', '00-Não Aplicável'),
  ('KYJ8167', '06-Outros', '02-Fechada/Baú'),
  ('KYL1J25', '05-Utilitário', '00-Não Aplicável'),
  ('KZC4C29', '05-Utilitário', '00-Não Aplicável'),
  ('KZD5354', '05-Utilitário', '02-Fechada/Baú'),
  ('KZL4J44', '05-Utilitário', '00-Não Aplicável'),
  ('KZN3D94', '04-Van', '02-Fechada/Baú'),
  ('KZX4F75', '05-Utilitário', '02-Fechada/Baú'),
  ('KZY6J82', '05-Utilitário', '00-Não Aplicável'),
  ('LAL6164', '06-Outros', '02-Fechada/Baú'),
  ('LBP9410', '02-Toco', '02-Fechada/Baú'),
  ('LBT1H95', '02-Toco', '02-Fechada/Baú'),
  ('LCC1F07', '04-Van', '02-Fechada/Baú'),
  ('LCK5E23', '04-Van', '02-Fechada/Baú'),
  ('LCY4H97', '06-Outros', '02-Fechada/Baú'),
  ('LDX6E94', '05-Utilitário', '02-Fechada/Baú'),
  ('LEQ5510', '06-Outros', '02-Fechada/Baú'),
  ('LGB8790', '02-Toco', '02-Fechada/Baú'),
  ('LIY4D44', '05-Utilitário', '00-Não Aplicável'),
  ('LJZ8453', '00-Não Aplicável', '02-Fechada/Baú'),
  ('LKD1739', '06-Outros', '02-Fechada/Baú'),
  ('LKO1G56', '06-Outros', '02-Fechada/Baú'),
  ('LKQ7I12', '05-Utilitário', '02-Fechada/Baú'),
  ('LKR7C39', '05-Utilitário', '00-Não Aplicável'),
  ('LKT8B47', '04-Van', '00-Não Aplicável'),
  ('LLD6479', '05-Utilitário', '02-Fechada/Baú'),
  ('LLF3I27', '05-Utilitário', '02-Fechada/Baú'),
  ('LLK6I58', '06-Outros', '02-Fechada/Baú'),
  ('LLW2I65', '05-Utilitário', '02-Fechada/Baú'),
  ('LLZ6J39', '05-Utilitário', '02-Fechada/Baú'),
  ('LMW8A60', '00-Não Aplicável', '01-Aberta'),
  ('LMY5G60', '05-Utilitário', '02-Fechada/Baú'),
  ('LNK2B68', '05-Utilitário', '00-Não Aplicável'),
  ('LNN2F96', '06-Outros', '02-Fechada/Baú'),
  ('LNU8E52', '00-Não Aplicável', '00-Não Aplicável'),
  ('LNZ4H37', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('LOI7D83', '06-Outros', '02-Fechada/Baú'),
  ('LOP9D74', '06-Outros', '02-Fechada/Baú'),
  ('LOW6C23', '05-Utilitário', '02-Fechada/Baú'),
  ('LOW9I70', '01-Truck', '02-Fechada/Baú'),
  ('LOY4E74', '05-Utilitário', '00-Não Aplicável'),
  ('LOZ4416', '04-Van', '02-Fechada/Baú'),
  ('LPB1B28', '00-Não Aplicável', '00-Não Aplicável'),
  ('LPD2H78', '05-Utilitário', '00-Não Aplicável'),
  ('LPE5893', '00-Não Aplicável', '00-Não Aplicável'),
  ('LPG2303', '06-Outros', '02-Fechada/Baú'),
  ('LPH5B65', '02-Toco', '00-Não Aplicável'),
  ('LPI9D43', '06-Outros', '02-Fechada/Baú'),
  ('LPX1F70', '05-Utilitário', '00-Não Aplicável'),
  ('LPZ5H83', '05-Utilitário', '02-Fechada/Baú'),
  ('LQB1E20', '05-Utilitário', '00-Não Aplicável'),
  ('LQB9I53', '06-Outros', '02-Fechada/Baú'),
  ('LQD7A21', '02-Toco', '02-Fechada/Baú'),
  ('LQD8B88', '04-Van', '02-Fechada/Baú'),
  ('LQD8D27', '06-Outros', '02-Fechada/Baú'),
  ('LQD8D88', '04-Van', '02-Fechada/Baú'),
  ('LQF5I91', '05-Utilitário', '02-Fechada/Baú'),
  ('LQL3F45', '06-Outros', '00-Não Aplicável'),
  ('LQM7C99', '02-Toco', '02-Fechada/Baú'),
  ('LQN2E87', '00-Não Aplicável', '00-Não Aplicável'),
  ('LQQ2G32', '04-Van', '02-Fechada/Baú'),
  ('LQT3F23', '04-Van', '02-Fechada/Baú'),
  ('LQX2167', '06-Outros', '02-Fechada/Baú'),
  ('LRG4J38', '04-Van', '02-Fechada/Baú'),
  ('LRH9E15', '02-Toco', '02-Fechada/Baú'),
  ('LRI3747', '05-Utilitário', '00-Não Aplicável'),
  ('LRJ4H90', '02-Toco', '02-Fechada/Baú'),
  ('LRM8C22', '05-Utilitário', '00-Não Aplicável'),
  ('LRQ8G51', '02-Toco', '02-Fechada/Baú'),
  ('LRX6J91', '06-Outros', '02-Fechada/Baú'),
  ('LSB2J94', '05-Utilitário', '02-Fechada/Baú'),
  ('LTB4F07', '01-Truck', '02-Fechada/Baú'),
  ('LTB4I22', '02-Toco', '02-Fechada/Baú'),
  ('LTF2G40', '05-Utilitário', '02-Fechada/Baú'),
  ('LTG1259', '02-Toco', '02-Fechada/Baú'),
  ('LTH2H15', '05-Utilitário', '00-Não Aplicável'),
  ('LTH3J31', '05-Utilitário', '02-Fechada/Baú'),
  ('LTO7G76', '06-Outros', '02-Fechada/Baú'),
  ('LTW5H73', '02-Toco', '02-Fechada/Baú'),
  ('LTY1B05', '05-Utilitário', '00-Não Aplicável'),
  ('LUY6I63', '06-Outros', '02-Fechada/Baú'),
  ('LUZ3I88', '04-Van', '02-Fechada/Baú'),
  ('LVC4B85', '05-Utilitário', '00-Não Aplicável'),
  ('MFC1B05', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('MKZ6G45', '05-Utilitário', '02-Fechada/Baú'),
  ('MQK6E77', '06-Outros', '02-Fechada/Baú'),
  ('MQL5G64', '06-Outros', '02-Fechada/Baú'),
  ('MQM9546', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('MQY4C53', '05-Utilitário', '02-Fechada/Baú'),
  ('MRK9B97', '02-Toco', '02-Fechada/Baú'),
  ('MSC2G30', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('MTH4547', '02-Toco', '02-Fechada/Baú'),
  ('MTM8I08', '06-Outros', '02-Fechada/Baú'),
  ('MTS8E28', '04-Van', '02-Fechada/Baú'),
  ('NXZ6373', '06-Outros', '02-Fechada/Baú'),
  ('ODJ9B29', '01-Truck', '05-Sider'),
  ('OET3C37', '06-Outros', '02-Fechada/Baú'),
  ('OOY5D54', '05-Utilitário', '02-Fechada/Baú'),
  ('OPZ2J43', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('PTJ2H84', '02-Toco', '02-Fechada/Baú'),
  ('PUQ1E21', '05-Utilitário', '02-Fechada/Baú'),
  ('PXI4B41', '04-Van', '02-Fechada/Baú'),
  ('PYM4I42', '05-Utilitário', '00-Não Aplicável'),
  ('PYO5J75', '04-Van', '02-Fechada/Baú'),
  ('PYS4J67', '05-Utilitário', '02-Fechada/Baú'),
  ('PZF6I87', '01-Truck', '02-Fechada/Baú'),
  ('PZN2626', '02-Toco', '02-Fechada/Baú'),
  ('QMQ0B11', '05-Utilitário', '02-Fechada/Baú'),
  ('QNE5E13', '05-Utilitário', '02-Fechada/Baú'),
  ('QNR4B69', '05-Utilitário', '02-Fechada/Baú'),
  ('QPI6J53', '05-Utilitário', '00-Não Aplicável'),
  ('QRF8J97', '00-Não Aplicável', '00-Não Aplicável'),
  ('QUI9D81', '00-Não Aplicável', '00-Não Aplicável'),
  ('QUR6A65', '05-Utilitário', '02-Fechada/Baú'),
  ('RFG8B30', '06-Outros', '02-Fechada/Baú'),
  ('RFZ9B22', '05-Utilitário', '00-Não Aplicável'),
  ('RIR4I50', '06-Outros', '02-Fechada/Baú'),
  ('RJF1J52', '05-Utilitário', '00-Não Aplicável'),
  ('RJI6G45', '05-Utilitário', '02-Fechada/Baú'),
  ('RJN4I58', '01-Truck', '02-Fechada/Baú'),
  ('RKC5B02', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('RKS1000', '05-Utilitário', '02-Fechada/Baú'),
  ('RKS2000', '05-Utilitário', '02-Fechada/Baú'),
  ('RKS3000', '05-Utilitário', '02-Fechada/Baú'),
  ('RKS4000', '05-Utilitário', '02-Fechada/Baú'),
  ('RKS4E10', '06-Outros', '02-Fechada/Baú'),
  ('RKS5000', '05-Utilitário', '02-Fechada/Baú'),
  ('RKS6000', '05-Utilitário', '02-Fechada/Baú'),
  ('RKS6J17', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('RMZ1B06', '05-Utilitário', '00-Não Aplicável'),
  ('RMZ6C29', '05-Utilitário', '00-Não Aplicável'),
  ('RNT7E57', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('RTB1A50', '05-Utilitário', '00-Não Aplicável'),
  ('RUT4A13', '05-Utilitário', '02-Fechada/Baú'),
  ('RVH5G84', '05-Utilitário', '00-Não Aplicável'),
  ('SHY4H49', '00-Não Aplicável', '00-Não Aplicável'),
  ('SIB2A07', '05-Utilitário', '02-Fechada/Baú'),
  ('SRC9E11', '06-Outros', '02-Fechada/Baú'),
  ('SRT0H71', '06-Outros', '02-Fechada/Baú'),
  ('SRW7C49', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('SSA9J27', '01-Truck', '02-Fechada/Baú'),
  ('SYE1F59', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('TTA3C51', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('TTA6E30', '01-Truck', '02-Fechada/Baú'),
  ('TTB0F00', '06-Outros', '02-Fechada/Baú'),
  ('TTB3D13', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('TTE5E07', '05-Utilitário', '02-Fechada/Baú'),
  ('TTK8B31', '06-Outros', '02-Fechada/Baú'),
  ('TTP8D77', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('TTR7A97', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('TTR9I07', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('TTS6H24', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('TTU6F63', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('TTV7B77', '05-Utilitário', '02-Fechada/Baú'),
  ('TTW8F31', '02-Toco', '02-Fechada/Baú'),
  ('TTY5B58', '05-Utilitário', '01-Aberta'),
  ('TUF3C32', '06-Outros', '02-Fechada/Baú'),
  ('TUJ7C86', '01-Truck', '02-Fechada/Baú'),
  ('TUL1H52', '03-Cavalo Mecânico', '02-Fechada/Baú'),
  ('TUN3D84', '01-Truck', '02-Fechada/Baú'),
  ('TUP5B41', '05-Utilitário', '02-Fechada/Baú'),
  ('TUQ2E75', '03-Cavalo Mecânico', '00-Não Aplicável'),
  ('TYZ0I65', '03-Cavalo Mecânico', '02-Fechada/Baú')
) as s(plate, rodado, carroceria)
where v.plate = s.plate
  and v.sankhya_tipo_rodado is null
  and v.sankhya_tipo_carroceria is null;

create or replace view public.vw_integracao_veiculos as
select
  v.id as vehicle_id,
  v.plate,
  l.transporter_company_id,
  d.id as driver_id,
  coalesce(v.sankhya_tipo_rodado,
           public.grf_sankhya_tipo_rodado(v.vehicle_type),
           public.grf_sankhya_tipo_rodado(lr.vehicle_type)) as sankhya_tipo_rodado,
  coalesce(v.sankhya_tipo_carroceria,
           public.grf_sankhya_tipo_carroceria(v.body_type, v.vehicle_type),
           public.grf_sankhya_tipo_carroceria(lr.body_type, lr.vehicle_type)) as sankhya_tipo_carroceria,
  c.sankhya_codparc
from public.vehicles v
left join public.transporter_vehicle_links l
  on l.vehicle_id = v.id and l.active
left join public.transporter_companies c
  on c.id = l.transporter_company_id
left join lateral (
  select dr.id
  from public.vehicle_registrations r
  join public.drivers dr on dr.registration_id = r.id
  where r.vehicle_id = v.id
  order by r.submitted_at desc nulls last, r.created_at desc, dr.created_at desc
  limit 1
) d on true
left join lateral (
  select r.vehicle_type, r.body_type
  from public.vehicle_registrations r
  where r.vehicle_id = v.id
  order by r.submitted_at desc nulls last, r.created_at desc
  limit 1
) lr on true;

revoke all on public.vw_integracao_veiculos from public, anon, authenticated;
grant select on public.vw_integracao_veiculos to service_role;
