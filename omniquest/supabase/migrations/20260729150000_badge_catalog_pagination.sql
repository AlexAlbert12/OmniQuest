create table if not exists public.badge_categories (
  category_key text primary key,
  name text not null,
  description text,
  icon text not null,
  color text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_categories_key_format check (category_key ~ '^[a-z0-9][a-z0-9-]*$')
);

create table if not exists public.badge_definitions (
  badge_id text primary key,
  category_key text not null references public.badge_categories(category_key) on update cascade,
  title text not null,
  description text not null,
  requirement text not null,
  icon text not null,
  color text not null,
  reward_xp integer not null default 0 check (reward_xp >= 0),
  metric_key text not null check (metric_key in (
    'total_answers',
    'correct_answers',
    'accuracy_percent',
    'streak_days',
    'practiced_subjects',
    'practiced_classrooms',
    'question_types_played',
    'total_points'
  )),
  target_value integer not null check (target_value > 0),
  minimum_samples integer not null default 0 check (minimum_samples >= 0),
  unit_singular text not null,
  unit_plural text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint badge_definitions_id_format check (badge_id ~ '^[a-z0-9][a-z0-9-]*$')
);

create index if not exists badge_definitions_catalog_idx
  on public.badge_definitions(category_key, is_active, sort_order, badge_id);

create index if not exists student_badges_student_awarded_idx
  on public.student_badges(student_id, awarded_at desc);

insert into public.badge_categories (
  category_key,
  name,
  description,
  icon,
  color,
  sort_order,
  is_active
)
values
  ('xp', 'XP', 'Hitos alcanzados al acumular experiencia.', 'flash-outline', '#FBBF24', 10, true),
  ('streak', 'Racha', 'Reconocimientos por mantener una práctica constante.', 'flame-outline', '#F97316', 20, true),
  ('accuracy', 'Precisión', 'Logros relacionados con respuestas correctas y precisión.', 'speedometer-outline', '#34D399', 30, true),
  ('courses', 'Cursos', 'Insignias por explorar cursos y clases diferentes.', 'book-outline', '#38BDF8', 40, true),
  ('challenges', 'Retos', 'Desafíos de participación y variedad de juego.', 'flag-outline', '#8B5CF6', 50, true)
on conflict (category_key) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.badge_definitions (
  badge_id,
  category_key,
  title,
  description,
  requirement,
  icon,
  color,
  reward_xp,
  metric_key,
  target_value,
  minimum_samples,
  unit_singular,
  unit_plural,
  sort_order,
  is_active
)
values
  ('first-step', 'challenges', 'Primer paso', 'Toda gran aventura empieza con una respuesta correcta. Esta insignia celebra el comienzo de tu recorrido.', 'Responde correctamente tu primera pregunta', 'sparkles', '#58B5FF', 50, 'correct_answers', 1, 0, 'respuesta correcta', 'respuestas correctas', 10, true),
  ('first-session', 'challenges', 'Primera sesión', 'Has completado tu primera sesión de práctica y ya tienes una base sobre la que seguir creciendo.', 'Completa tus primeras 5 preguntas', 'play-circle', '#8B5CF6', 60, 'total_answers', 5, 0, 'pregunta', 'preguntas', 20, true),
  ('practice-25', 'challenges', 'En marcha', 'La práctica empieza a convertirse en hábito. Sigue avanzando para ampliar tu colección.', 'Responde 25 preguntas', 'rocket', '#7C5CFF', 100, 'total_answers', 25, 0, 'pregunta', 'preguntas', 30, true),
  ('practice-100', 'challenges', 'Maestro de retos', 'Cien preguntas demuestran dedicación, curiosidad y ganas de superarte en cada partida.', 'Responde 100 preguntas', 'trophy', '#FBBF24', 250, 'total_answers', 100, 0, 'pregunta', 'preguntas', 40, true),
  ('correct-50', 'accuracy', 'Buena puntería', 'Has consolidado tus conocimientos con cincuenta respuestas correctas.', 'Consigue 50 respuestas correctas', 'checkmark-circle', '#34D399', 180, 'correct_answers', 50, 0, 'respuesta correcta', 'respuestas correctas', 10, true),
  ('accuracy-80', 'accuracy', 'Precisión brillante', 'Mantener una precisión alta durante una muestra suficiente demuestra un dominio consistente.', 'Alcanza un 80% de precisión con al menos 20 respuestas', 'speedometer', '#43D991', 200, 'accuracy_percent', 80, 20, 'punto de precisión', 'puntos de precisión', 20, true),
  ('streak-3', 'streak', 'Constante', 'Tres días consecutivos convierten una intención en una rutina de aprendizaje.', 'Practica durante 3 días seguidos', 'flame', '#F97316', 100, 'streak_days', 3, 0, 'día de racha', 'días de racha', 10, true),
  ('streak-7', 'streak', 'Racha semanal', 'Una semana completa de práctica refleja constancia y compromiso con tu progreso.', 'Practica durante 7 días seguidos', 'bonfire', '#FB7185', 220, 'streak_days', 7, 0, 'día de racha', 'días de racha', 20, true),
  ('course-explorer', 'courses', 'Explorador de cursos', 'Has llevado tu curiosidad a varias materias y ampliado tu mapa de aprendizaje.', 'Practica en 3 cursos diferentes', 'map', '#38BDF8', 150, 'practiced_subjects', 3, 0, 'curso', 'cursos', 10, true),
  ('class-explorer', 'courses', 'Explorador de clases', 'Participar en distintas clases te permite descubrir nuevos retos y comunidades.', 'Practica en 3 clases diferentes', 'compass', '#34D399', 150, 'practiced_classrooms', 3, 0, 'clase', 'clases', 20, true),
  ('question-type-explorer', 'challenges', 'Explorador de formatos', 'Has probado distintas formas de responder y demostrado flexibilidad al aprender.', 'Practica 3 tipos de pregunta diferentes', 'shapes', '#EC4899', 120, 'question_types_played', 3, 0, 'tipo de pregunta', 'tipos de pregunta', 50, true),
  ('xp-500', 'xp', 'Cazador de XP', 'Tu experiencia acumulada refleja el esfuerzo invertido en aprender y mejorar.', 'Acumula 500 XP', 'flash', '#FBBF24', 120, 'total_points', 500, 0, 'XP', 'XP', 10, true),
  ('xp-2000', 'xp', 'Leyenda XP', 'Has alcanzado un hito reservado a quienes mantienen el aprendizaje a largo plazo.', 'Acumula 2.000 XP', 'star', '#F59E0B', 300, 'total_points', 2000, 0, 'XP', 'XP', 20, true)
