create or replace function public.can_read_profile(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.profiles target_profile
      where target_profile.id = p_profile_id
        and target_profile.role_id in ('student', 'guest')
        and exists (
          select 1
          from public.enrollments enrollment
          join public.subjects subject on subject.id = enrollment.subject_id
          where enrollment.student_id = target_profile.id
            and subject.teacher_id = auth.uid()
            and coalesce(subject.is_archived, false) = false
        )
    )
    or exists (
      select 1
      from public.profiles target_profile
      where target_profile.id = p_profile_id
        and target_profile.role_id = 'teacher'
        and exists (
          select 1
          from public.subjects subject
          join public.enrollments enrollment on enrollment.subject_id = subject.id
          where subject.teacher_id = target_profile.id
            and enrollment.student_id = auth.uid()
            and coalesce(subject.is_archived, false) = false
        )
    );
$$;

create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Los usuarios pueden editar su alias, avatar y visibilidad, pero no deben
  -- poder elevar su rol, activar/desactivar cuentas ni manipular XP desde el cliente.
  -- Las operaciones admin/Edge Functions con service role no tienen auth.uid() y no se ven afectadas.
  if auth.uid() is not null
     and new.id = auth.uid()
     and not public.is_admin() then
    new.email := old.email;
    new.role_id := old.role_id;
    new.points := old.points;
    new.active := old.active;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

alter table public.profiles enable row level security;

drop trigger if exists protect_profile_sensitive_columns on public.profiles;
create trigger protect_profile_sensitive_columns
before update on public.profiles
for each row execute function public.protect_profile_sensitive_columns();

drop policy if exists "admin_select_profiles" on public.profiles;
drop policy if exists "admin_update_profiles" on public.profiles;
drop policy if exists "profiles_select_allowed" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_allowed"
on public.profiles for select to authenticated
using (public.can_read_profile(id));

create policy "profiles_insert_self"
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  and coalesce(role_id, 'student') in ('student', 'guest')
  and coalesce(points, 0) = 0
  and coalesce(active, true) = true
);

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_update_admin"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant execute on function public.can_read_profile(uuid) to authenticated;
grant execute on function public.protect_profile_sensitive_columns() to authenticated;

comment on function public.can_read_profile(uuid) is
  'Controla lectura RLS de profiles: perfil propio, admin, profesor de alumno inscrito y alumno inscrito con profesor.';

comment on function public.protect_profile_sensitive_columns() is
  'Evita que una actualización directa del propio perfil cambie rol, email, XP, estado o fecha de creación.';

comment on table public.profiles is
  'RLS activo. La lectura pública segura para ranking se realiza mediante get_ranking_profiles/get_class_ranking_profiles para no exponer columnas privadas.';
