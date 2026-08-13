create extension if not exists pgcrypto;

alter table public.questions
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_question_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_question_updated_at on public.questions;
create trigger touch_question_updated_at
before update on public.questions
for each row execute function public.touch_question_updated_at();

create or replace function public.get_safe_game_questions(
  p_subject_id bigint,
  p_classroom_id bigint default null,
  p_topic_id bigint default null,
  p_general_topic boolean default false,
  p_difficulty integer default null,
  p_review_failed boolean default false
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

  if p_topic_id is not null then
    perform public.assert_topic_playable(p_topic_id);
  end if;

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
        or public.is_admin()
        or exists (
          select 1
          from public.enrollments e
          where e.student_id = v_user_id
            and e.subject_id = p_subject_id
            and (e.classroom_id = c.id or e.classroom_id is null)
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
      'question_updated_at', q.updated_at,
      'media_type', q.media_type,
      'media_url', null,
      'media_alt_text', q.media_alt_text,
      'media_caption', q.media_caption,
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
      and (
        not p_review_failed
        or exists (
          select 1
          from (
            select distinct on (ah.question_id)
              ah.question_id,
              ah.is_correct
            from public.attempt_history ah
            where ah.student_id = v_user_id
            order by ah.question_id, ah.attempted_at desc, ah.id desc
          ) latest
          where latest.question_id = q.id
            and latest.is_correct = false
        )
      )
  ) safe_questions;

  return v_result;
end;
$$;

create or replace function public.submit_answer_resumable(
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
  v_result jsonb;
  v_expected_question_updated_at timestamptz;
  v_actual_question_updated_at timestamptz;
  v_clean_payload jsonb := p_answer_payload;
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_submission_id is null then
    raise exception 'Submission id is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_submission_id::text, 0));

  select r.result
  into v_result
  from public.game_answer_submission_receipts r
  where r.student_id = v_user_id
    and r.submission_id = p_submission_id;

  if found then
    return v_result;
  end if;

  if jsonb_typeof(p_answer_payload) = 'object'
     and p_answer_payload ? '_omniquest_question_updated_at' then
    begin
      v_expected_question_updated_at := nullif(p_answer_payload ->> '_omniquest_question_updated_at', '')::timestamptz;
    exception when others then
      v_expected_question_updated_at := null;
    end;

    if p_answer_payload ? '_omniquest_answer_payload' then
      v_clean_payload := p_answer_payload -> '_omniquest_answer_payload';
    else
      v_clean_payload := p_answer_payload - '_omniquest_question_updated_at';
      if v_clean_payload = '{}'::jsonb then
        v_clean_payload := null;
      end if;
    end if;
  end if;

  if v_expected_question_updated_at is not null then
    select q.updated_at
    into v_actual_question_updated_at
    from public.questions q
    where q.id = p_question_id;

    if v_actual_question_updated_at is null
       or v_actual_question_updated_at is distinct from v_expected_question_updated_at then
      raise exception using
        errcode = '40001',
        message = 'QUESTION_VERSION_CONFLICT',
        detail = 'La pregunta cambió desde que se descargó la partida. La respuesta no se ha aplicado.',
        hint = 'Recarga la partida para obtener la versión actual.';
    end if;
  end if;

  v_result := public.submit_answer(
    p_question_id => p_question_id,
    p_answer_id => p_answer_id,
    p_answer_text => p_answer_text,
    p_answer_payload => v_clean_payload,
    p_time_taken_seconds => p_time_taken_seconds,
    p_hint_used => p_hint_used,
    p_skipped => p_skipped,
    p_attempt_id => p_attempt_id
  );

  insert into public.game_answer_submission_receipts(student_id, submission_id, result)
  values (v_user_id, p_submission_id, v_result)
  on conflict (student_id, submission_id) do update
    set result = excluded.result;

  return v_result;
end;
$$;

revoke all on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) from public, anon;
grant execute on function public.get_safe_game_questions(bigint, bigint, bigint, boolean, integer, boolean) to authenticated;
revoke all on function public.submit_answer_resumable(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) from public, anon;
grant execute on function public.submit_answer_resumable(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) to authenticated;

create table if not exists public.ranking_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reset_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ranking_seasons_dates_check check (ends_at > starts_at and reset_at >= ends_at),
  constraint ranking_seasons_starts_at_key unique (starts_at)
);

create index if not exists ranking_seasons_active_dates_idx
  on public.ranking_seasons(active, starts_at desc, ends_at desc);