on conflict (badge_id) do update
set
  category_key = excluded.category_key,
  title = excluded.title,
  description = excluded.description,
  requirement = excluded.requirement,
  icon = excluded.icon,
  color = excluded.color,
  reward_xp = excluded.reward_xp,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  minimum_samples = excluded.minimum_samples,
  unit_singular = excluded.unit_singular,
  unit_plural = excluded.unit_plural,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_badges_badge_id_fkey'
  ) then
    alter table public.student_badges
      add constraint student_badges_badge_id_fkey
      foreign key (badge_id) references public.badge_definitions(badge_id)
      on update cascade on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profile_cosmetics_featured_badge_id_fkey'
  ) then
    alter table public.profile_cosmetics
      add constraint profile_cosmetics_featured_badge_id_fkey
      foreign key (featured_badge_id) references public.badge_definitions(badge_id)
      on update cascade on delete set null not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'avatar_frames_required_badge_id_fkey'
  ) then
    alter table public.avatar_frames
      add constraint avatar_frames_required_badge_id_fkey
      foreign key (required_badge_id) references public.badge_definitions(badge_id)
      on update cascade on delete set null not valid;
  end if;
end;
$$;

alter table public.badge_categories enable row level security;
alter table public.badge_definitions enable row level security;

revoke all on public.badge_categories from public, anon, authenticated;
revoke all on public.badge_definitions from public, anon, authenticated;
grant select on public.badge_categories to authenticated;
grant select on public.badge_definitions to authenticated;

drop policy if exists "badge_categories_authenticated_read" on public.badge_categories;
create policy "badge_categories_authenticated_read"
on public.badge_categories for select to authenticated
using (is_active = true);

drop policy if exists "badge_definitions_authenticated_read" on public.badge_definitions;
create policy "badge_definitions_authenticated_read"
on public.badge_definitions for select to authenticated
using (is_active = true);

