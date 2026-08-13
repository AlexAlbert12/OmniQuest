delete from public.notifications
where related_table = 'learning_tasks'
   or type = 'task'
   or action_url = '/(student)/tasks';

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'enrollment', 'student_activity', 'achievement', 'new_class', 'announcement',
    'manual_review', 'support'
  ));

drop function if exists public.set_learning_task_completed(bigint, boolean);
drop function if exists public.get_student_learning_tasks_page(text, text, integer, integer);
drop function if exists public.get_teacher_learning_tasks_page(bigint, bigint, text, text, timestamptz, timestamptz, integer, integer);
drop function if exists public.delete_learning_task(bigint);
drop function if exists public.save_learning_task(bigint, bigint, bigint, bigint, text, text, timestamptz, timestamptz, text, text);

do $$
begin
  if to_regclass('public.learning_tasks') is not null then
    execute 'drop trigger if exists touch_learning_task_updated_at on public.learning_tasks';
  end if;
end
$$;

drop table if exists public.learning_task_completions cascade;
drop table if exists public.learning_tasks cascade;

drop function if exists public.touch_learning_task_updated_at();

notify pgrst, 'reload schema';
