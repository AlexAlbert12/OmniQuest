update public.profiles
set expires_at = least(
  coalesce(expires_at, now() + interval '24 hours'),
  now() + interval '24 hours'
)
where role_id = 'guest'
  and converted_at is null
  and coalesce(active, true);

create or replace function public.initialize_guest_profile(p_alias text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expires_at timestamptz;
  v_is_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
begin
  if v_user_id is null or not v_is_anonymous then
    raise exception 'Anonymous authentication required.';
  end if;

  update public.profiles
  set
    alias = left(coalesce(nullif(trim(p_alias), ''), 'Invitado'), 30),
    avatar = null,
    points = 0,
    active = true,
    visibility = 'private',
    expires_at = now() + interval '24 hours',
    converted_at = null
  where id = v_user_id
    and role_id = 'guest'
  returning expires_at into v_expires_at;

  if v_expires_at is null then
    raise exception 'Guest profile was not initialized.';
  end if;

  return jsonb_build_object(
    'user_id', v_user_id,
    'role_id', 'guest',
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.initialize_guest_profile(text) from public, anon;
grant execute on function public.initialize_guest_profile(text) to authenticated;

alter function public.join_subject_by_code(text)
  rename to join_subject_by_code_persistent;

revoke all on function public.join_subject_by_code_persistent(text) from public, anon, authenticated;

create function public.join_subject_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_result jsonb;
begin
  select role_id into v_role
  from public.profiles
  where id = v_user_id
    and coalesce(active, true);

  begin
    return public.join_subject_by_code_persistent(p_code);
  exception when others then
    if v_role <> 'guest' or position('Ya estás matriculado' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  select jsonb_build_object(
    'id', subject.id,
    'name', subject.name,
    'classroomId', classroom.id,
    'classroomName', classroom.name
  )
  into v_result
  from public.enrollments enrollment
  join public.subjects subject on subject.id = enrollment.subject_id
  join public.classrooms classroom on classroom.id = enrollment.classroom_id
  where enrollment.student_id = v_user_id
    and (classroom.code = v_code or subject.code = v_code)
    and coalesce(subject.active, true)
    and not coalesce(subject.is_archived, false)
    and coalesce(classroom.active, true)
  order by enrollment.joined_at desc
  limit 1;

  if v_result is null then
    raise exception 'No se ha encontrado ninguna partida temporal con ese código.';
  end if;

  return v_result;
end;
$$;

revoke all on function public.join_subject_by_code(text) from public, anon;
grant execute on function public.join_subject_by_code(text) to authenticated, service_role;

alter function public.submit_answer_resumable(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid)
  rename to submit_answer_resumable_persistent;

revoke all on function public.submit_answer_resumable_persistent(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid)
  from public, anon, authenticated;

create function public.submit_answer_resumable(
  p_submission_id uuid,
  p_question_id bigint,
  p_answer_id bigint default null,
  p_answer_text text default null,
  p_answer_payload jsonb default null,
  p_time_taken_seconds integer default null,
  p_hint_used boolean default false,
  p_skipped boolean default false,
  p_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_result jsonb;
  v_feedback jsonb := '{}'::jsonb;
  v_attempt_history_id bigint;
begin
  select role_id into v_role
  from public.profiles
  where id = v_user_id
    and coalesce(active, true);

  v_result := public.submit_answer_resumable_persistent(
    p_submission_id,
    p_question_id,
    p_answer_id,
    p_answer_text,
    p_answer_payload,
    p_time_taken_seconds,
    p_hint_used,
    p_skipped,
    p_attempt_id
  );

  if v_role <> 'guest' then
    return v_result;
  end if;

  begin
    v_attempt_history_id := nullif(v_result->>'attempt_history_id', '')::bigint;
  exception when others then
    v_attempt_history_id := null;
  end;

  if v_attempt_history_id is not null then
    v_feedback := coalesce(public.get_attempt_feedback(v_attempt_history_id), '{}'::jsonb);

    delete from public.manual_review_comments comment
    where comment.attempt_history_id = v_attempt_history_id;

    delete from public.manual_review_history history
    where history.attempt_history_id = v_attempt_history_id;

    delete from public.attempt_history attempt
    where attempt.id = v_attempt_history_id
      and attempt.student_id = v_user_id;
  end if;

  delete from public.subject_scores where student_id = v_user_id;
  delete from public.topic_scores where student_id = v_user_id;
  delete from public.student_badges where student_id = v_user_id;
  update public.profiles set points = 0, avatar = null where id = v_user_id;

  v_result := (v_result - 'attempt_history_id')
    || (v_feedback - 'attempt_history_id')
    || jsonb_build_object('attempt_history_id', null);

  update public.game_answer_submission_receipts
  set result = v_result
  where student_id = v_user_id
    and submission_id = p_submission_id;

  return v_result;
end;
$$;

revoke all on function public.submit_answer_resumable(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid)
  from public, anon;
grant execute on function public.submit_answer_resumable(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid)
  to authenticated;

alter function public.finish_game_attempt(uuid, text)
  rename to finish_game_attempt_persistent;

revoke all on function public.finish_game_attempt_persistent(uuid, text)
  from public, anon, authenticated;

create function public.finish_game_attempt(
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
  v_role text;
  v_result jsonb;
begin
  select role_id into v_role
  from public.profiles
  where id = v_user_id
    and coalesce(active, true);

  v_result := public.finish_game_attempt_persistent(p_attempt_id, p_status);

  if v_role = 'guest' then
    delete from public.manual_review_comments comment
    using public.attempt_history attempt
    where comment.attempt_history_id = attempt.id
      and attempt.student_id = v_user_id;

    delete from public.manual_review_history history
    using public.attempt_history attempt
    where history.attempt_history_id = attempt.id
      and attempt.student_id = v_user_id;

    delete from public.attempt_history where student_id = v_user_id;
    delete from public.game_answer_submission_receipts where student_id = v_user_id;
    delete from public.game_attempts where student_id = v_user_id;
    delete from public.subject_scores where student_id = v_user_id;
    delete from public.topic_scores where student_id = v_user_id;
    delete from public.student_badges where student_id = v_user_id;
    delete from public.profile_cosmetics where user_id = v_user_id;
    delete from public.notifications where user_id = v_user_id;
    delete from public.notification_state where user_id = v_user_id;
    delete from public.enrollments where student_id = v_user_id;
    update public.profiles set points = 0, avatar = null where id = v_user_id;

    v_result := v_result || jsonb_build_object(
      'total_points', 0,
      'badge_sync', jsonb_build_object('new_awards', '[]'::jsonb)
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.finish_game_attempt(uuid, text) from public, anon;
grant execute on function public.finish_game_attempt(uuid, text) to authenticated;

create or replace function public.discard_current_guest_session()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
begin
  if v_user_id is null or not v_is_anonymous then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id and role_id = 'guest'
  ) then
    return false;
  end if;

  delete from public.manual_review_comments comment
  using public.attempt_history attempt
  where comment.attempt_history_id = attempt.id
    and attempt.student_id = v_user_id;

  delete from public.manual_review_history history
  using public.attempt_history attempt
  where history.attempt_history_id = attempt.id
    and attempt.student_id = v_user_id;

  delete from public.profiles
  where id = v_user_id
    and role_id = 'guest';

  return found;
end;
$$;

revoke all on function public.discard_current_guest_session() from public, anon;
grant execute on function public.discard_current_guest_session() to authenticated;

comment on function public.discard_current_guest_session() is
  'Deletes the current anonymous guest profile and all rows that cascade from it before local sign-out.';

create or replace function public.cleanup_expired_guests(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    select id
    from public.profiles
    where role_id = 'guest'
      and converted_at is null
      and expires_at <= now()
    order by expires_at
    for update skip locked
    limit greatest(1, least(p_limit, 1000))
  ), deleted as (
    delete from public.profiles profile
    using expired
    where profile.id = expired.id
    returning profile.id
  )
  select count(*)::integer into v_count from deleted;

  return v_count;
end;
$$;

revoke all on function public.cleanup_expired_guests(integer) from public, anon, authenticated;
grant execute on function public.cleanup_expired_guests(integer) to service_role;

comment on function public.cleanup_expired_guests(integer) is
  'Permanently removes expired anonymous guest profiles and their cascading temporary data.';