create or replace function public.get_student_badge_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total_answers integer := 0;
  v_correct_answers integer := 0;
  v_accuracy_percent integer := 0;
  v_total_points integer := 0;
  v_subjects_count integer := 0;
  v_practiced_subjects integer := 0;
  v_practiced_classrooms integer := 0;
  v_question_types_played integer := 0;
  v_streak_days integer := 0;
  v_cursor date;
  v_played_days date[] := '{}';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select count(*)::integer,
         count(*) filter (where is_correct)::integer
  into v_total_answers, v_correct_answers
  from public.attempt_history
  where student_id = v_user_id;

  v_accuracy_percent := case
    when v_total_answers > 0 then least(100, round((v_correct_answers::numeric / v_total_answers::numeric) * 100)::integer)
    else 0
  end;

  select coalesce(points, 0)
  into v_total_points
  from public.profiles
  where id = v_user_id;

  select count(*)::integer
  into v_subjects_count
  from public.enrollments
  where student_id = v_user_id;

  select count(distinct q.subject_id)::integer,
         count(distinct q.classroom_id)::integer,
         count(distinct q.type)::integer
  into v_practiced_subjects, v_practiced_classrooms, v_question_types_played
  from public.attempt_history ah
  join public.questions q on q.id = ah.question_id
  where ah.student_id = v_user_id;

  select coalesce(array_agg(distinct played_day order by played_day), '{}')
  into v_played_days
  from (
    select attempted_at::date as played_day
    from public.attempt_history
    where student_id = v_user_id
  ) days;

  v_cursor := current_date;
  if not v_cursor = any(v_played_days) and (v_cursor - 1) = any(v_played_days) then
    v_cursor := v_cursor - 1;
  end if;

  while v_cursor = any(v_played_days) loop
    v_streak_days := v_streak_days + 1;
    v_cursor := v_cursor - 1;
  end loop;

  return jsonb_build_object(
    'total_answers', v_total_answers,
    'correct_answers', v_correct_answers,
    'accuracy_percent', v_accuracy_percent,
    'total_points', v_total_points,
    'subjects_count', v_subjects_count,
    'practiced_subjects', v_practiced_subjects,
    'practiced_classrooms', v_practiced_classrooms,
    'question_types_played', v_question_types_played,
    'streak_days', v_streak_days
  );
end;
$$;

