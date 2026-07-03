insert into public.roles (id, name)
values
  ('student', 'Alumno'),
  ('teacher', 'Profesor'),
  ('guest', 'Invitado'),
  ('admin', 'Administrador')
on conflict (id) do update
set name = excluded.name;

alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias text;
  v_role_id text;
begin
  v_alias := nullif(trim(coalesce(
    new.raw_user_meta_data->>'alias',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Alumno'
  )), '');

  v_role_id := coalesce(new.raw_user_meta_data->>'role_id', 'student');

  if v_role_id not in ('student', 'teacher', 'guest', 'admin') then
    v_role_id := 'student';
  end if;

  insert into public.profiles (
    id,
    email,
    alias,
    role_id,
    points
  )
  values (
    new.id,
    new.email,
    coalesce(v_alias, 'Alumno'),
    v_role_id,
    0
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    alias = coalesce(public.profiles.alias, excluded.alias),
    role_id = coalesce(public.profiles.role_id, excluded.role_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (
  id,
  email,
  alias,
  role_id,
  points
)
select
  users.id,
  users.email,
  coalesce(nullif(trim(coalesce(
    users.raw_user_meta_data->>'alias',
    users.raw_user_meta_data->>'name',
    split_part(users.email, '@', 1),
    'Alumno'
  )), ''), 'Alumno') as alias,
  case
    when users.raw_user_meta_data->>'role_id' in ('student', 'teacher', 'guest', 'admin')
      then users.raw_user_meta_data->>'role_id'
    else 'student'
  end as role_id,
  0 as points
from auth.users
where not exists (
  select 1
  from public.profiles
  where profiles.id = users.id
);

update public.profiles
set email = users.email
from auth.users
where profiles.id = users.id
  and profiles.email is null;
