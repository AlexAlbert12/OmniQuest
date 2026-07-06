create or replace function public.recalculate_student_points(p_student_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_points integer := 0;
  v_badge_points integer := 0;
  v_total_points integer := 0;
begin
  if p_student_id is null then
    return 0;
  end if;

  select coalesce(sum(greatest(coalesce(earned_points, 0), 0)), 0)::integer
  into v_attempt_points
  from public.attempt_history
  where student_id = p_student_id;

  select coalesce(sum(greatest(coalesce(reward_xp, 0), 0)), 0)::integer
  into v_badge_points
  from public.student_badges
  where student_id = p_student_id;

  v_total_points := v_attempt_points + v_badge_points;

  update public.profiles
  set points = v_total_points
  where id = p_student_id
    and coalesce(role_id, 'student') in ('student', 'guest')
    and coalesce(points, -1) <> v_total_points;

  return v_total_points;
end;
$$;

revoke execute on function public.recalculate_student_points(uuid) from public;

create or replace function public.sync_student_points(student_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id alias for $1;
begin
  if v_student_id is null then
    raise exception 'Falta student_id.';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and auth.uid() is distinct from v_student_id
     and not public.is_admin()
  then
    raise exception 'No puedes sincronizar los puntos de otro usuario.';
  end if;

  return public.recalculate_student_points(v_student_id);
end;
$$;

revoke execute on function public.sync_student_points(uuid) from public;
grant execute on function public.sync_student_points(uuid) to authenticated, service_role;

create or replace function public.sync_student_points_from_xp_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and old.student_id is distinct from new.student_id then
    perform public.recalculate_student_points(old.student_id);
  end if;

  if TG_OP = 'DELETE' then
    perform public.recalculate_student_points(old.student_id);
    return old;
  end if;

  perform public.recalculate_student_points(new.student_id);
  return new;
end;
$$;

revoke execute on function public.sync_student_points_from_xp_source() from public;

drop trigger if exists sync_attempt_history_student_points_insert on public.attempt_history;
drop trigger if exists sync_attempt_history_student_points_update on public.attempt_history;
drop trigger if exists sync_attempt_history_student_points_delete on public.attempt_history;

create constraint trigger sync_attempt_history_student_points_insert
after insert on public.attempt_history
deferrable initially deferred
for each row
execute function public.sync_student_points_from_xp_source();

create constraint trigger sync_attempt_history_student_points_update
after update of student_id, earned_points on public.attempt_history
deferrable initially deferred
for each row
execute function public.sync_student_points_from_xp_source();

create constraint trigger sync_attempt_history_student_points_delete
after delete on public.attempt_history
deferrable initially deferred
for each row
execute function public.sync_student_points_from_xp_source();

drop trigger if exists sync_student_badges_student_points_insert on public.student_badges;
drop trigger if exists sync_student_badges_student_points_update on public.student_badges;
drop trigger if exists sync_student_badges_student_points_delete on public.student_badges;

create constraint trigger sync_student_badges_student_points_insert
after insert on public.student_badges
deferrable initially deferred
for each row
execute function public.sync_student_points_from_xp_source();

create constraint trigger sync_student_badges_student_points_update
after update of student_id, reward_xp on public.student_badges
deferrable initially deferred
for each row
execute function public.sync_student_points_from_xp_source();

create constraint trigger sync_student_badges_student_points_delete
after delete on public.student_badges
deferrable initially deferred
for each row
execute function public.sync_student_points_from_xp_source();

do $$
declare
  v_profile_id uuid;
begin
  for v_profile_id in
    select id
    from public.profiles
    where coalesce(role_id, 'student') in ('student', 'guest')
  loop
    perform public.recalculate_student_points(v_profile_id);
  end loop;
end;
$$;