create or replace function public.badge_metric_value(p_metric_key text, p_metrics jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select coalesce(case p_metric_key
    when 'total_answers' then (p_metrics ->> 'total_answers')::integer
    when 'correct_answers' then (p_metrics ->> 'correct_answers')::integer
    when 'accuracy_percent' then (p_metrics ->> 'accuracy_percent')::integer
    when 'streak_days' then (p_metrics ->> 'streak_days')::integer
    when 'practiced_subjects' then (p_metrics ->> 'practiced_subjects')::integer
    when 'practiced_classrooms' then (p_metrics ->> 'practiced_classrooms')::integer
    when 'question_types_played' then (p_metrics ->> 'question_types_played')::integer
    when 'total_points' then (p_metrics ->> 'total_points')::integer
    else 0
  end, 0);
$$;

create or replace function public.sync_student_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_metrics jsonb;
  v_awarded_xp integer := 0;
  v_new_awards jsonb := '[]'::jsonb;
  v_iteration_count integer := 0;
  v_iteration_xp integer := 0;
  v_iteration_awards jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  loop
    v_metrics := public.get_student_badge_metrics();

    with catalog as (
      select
        bd.badge_id,
        bd.reward_xp,
        bd.target_value,
        bd.minimum_samples,
        public.badge_metric_value(bd.metric_key, v_metrics) as current_value
      from public.badge_definitions bd
      where bd.is_active = true
    ),
    unlocked as (
      select badge_id, reward_xp
      from catalog
      where current_value >= target_value
        and coalesce((v_metrics ->> 'total_answers')::integer, 0) >= minimum_samples
    ),
    inserted as (
      insert into public.student_badges (student_id, badge_id, reward_xp, awarded_at)
      select v_user_id, badge_id, reward_xp, now()
      from unlocked
      on conflict (student_id, badge_id) do nothing
      returning badge_id, reward_xp, awarded_at
    )
    select count(*)::integer,
           coalesce(sum(reward_xp), 0),
           coalesce(jsonb_agg(jsonb_build_object(
             'badge_id', badge_id,
             'awarded_at', awarded_at,
             'reward_xp', reward_xp
           ) order by awarded_at desc), '[]'::jsonb)
    into v_iteration_count, v_iteration_xp, v_iteration_awards
    from inserted;

    exit when v_iteration_count = 0;
    v_awarded_xp := v_awarded_xp + v_iteration_xp;
    v_new_awards := v_new_awards || v_iteration_awards;
  end loop;

  return jsonb_build_object(
    'awarded_xp', v_awarded_xp,
    'new_awards', v_new_awards,
    'awards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'badge_id', sb.badge_id,
        'awarded_at', sb.awarded_at,
        'reward_xp', sb.reward_xp
      ) order by sb.awarded_at desc)
      from public.student_badges sb
      where sb.student_id = v_user_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_student_badge_catalog(
  p_page integer default 0,
  p_page_size integer default 12,
  p_category_key text default null,
  p_status text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_page integer := greatest(coalesce(p_page, 0), 0);
  v_page_size integer := least(greatest(coalesce(p_page_size, 12), 1), 50);
  v_category_key text := nullif(trim(coalesce(p_category_key, '')), '');
  v_status text := lower(trim(coalesce(p_status, 'all')));
  v_metrics jsonb;
  v_sync jsonb;
  v_categories jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_new_awards jsonb := '[]'::jsonb;
  v_next_badge jsonb := 'null'::jsonb;
  v_total integer := 0;
  v_total_all integer := 0;
  v_unlocked_all integer := 0;
  v_featured_badge_id text;
  v_equipped_frame_key text := 'explorer';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_status not in ('all', 'unlocked', 'locked') then
    raise exception 'Invalid badge status';
  end if;

  if v_category_key is not null and not exists (
    select 1
    from public.badge_categories bc
    where bc.category_key = v_category_key
      and bc.is_active = true
  ) then
    raise exception 'Badge category not found';
  end if;

  v_sync := public.sync_student_badges();
  v_metrics := public.get_student_badge_metrics();

  select
    coalesce(pc.equipped_frame_key, 'explorer'),
    pc.featured_badge_id
  into v_equipped_frame_key, v_featured_badge_id
  from (select v_user_id as user_id) current_user_row
  left join public.profile_cosmetics pc on pc.user_id = current_user_row.user_id;

  select
    count(*)::integer,
    count(sb.badge_id)::integer
  into v_total_all, v_unlocked_all
  from public.badge_definitions bd
  left join public.student_badges sb
    on sb.student_id = v_user_id
   and sb.badge_id = bd.badge_id
  where bd.is_active = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', bc.category_key,
    'name', bc.name,
    'description', bc.description,
    'icon', bc.icon,
    'color', bc.color,
    'total_count', (
      select count(*)::integer
      from public.badge_definitions bd
      where bd.category_key = bc.category_key
        and bd.is_active = true
    ),
    'unlocked_count', (
      select count(*)::integer
      from public.badge_definitions bd
      join public.student_badges sb
        on sb.student_id = v_user_id
       and sb.badge_id = bd.badge_id
      where bd.category_key = bc.category_key
        and bd.is_active = true
    )
  ) order by bc.sort_order, bc.category_key), '[]'::jsonb)
  into v_categories
  from public.badge_categories bc
  where bc.is_active = true
    and exists (
      select 1
      from public.badge_definitions bd
      where bd.category_key = bc.category_key
        and bd.is_active = true
    );

  with catalog as (
    select
      bd.*,
      bc.name as category_name,
      bc.icon as category_icon,
      bc.color as category_color,
      case
        when coalesce((v_metrics ->> 'total_answers')::integer, 0) < bd.minimum_samples then 0
        else public.badge_metric_value(bd.metric_key, v_metrics)
      end as current_value,
      sb.awarded_at,
      sb.badge_id is not null as unlocked
    from public.badge_definitions bd
    join public.badge_categories bc
      on bc.category_key = bd.category_key
     and bc.is_active = true
    left join public.student_badges sb
      on sb.student_id = v_user_id
     and sb.badge_id = bd.badge_id
    where bd.is_active = true
  ),
  filtered as (
    select *
    from catalog
    where (v_category_key is null or category_key = v_category_key)
      and (v_status = 'all' or (v_status = 'unlocked' and unlocked) or (v_status = 'locked' and not unlocked))
  )
  select count(*)::integer
  into v_total
  from filtered;

  with catalog as (
    select
      bd.*,
      bc.name as category_name,
      bc.icon as category_icon,
      bc.color as category_color,
      case
        when coalesce((v_metrics ->> 'total_answers')::integer, 0) < bd.minimum_samples then 0
        else public.badge_metric_value(bd.metric_key, v_metrics)
      end as current_value,
      sb.awarded_at,
      sb.badge_id is not null as unlocked
    from public.badge_definitions bd
    join public.badge_categories bc
      on bc.category_key = bd.category_key
     and bc.is_active = true
    left join public.student_badges sb
      on sb.student_id = v_user_id
     and sb.badge_id = bd.badge_id
    where bd.is_active = true
  ),
  filtered as (
    select *
    from catalog
    where (v_category_key is null or category_key = v_category_key)
      and (v_status = 'all' or (v_status = 'unlocked' and unlocked) or (v_status = 'locked' and not unlocked))
  ),
  paged as (
    select *
    from filtered
    order by sort_order, badge_id
    offset v_page * v_page_size
    limit v_page_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', badge_id,
    'category_key', category_key,
    'category_name', category_name,
    'category_icon', category_icon,
    'category_color', category_color,
    'title', title,
    'detail', description,
    'requirement', requirement,
    'icon', icon,
    'color', color,
    'reward_xp', reward_xp,
    'current', current_value,
    'target', target_value,
    'unit_singular', unit_singular,
    'unit_plural', unit_plural,
    'unlocked', unlocked,
    'awarded_at', awarded_at
  ) order by sort_order, badge_id), '[]'::jsonb)
  into v_items
  from paged;

  select coalesce((
    select jsonb_build_object(
      'id', bd.badge_id,
      'category_key', bd.category_key,
      'category_name', bc.name,
      'category_icon', bc.icon,
      'category_color', bc.color,
      'title', bd.title,
      'detail', bd.description,
      'requirement', bd.requirement,
      'icon', bd.icon,
      'color', bd.color,
      'reward_xp', bd.reward_xp,
      'current', case
        when coalesce((v_metrics ->> 'total_answers')::integer, 0) < bd.minimum_samples then 0
        else public.badge_metric_value(bd.metric_key, v_metrics)
      end,
      'target', bd.target_value,
      'unit_singular', bd.unit_singular,
      'unit_plural', bd.unit_plural,
      'unlocked', false,
      'awarded_at', null
    )
    from public.badge_definitions bd
    join public.badge_categories bc on bc.category_key = bd.category_key and bc.is_active = true
    where bd.is_active = true
      and not exists (
        select 1
        from public.student_badges sb
        where sb.student_id = v_user_id
          and sb.badge_id = bd.badge_id
      )
    order by (
      case
        when coalesce((v_metrics ->> 'total_answers')::integer, 0) < bd.minimum_samples then 0
        else public.badge_metric_value(bd.metric_key, v_metrics)
      end
    )::numeric / greatest(bd.target_value, 1) desc,
    bd.sort_order,
    bd.badge_id
    limit 1
  ), 'null'::jsonb)
  into v_next_badge;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', bd.badge_id,
    'category_key', bd.category_key,
    'category_name', bc.name,
    'category_icon', bc.icon,
    'category_color', bc.color,
    'title', bd.title,
    'detail', bd.description,
    'requirement', bd.requirement,
    'icon', bd.icon,
    'color', bd.color,
    'reward_xp', coalesce((award.value ->> 'reward_xp')::integer, bd.reward_xp),
    'current', bd.target_value,
    'target', bd.target_value,
    'unit_singular', bd.unit_singular,
    'unit_plural', bd.unit_plural,
    'unlocked', true,
    'awarded_at', award.value ->> 'awarded_at'
  )), '[]'::jsonb)
  into v_new_awards
  from jsonb_array_elements(coalesce(v_sync -> 'new_awards', '[]'::jsonb)) award(value)
  join public.badge_definitions bd on bd.badge_id = award.value ->> 'badge_id'
  join public.badge_categories bc on bc.category_key = bd.category_key;

  return jsonb_build_object(
    'categories', v_categories,
    'items', v_items,
    'pagination', jsonb_build_object(
      'page', v_page,
      'page_size', v_page_size,
      'total', v_total,
      'has_more', ((v_page + 1) * v_page_size) < v_total
    ),
    'summary', jsonb_build_object(
      'total', v_total_all,
      'unlocked', v_unlocked_all,
      'locked', greatest(v_total_all - v_unlocked_all, 0),
      'completion_percent', case when v_total_all > 0 then round((v_unlocked_all::numeric / v_total_all::numeric) * 100)::integer else 0 end,
      'streak_days', coalesce((v_metrics ->> 'streak_days')::integer, 0)
    ),
    'next_badge', v_next_badge,
    'featured_badge_id', v_featured_badge_id,
    'equipped_frame_key', v_equipped_frame_key,
    'awarded_xp', coalesce((v_sync ->> 'awarded_xp')::integer, 0),
    'new_awards', v_new_awards
  );
end;
$$;

revoke all on function public.get_student_badge_metrics() from public, anon, authenticated;
revoke all on function public.badge_metric_value(text, jsonb) from public, anon, authenticated;
revoke all on function public.sync_student_badges() from public, anon;
revoke all on function public.get_student_badge_catalog(integer, integer, text, text) from public, anon;
grant execute on function public.sync_student_badges() to authenticated;
grant execute on function public.get_student_badge_catalog(integer, integer, text, text) to authenticated;

notify pgrst, 'reload schema';
