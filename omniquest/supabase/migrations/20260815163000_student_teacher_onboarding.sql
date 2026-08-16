alter table public.profiles
  add column if not exists onboarding_version integer not null default 0,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_version is
  'Versión del onboarding de producto completada por el usuario. Solo aplica a alumnos y profesores.';

comment on column public.profiles.onboarding_completed_at is
  'Fecha de la primera finalización o descarte del onboarding actual.';

create or replace function public.complete_current_user_onboarding(p_version integer default 1)
returns table(onboarding_version integer, onboarding_completed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role_id text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_version <> 1 then
    raise exception 'Unsupported onboarding version';
  end if;

  select profile.role_id
  into v_role_id
  from public.profiles profile
  where profile.id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_role_id not in ('student', 'teacher') then
    raise exception 'Onboarding is only available for students and teachers';
  end if;

  update public.profiles profile
  set onboarding_version = greatest(profile.onboarding_version, p_version),
      onboarding_completed_at = coalesce(profile.onboarding_completed_at, now())
  where profile.id = v_user_id;

  return query
  select profile.onboarding_version, profile.onboarding_completed_at
  from public.profiles profile
  where profile.id = v_user_id;
end;
$$;

revoke all on function public.complete_current_user_onboarding(integer) from public, anon, authenticated;
grant execute on function public.complete_current_user_onboarding(integer) to authenticated, service_role;

comment on function public.complete_current_user_onboarding(integer) is
  'Marca como completado el onboarding del alumno o profesor autenticado sin permitir modificar identidades ajenas.';
