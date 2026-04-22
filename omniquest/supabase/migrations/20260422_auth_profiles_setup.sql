insert into public.roles (id, name)
values
  ('student', 'Student'),
  ('teacher', 'Teacher')
on conflict (id) do update
set name = excluded.name;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, alias, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'alias', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role_id', 'student')
  )
  on conflict (id) do update
  set alias = excluded.alias,
      role_id = excluded.role_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