create index if not exists attempt_history_student_date_ranking_idx
  on public.attempt_history(student_id, attempted_at desc)
  include (earned_points, is_correct, question_id);

alter table public.ranking_seasons enable row level security;
drop policy if exists "ranking_seasons_read" on public.ranking_seasons;
create policy "ranking_seasons_read"
on public.ranking_seasons for select to authenticated
using (true);
drop policy if exists "ranking_seasons_admin_write" on public.ranking_seasons;
create policy "ranking_seasons_admin_write"
on public.ranking_seasons for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.ensure_current_ranking_season()
returns public.ranking_seasons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
  v_end timestamptz := (date_trunc('month', now() at time zone 'Europe/Madrid') + interval '1 month') at time zone 'Europe/Madrid';
  v_season public.ranking_seasons;
begin
  insert into public.ranking_seasons(name, starts_at, ends_at, reset_at, active)
  values (
    'Temporada ' || to_char(v_start at time zone 'Europe/Madrid', 'MM/YYYY'),
    v_start,
    v_end,
    v_end,
    true
  )
  on conflict (starts_at) do update
    set active = true
  returning * into v_season;

  update public.ranking_seasons
  set active = false
  where id <> v_season.id
    and ends_at <= now()
    and active = true;

  return v_season;
end;
$$;

revoke all on function public.ensure_current_ranking_season() from public, anon;
grant execute on function public.ensure_current_ranking_season() to authenticated;

