-- A função é usada somente pelo gatilho; não deve ficar disponível via RPC.
revoke execute on function public.snapshot_fleet_submission_actor()
  from public, anon, authenticated;

grant execute on function public.snapshot_fleet_submission_actor()
  to service_role;

create index if not exists fleet_availability_submissions_submitted_by_idx
  on public.fleet_availability_submissions (submitted_by)
  where submitted_by is not null;
