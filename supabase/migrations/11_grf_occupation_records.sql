-- Histórico das linhas do relatório diário de Ocupação (Distribuição + Transbordo),
-- alimentado pelo upload dentro do Painel de Ocupação.
--
-- Chave natural: id_romaneio é único por linha no relatório-fonte (confirmado:
-- 2.063/2.063 linhas distintas no relatório de agosto). Isso torna o upload
-- idempotente — reenviar o relatório do mês inteiro (como acontece todo dia,
-- já que o arquivo é cumulativo) não duplica nada: linha já conhecida é
-- atualizada, linha nova é inserida, e nada mais.

create table if not exists public.grf_occupation_records (
  id_romaneio bigint primary key,
  rota text null,
  placa text null,
  transportadora text null,
  data_movimento date not null,
  id_romaneio_transb bigint null,
  placa_transb text null,
  transp_transbordo text null,
  notas_fiscais integer null,
  entregas integer null,
  ponto_apoio text null,
  volumes numeric null,
  itens integer null,
  valor numeric null,
  peso_bruto numeric null,
  peso_maximo numeric null,
  perc_ocup_peso numeric null,
  volume_m3 numeric null,
  volume_maximo numeric null,
  perc_ocup_volume numeric null,
  pallets_inf integer null,
  pallets_maximo integer null,
  perc_ocup_pallets numeric null,
  source_file text null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant all on public.grf_occupation_records to service_role;
alter table public.grf_occupation_records enable row level security;

create index if not exists grf_occupation_records_data_idx
  on public.grf_occupation_records (data_movimento);

create index if not exists grf_occupation_records_transb_idx
  on public.grf_occupation_records (id_romaneio_transb)
  where id_romaneio_transb is not null;

comment on table public.grf_occupation_records is
  'Histórico linha-a-linha do relatório de Ocupação (Distribuição/Transbordo), alimentado pelo upload no Painel de Ocupação. Idempotente via id_romaneio — sem tabela de staging, sem lógica de deduplicação no cliente.';