create or replace function public.get_ranking_profiles_page(
  p_scope text default 'season',
  p_classroom_id bigint default null,
  p_min_points integer default null,
  p_max_points integer default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_scope text := lower(coalesce(nullif(trim(p_scope), ''), 'season'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
  v_season public.ranking_seasons;
  v_week_start timestamptz := date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
  v_week_reset timestamptz := (date_trunc('week', now() at time zone 'Europe/Madrid') + interval '1 week') at time zone 'Europe/Madrid';
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if v_scope not in ('global', 'weekly', 'season', 'class') then
    raise exception 'Unsupported ranking scope';
  end if;

  select * into v_season from public.ensure_current_ranking_season();

  if v_scope = 'class' then
    if p_classroom_id is null then raise exception 'Classroom is required'; end if;
    if not exists (
      select 1
      from public.classrooms c
      join public.subjects s on s.id = c.subject_id
      where c.id = p_classroom_id
        and (s.teacher_id = v_user_id or public.is_admin() or exists (
          select 1 from public.enrollments e
          where e.classroom_id = c.id and e.student_id = v_user_id
        ))
    ) then
      raise exception 'Classroom access denied';
    end if;
  end if;

  if v_scope = 'global' then
    with stats as (
      select ah.student_id,
        count(*) filter (where ah.is_correct = true)::integer as correct_answers,
        max(coalesce(ah.attempted_at, ah.created_at)) as last_activity_at
      from public.attempt_history ah
      group by ah.student_id
    ), base as (
      select p.id, p.alias, p.avatar, coalesce(p.points, 0)::integer as points,
        coalesce(p.visibility, 'public') as visibility,
        coalesce(s.correct_answers, 0) as correct_answers,
        s.last_activity_at
      from public.profiles p
      left join stats s on s.student_id = p.id
      where p.role_id = 'student'
        and coalesce(p.active, true)
        and (coalesce(p.visibility, 'public') <> 'private' or p.id = v_user_id)
        and (p_min_points is null or coalesce(p.points, 0) >= p_min_points)
        and (p_max_points is null or coalesce(p.points, 0) < p_max_points)
    ), ranked as (
      select b.*,
        row_number() over(order by b.points desc, b.correct_answers desc, b.last_activity_at asc nulls last, b.alias asc)::bigint as rank,
        count(*) over()::bigint as total_count
      from base b
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (select * from ranked order by rank limit v_limit offset v_offset) r), '[]'::jsonb),
      'total', coalesce((select max(total_count) from ranked), 0),
      'current', (select to_jsonb(r) from ranked r where r.id = v_user_id limit 1)
    ) into v_result;
  elsif v_scope in ('weekly', 'season') then
    with params as (
      select case when v_scope = 'weekly' then v_week_start else v_season.starts_at end as range_start,
             case when v_scope = 'weekly' then v_week_reset else v_season.ends_at end as range_end
    ), scoped as (
      select ah.student_id,
        coalesce(sum(coalesce(ah.earned_points, 0)), 0)::integer as points,
        count(*) filter (where ah.is_correct = true)::integer as correct_answers,
        max(coalesce(ah.attempted_at, ah.created_at)) as last_activity_at
      from public.attempt_history ah cross join params
      where coalesce(ah.attempted_at, ah.created_at) >= params.range_start
        and coalesce(ah.attempted_at, ah.created_at) < params.range_end
      group by ah.student_id
    ), base as (
      select p.id, p.alias, p.avatar, s.points,
        coalesce(p.visibility, 'public') as visibility,
        s.correct_answers,
        s.last_activity_at
      from scoped s
      join public.profiles p on p.id = s.student_id
      where p.role_id = 'student'
        and coalesce(p.active, true)
        and s.points > 0
        and (coalesce(p.visibility, 'public') <> 'private' or p.id = v_user_id)
        and (p_min_points is null or s.points >= p_min_points)
        and (p_max_points is null or s.points < p_max_points)
    ), ranked as (
      select b.*,
        row_number() over(order by b.points desc, b.correct_answers desc, b.last_activity_at asc nulls last, b.alias asc)::bigint as rank,
        count(*) over()::bigint as total_count
      from base b
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (select * from ranked order by rank limit v_limit offset v_offset) r), '[]'::jsonb),
      'total', coalesce((select max(total_count) from ranked), 0),
      'current', (select to_jsonb(r) from ranked r where r.id = v_user_id limit 1)
    ) into v_result;
  else
    with attempt_stats as (
      select ah.student_id,
        count(*) filter (where ah.is_correct = true)::integer as correct_answers,
        max(coalesce(ah.attempted_at, ah.created_at)) as last_activity_at
      from public.attempt_history ah
      join public.questions q on q.id = ah.question_id
      where q.classroom_id = p_classroom_id
      group by ah.student_id
    ), base as (
      select p.id, p.alias, p.avatar, coalesce(max(ss.max_score), 0)::integer as points,
        coalesce(p.visibility, 'public') as visibility,
        coalesce(ast.correct_answers, 0) as correct_answers,
        ast.last_activity_at
      from public.enrollments e
      join public.profiles p on p.id = e.student_id
      left join public.subject_scores ss on ss.student_id = p.id and ss.classroom_id = e.classroom_id
      left join attempt_stats ast on ast.student_id = p.id
      where e.classroom_id = p_classroom_id
        and p.role_id = 'student'
        and coalesce(p.active, true)
        and (coalesce(p.visibility, 'public') <> 'private' or p.id = v_user_id)
      group by p.id, p.alias, p.avatar, p.visibility, ast.correct_answers, ast.last_activity_at
      having (p_min_points is null or coalesce(max(ss.max_score), 0) >= p_min_points)
         and (p_max_points is null or coalesce(max(ss.max_score), 0) < p_max_points)
    ), ranked as (
      select b.*,
        row_number() over(order by b.points desc, b.correct_answers desc, b.last_activity_at asc nulls last, b.alias asc)::bigint as rank,
        count(*) over()::bigint as total_count
      from base b
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (select * from ranked order by rank limit v_limit offset v_offset) r), '[]'::jsonb),
      'total', coalesce((select max(total_count) from ranked), 0),
      'current', (select to_jsonb(r) from ranked r where r.id = v_user_id limit 1)
    ) into v_result;
  end if;

  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'total', 0, 'current', null))
    || jsonb_build_object(
      'scope', v_scope,
      'season', jsonb_build_object(
        'id', v_season.id,
        'name', v_season.name,
        'starts_at', v_season.starts_at,
        'ends_at', v_season.ends_at,
        'reset_at', case when v_scope = 'weekly' then v_week_reset else v_season.reset_at end
      ),
      'tie_break', 'Más XP; después más respuestas correctas; después haber alcanzado la puntuación antes.'
    );
end;
$$;

revoke all on function public.get_ranking_profiles_page(text, bigint, integer, integer, integer, integer) from public, anon;
grant execute on function public.get_ranking_profiles_page(text, bigint, integer, integer, integer, integer) to authenticated;

comment on table public.ranking_seasons is
  'Temporadas mensuales del ranking. La fecha reset_at se muestra al alumnado y se usa para explicar el reinicio.';
comment on function public.get_ranking_profiles_page(text, bigint, integer, integer, integer, integer) is
  'Ranking paginado con temporada, opt-out mediante profiles.visibility y desempate determinista.';

notify pgrst, 'reload schema';
