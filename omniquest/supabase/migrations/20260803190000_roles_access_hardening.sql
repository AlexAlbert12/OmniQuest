alter table public.roles enable row level security;

revoke all on table public.roles from public, anon, authenticated;
grant select on table public.roles to authenticated;

drop policy if exists "roles_authenticated_read" on public.roles;
create policy "roles_authenticated_read"
on public.roles
for select
to authenticated
using (true);
