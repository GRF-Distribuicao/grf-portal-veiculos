-- Área do Transportador: solicitação, aprovação e vínculo seguro por empresa.

alter table public.transporter_companies
  add column if not exists cnpj text;

create unique index if not exists transporter_companies_cnpj_unique
  on public.transporter_companies (cnpj)
  where cnpj is not null and cnpj <> '';

create table if not exists public.transporter_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  requester_name text not null,
  email text not null,
  company_name text not null,
  company_cnpj text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  decision_note text,
  matched_company_id uuid references public.transporter_companies(id),
  notification_sent_at timestamptz,
  notification_error text
);

create unique index if not exists transporter_access_requests_one_pending_per_user
  on public.transporter_access_requests (user_id)
  where status = 'PENDING';

create index if not exists transporter_access_requests_status_requested_idx
  on public.transporter_access_requests (status, requested_at desc);

alter table public.transporter_access_requests enable row level security;

drop policy if exists transporter_access_requests_read_own on public.transporter_access_requests;
create policy transporter_access_requests_read_own
  on public.transporter_access_requests
  for select
  to authenticated
  using (user_id = auth.uid());

alter table public.transporter_memberships
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists request_id uuid references public.transporter_access_requests(id);
