alter table public.subject_topics
  add column if not exists available_until timestamptz;

create index if not exists subject_topics_available_until_idx
  on public.subject_topics(available_until)
  where available_until is not null;

create or replace function public.assert_topic_playable(p_topic_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available_until timestamptz;
begin
  if p_topic_id is null then
    return;
  end if;

  select available_until
  into v_available_until
  from public.subject_topics
  where id = p_topic_id;

  if v_available_until is not null and v_available_until <= now() then
    raise exception 'El tiempo límite de este tema ha terminado. Ya no se puede jugar.';
  end if;
end;
$$;

create or replace function public.check_game_attempt_topic_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_topic_playable(new.topic_id);
  return new;
end;
$$;

drop trigger if exists check_game_attempt_topic_deadline on public.game_attempts;
create trigger check_game_attempt_topic_deadline
before insert on public.game_attempts
for each row execute function public.check_game_attempt_topic_deadline();

create or replace function public.check_attempt_history_topic_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_id bigint;
begin
  select topic_id
  into v_topic_id
  from public.questions
  where id = new.question_id;

  perform public.assert_topic_playable(v_topic_id);
  return new;
end;
$$;

drop trigger if exists check_attempt_history_topic_deadline on public.attempt_history;
create trigger check_attempt_history_topic_deadline
before insert on public.attempt_history
for each row execute function public.check_attempt_history_topic_deadline();

create or replace function public.get_game_questions(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_classroom_id bigint;
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_difficulty is not null and p_difficulty not in (1, 2, 3) then
    raise exception 'Invalid difficulty';
  end if;

  perform public.assert_topic_playable(p_topic_id);

  v_classroom_id := coalesce(p_classroom_id, public.ensure_default_classroom(p_subject_id));

  if not exists (
    select 1
    from public.classrooms c
    join public.subjects s on s.id = c.subject_id
    where c.id = v_classroom_id
      and c.subject_id = p_subject_id
      and coalesce(c.active, true)
      and (
        s.teacher_id = v_user_id
        or exists (
          select 1
          from public.enrollments e
          where e.classroom_id = c.id
            and e.student_id = v_user_id
        )
      )
  ) then
    raise exception 'No puedes acceder a esta clase.';
  end if;

  select coalesce(jsonb_agg(question_payload order by random()), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'difficulty', coalesce(q.difficulty, 1),
      'points_base', q.points_base,
      'time_limit_seconds', q.time_limit_seconds,
      'topic_id', q.topic_id,
      'classroom_id', q.classroom_id,
      'blank_count',
        case
          when q.type = 'fill_blank' then (
            select count(*)
            from public.answers a
            where a.question_id = q.id
              and coalesce(a.is_correct, true)
              and public.normalize_answer_text(a.text) <> ''
          )
          else null
        end,
      'answers',
        case
          when q.type in ('open_answer', 'fill_blank') then '[]'::jsonb
          when q.type in ('match_pairs', 'drag_drop') then (
            select coalesce(
              jsonb_agg(jsonb_build_object('id', a.id, 'text', split_part(a.text, '|||', 1)) order by random()),
              '[]'::jsonb
            )
            from public.answers a
            where a.question_id = q.id
          )
          else (
            select coalesce(
              jsonb_agg(jsonb_build_object('id', a.id, 'text', a.text) order by random()),
              '[]'::jsonb
            )
            from public.answers a
            where a.question_id = q.id
          )
        end,
      'pair_options',
        case
          when q.type in ('match_pairs', 'drag_drop') then (
            select coalesce(jsonb_agg(pair_right order by random()), '[]'::jsonb)
            from (
              select split_part(a.text, '|||', 2) as pair_right
              from public.answers a
              where a.question_id = q.id
                and split_part(a.text, '|||', 2) <> ''
            ) pairs
          )
          else '[]'::jsonb
        end
    ) as question_payload
    from public.questions q
    left join public.subject_topics st on st.id = q.topic_id
    where q.subject_id = p_subject_id
      and q.classroom_id = v_classroom_id
      and coalesce(q.active, true)
      and (q.topic_id is null or st.available_until is null or st.available_until > now())
      and (p_difficulty is null or coalesce(q.difficulty, 1) = p_difficulty)
      and (
        (p_general_topic and q.topic_id is null)
        or (not p_general_topic and p_topic_id is null)
        or (not p_general_topic and p_topic_id is not null and q.topic_id = p_topic_id)
      )
  ) safe_questions;

  return v_result;
end;
$$;

grant execute on function public.assert_topic_playable(bigint) to authenticated;
grant execute on function public.get_game_questions(bigint, bigint, bigint, boolean, integer) to authenticated;
