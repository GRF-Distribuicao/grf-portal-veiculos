-- Remove as rotas por veículo (migração 21). Não toca em veículos, cadastro
-- nem disponibilidade. A aba Disponibilidade volta a mostrar "—" nas rotas.
drop table if exists public.vehicle_routes;
