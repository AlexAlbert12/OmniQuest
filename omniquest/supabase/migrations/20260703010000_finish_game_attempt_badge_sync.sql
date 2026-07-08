create or replace function public.finish_game_attempt(
  p_attempt_id uuid,
  p_status text default 'finished'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.game_attempts%rowtype;
  v_next_status text := lower(coalesce(nullif(trim(p_status), ''), 'finished'));
  v_badge_sync jsonb := '{}'::jsonb;
  v_total_points integer := null;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_attempt_id is null then
    raise exception 'Falta el intento de partida.';
  end if;

  if v_next_status not in ('finished', 'abandoned') then
    raise exception 'Estado de partida no válido.';
  end if;

  select *
  into v_attempt
  from public.game_attempts
  where id = p_attempt_id
    and student_id = v_user_id;

  if not found then
    raise exception 'No se encontró la partida.';
  end if;

  if v_attempt.status = 'playing' then
    update public.game_attempts
    set
      status = v_next_status,
      finished_at = coalesce(finished_at, now()),
      updated_at = now()
    where id = p_attempt_id
      and student_id = v_user_id
    returning * into v_attempt;
  end if;

  v_badge_sync := public.sync_student_badges();
  v_total_points := public.sync_student_points(v_user_id);

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_attempt.status,
    'finished_at', v_attempt.finished_at,
    'total_score', coalesce(v_attempt.total_score, 0),
    'total_points', v_total_points,
    'badge_sync', v_badge_sync
  );
end;
$$;

revoke execute on function public.finish_game_attempt(uuid, text) from public;
grant execute on function public.finish_game_attempt(uuid, text) to authenticated;
