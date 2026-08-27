-- Exclusão segura de acessos do portal, preservando histórico operacional.

alter table public.grf_access_requests
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid;

alter table public.grf_access_requests
  drop constraint if exists grf_access_requests_status_check;

alter table public.grf_access_requests
  add constraint grf_access_requests_status_check
  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED'));

alter table public.transporter_access_requests
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid;

alter table public.transporter_access_requests
  drop constraint if exists transporter_access_requests_status_check;

alter table public.transporter_access_requests
  add constraint transporter_access_requests_status_check
  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED'));

-- O usuário de Auth pode ser removido sem apagar a autoria da disponibilidade.
alter table public.fleet_availability_submissions
  add column if not exists submitted_by_email text;

update public.fleet_availability_submissions submission
   set submitted_by_email = lower(auth_user.email)
  from auth.users auth_user
 where auth_user.id = submission.submitted_by
   and submission.submitted_by_email is null;

alter table public.fleet_availability_submissions
  alter column submitted_by drop not null;

alter table public.fleet_availability_submissions
  drop constraint if exists fleet_availability_submissions_submitted_by_fkey;

alter table public.fleet_availability_submissions
  add constraint fleet_availability_submissions_submitted_by_fkey
  foreign key (submitted_by)
  references auth.users(id)
  on delete set null;

create or replace function public.snapshot_fleet_submission_actor()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.submitted_by is not null then
    if tg_op = 'INSERT' or new.submitted_by_email is null then
      select lower(email)
        into new.submitted_by_email
        from auth.users
       where id = new.submitted_by;
    elsif new.submitted_by is distinct from old.submitted_by then
      select lower(email)
        into new.submitted_by_email
        from auth.users
       where id = new.submitted_by;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.snapshot_fleet_submission_actor() from public;
grant execute on function public.snapshot_fleet_submission_actor() to service_role;

drop trigger if exists trg_snapshot_fleet_submission_actor
  on public.fleet_availability_submissions;

create trigger trg_snapshot_fleet_submission_actor
before insert or update of submitted_by
on public.fleet_availability_submissions
for each row
execute function public.snapshot_fleet_submission_actor();
