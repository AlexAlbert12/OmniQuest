create or replace function public.fill_course_classroom_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_id bigint;
  v_topic_id bigint := nullif(to_jsonb(new)->>'topic_id', '')::bigint;
begin
  if tg_table_name in ('questions', 'topic_scores')
    and v_topic_id is not null
    and new.classroom_id is null then
    select classroom_id
    into new.classroom_id
    from public.subject_topics
    where id = v_topic_id;
  end if;

  if new.classroom_id is null and new.subject_id is not null then
    new.classroom_id := public.ensure_default_classroom(new.subject_id);
  end if;

  if new.classroom_id is not null then
    select subject_id
    into v_subject_id
    from public.classrooms
    where id = new.classroom_id;

    if v_subject_id is null then
      raise exception 'Clase no encontrada.';
    end if;

    if new.subject_id is null then
      new.subject_id := v_subject_id;
    elsif new.subject_id <> v_subject_id then
      raise exception 'La clase no pertenece a este curso.';
    end if;
  end if;

  return new;
end;
$$;
