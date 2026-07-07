alter table public.profiles
  alter column visibility set default 'public';

update public.profiles
set visibility = 'public'
where role_id in ('student', 'guest')
  and visibility = 'private';

comment on column public.profiles.visibility is
  'Visibilidad del perfil en ranking y superficies públicas. Los estudiantes son públicos por defecto; pueden cambiarlo desde configuración.';
