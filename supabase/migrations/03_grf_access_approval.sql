-- Fluxo de aprovação de acesso à Área GRF.
-- Aplicado no projeto Supabase em 2026-08-12.

alter table public.user_roles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null;

create table if not exists public.grf_access_approvers (
  email text primary key,
  user_id uuid null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.grf_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  email text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz null,
  decided_by uuid null,
  decision_note text null,
  notification_sent_at timestamptz null,
  notification_error text null
);

create unique index if not exists grf_access_requests_one_open_per_email
  on public.grf_access_requests (lower(email))
  where status = 'PENDING';

create index if not exists grf_access_requests_status_idx
  on public.grf_access_requests (status, requested_at desc);

grant all on public.grf_access_approvers to service_role;
grant all on public.grf_access_requests to service_role;

alter table public.grf_access_approvers enable row level security;
alter table public.grf_access_requests enable row level security;

insert into public.grf_access_approvers (email, active)
values
  ('roberta.souza@grfdistribuicao.com.br', true),
  ('roteirizador.transporte@grfdistribuicao.com.br', true),
  ('deivede.lima@grfdistribuicao.com.br', true)
on conflict (email) do update set active = excluded.active;

update public.grf_access_approvers a
set user_id = u.id
from auth.users u
where lower(u.email) = lower(a.email)
  and a.user_id is distinct from u.id;
