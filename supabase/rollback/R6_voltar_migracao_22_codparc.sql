-- Remove o código de parceiro Sankhya das transportadoras (migração 22). Não
-- toca em veículos, cadastros nem disponibilidade. A exportação Sankhya volta a
-- sair com a coluna de parceiro vazia.
alter table public.transporter_companies drop column if exists sankhya_codparc;
