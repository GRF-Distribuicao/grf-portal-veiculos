-- Remove a visão de integração (migração 23). Não toca em nenhuma tabela.
drop view if exists public.vw_integracao_veiculos;
