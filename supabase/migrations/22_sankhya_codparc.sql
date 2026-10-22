-- Código do parceiro no Sankhya (CODPARC) de cada transportadora, para a
-- integração preencher "Parceiro ou Empresa" dos veículos NOVOS. No Sankhya o
-- parceiro do veículo é a própria transportadora.
--
-- Coluna opcional: nada que já existe muda. Veículos já cadastrados no Sankhya
-- não são tocados.
--
-- Códigos conferidos pela GRF em 22/10/2026 contra o relatório de veículos do
-- Sankhya (cruzamento por placa). Transgarra Rio e Três Rios são o mesmo
-- parceiro no Sankhya; só o portal separa.
--
-- Para voltar: supabase/rollback/R6_voltar_migracao_22_codparc.sql (remove só
-- esta coluna).

alter table public.transporter_companies
  add column if not exists sankhya_codparc integer
  check (sankhya_codparc is null or sankhya_codparc > 0);

update public.transporter_companies c
set sankhya_codparc = d.codparc
from (values
  ('fb0bbb75-b8cf-4627-bf16-c248f141314e'::uuid, 174824), -- AC TRANSPORTES
  ('5828a685-3974-426e-a644-e3c757881cdd'::uuid, 145984), -- AJOX
  ('54b91c4d-7e48-4f2f-b766-8180dccc35d9'::uuid, 106949), -- CE ANGRA
  ('91aedf4a-daec-4060-8feb-3f3a8467367c'::uuid, 141223), -- G DE FREITAS
  ('c330170f-3c9e-46fa-8af6-db74da656873'::uuid, 170863), -- GS IMPERIAL
  ('d3d9a47e-a448-4c10-a681-9783d974edad'::uuid, 144331), -- J ERNESTO
  ('99419709-55b3-4572-91d6-1ea17ac7395e'::uuid, 50858),  -- JETOIL
  ('af11b7aa-8c3a-4b02-89cc-83b15ce2cda8'::uuid, 50002),  -- SUPER VINHOS
  ('d8f15217-c7ef-4035-bbfc-326b0e04fe36'::uuid, 126923), -- TRANSGARRA RIO
  ('15c3f70e-68c4-46d9-a7de-5af6bff7968f'::uuid, 126923), -- TRANSGARRA TRÊS RIOS
  ('2c85c193-b6ef-45c1-b8ae-95576d10fe3a'::uuid, 107167), -- VISÃO
  ('18335cb8-2dfe-4f68-8477-99e3a6218edd'::uuid, 145679)  -- WCP TRANSPORTES
) as d(id, codparc)
where c.id = d.id;
