alter table public.subjects enable row level security;
alter table public.subject_topics enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.enrollments enable row level security;
alter table public.subject_scores enable row level security;
alter table public.topic_scores enable row level security;
alter table public.attempt_history enable row level security;
alter table public.student_badges enable row level security;
alter table public.user_support_tickets enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.notification_state enable row level security;

drop policy if exists "subjects_select_authenticated" on public.subjects;
drop policy if exists "subjects_insert_own_teacher" on public.subjects;
drop policy if exists "subjects_update_own_teacher" on public.subjects;
drop policy if exists "subjects_delete_own_teacher" on public.subjects;

create policy "subjects_select_authenticated"
on public.subjects for select to authenticated using (true);

create policy "subjects_insert_own_teacher"
on public.subjects for insert to authenticated with check (teacher_id = auth.uid());

create policy "subjects_update_own_teacher"
on public.subjects for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "subjects_delete_own_teacher"
on public.subjects for delete to authenticated using (teacher_id = auth.uid());

drop policy if exists "subject_topics_select_teacher_or_enrolled" on public.subject_topics;
drop policy if exists "subject_topics_insert_own_teacher" on public.subject_topics;
drop policy if exists "subject_topics_update_own_teacher" on public.subject_topics;
drop policy if exists "subject_topics_delete_own_teacher" on public.subject_topics;

create policy "subject_topics_select_teacher_or_enrolled"
on public.subject_topics for select to authenticated
using (
  exists (
    select 1 from public.subjects
    where subjects.id = subject_topics.subject_id
      and (
        subjects.teacher_id = auth.uid()
        or exists (
          select 1 from public.enrollments
          where enrollments.subject_id = subjects.id
            and enrollments.student_id = auth.uid()
        )
      )
  )
);

create policy "subject_topics_insert_own_teacher"
on public.subject_topics for insert to authenticated
with check (
  exists (
    select 1 from public.subjects
    where subjects.id = subject_topics.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "subject_topics_update_own_teacher"
on public.subject_topics for update to authenticated
using (
  exists (
    select 1 from public.subjects
    where subjects.id = subject_topics.subject_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.subjects
    where subjects.id = subject_topics.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "subject_topics_delete_own_teacher"
on public.subject_topics for delete to authenticated
using (
  exists (
    select 1 from public.subjects
    where subjects.id = subject_topics.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy if exists "questions_select_teacher_or_enrolled" on public.questions;
drop policy if exists "questions_insert_own_teacher" on public.questions;
drop policy if exists "questions_update_own_teacher" on public.questions;
drop policy if exists "questions_delete_own_teacher" on public.questions;

create policy "questions_select_teacher_or_enrolled"
on public.questions for select to authenticated
using (
  exists (
    select 1 from public.subjects
    where subjects.id = questions.subject_id
      and (
        subjects.teacher_id = auth.uid()
        or exists (
          select 1 from public.enrollments
          where enrollments.subject_id = subjects.id
            and enrollments.student_id = auth.uid()
        )
      )
  )
);

create policy "questions_insert_own_teacher"
on public.questions for insert to authenticated
with check (
  exists (
    select 1 from public.subjects
    where subjects.id = questions.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "questions_update_own_teacher"
on public.questions for update to authenticated
using (
  exists (
    select 1 from public.subjects
    where subjects.id = questions.subject_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.subjects
    where subjects.id = questions.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "questions_delete_own_teacher"
on public.questions for delete to authenticated
using (
  exists (
    select 1 from public.subjects
    where subjects.id = questions.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy if exists "answers_select_teacher_or_enrolled" on public.answers;
drop policy if exists "answers_insert_own_teacher" on public.answers;
drop policy if exists "answers_update_own_teacher" on public.answers;
drop policy if exists "answers_delete_own_teacher" on public.answers;

create policy "answers_select_teacher_or_enrolled"
on public.answers for select to authenticated
using (
  exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = answers.question_id
      and (
        subjects.teacher_id = auth.uid()
        or exists (
          select 1 from public.enrollments
          where enrollments.subject_id = subjects.id
            and enrollments.student_id = auth.uid()
        )
      )
  )
);

create policy "answers_insert_own_teacher"
on public.answers for insert to authenticated
with check (
  exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = answers.question_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "answers_update_own_teacher"
on public.answers for update to authenticated
using (
  exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = answers.question_id
      and subjects.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = answers.question_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "answers_delete_own_teacher"
on public.answers for delete to authenticated
using (
  exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = answers.question_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy if exists "enrollments_select_self_or_teacher" on public.enrollments;
drop policy if exists "enrollments_insert_self" on public.enrollments;
drop policy if exists "enrollments_delete_self_or_teacher" on public.enrollments;

create policy "enrollments_select_self_or_teacher"
on public.enrollments for select to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.subjects
    where subjects.id = enrollments.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "enrollments_insert_self"
on public.enrollments for insert to authenticated
with check (student_id = auth.uid());

create policy "enrollments_delete_self_or_teacher"
on public.enrollments for delete to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.subjects
    where subjects.id = enrollments.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy if exists "subject_scores_select_self_or_teacher" on public.subject_scores;
drop policy if exists "subject_scores_insert_self" on public.subject_scores;
drop policy if exists "subject_scores_update_self" on public.subject_scores;
drop policy if exists "subject_scores_delete_self_or_teacher" on public.subject_scores;

create policy "subject_scores_select_self_or_teacher"
on public.subject_scores for select to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.subjects
    where subjects.id = subject_scores.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "subject_scores_insert_self"
on public.subject_scores for insert to authenticated
with check (student_id = auth.uid());

create policy "subject_scores_update_self"
on public.subject_scores for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "subject_scores_delete_self_or_teacher"
on public.subject_scores for delete to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.subjects
    where subjects.id = subject_scores.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy if exists "topic_scores_select_self_or_teacher" on public.topic_scores;
drop policy if exists "topic_scores_insert_self" on public.topic_scores;
drop policy if exists "topic_scores_update_self" on public.topic_scores;
drop policy if exists "topic_scores_delete_self_or_teacher" on public.topic_scores;

create policy "topic_scores_select_self_or_teacher"
on public.topic_scores for select to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.subjects
    where subjects.id = topic_scores.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "topic_scores_insert_self"
on public.topic_scores for insert to authenticated
with check (student_id = auth.uid());

create policy "topic_scores_update_self"
on public.topic_scores for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "topic_scores_delete_self_or_teacher"
on public.topic_scores for delete to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1 from public.subjects
    where subjects.id = topic_scores.subject_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy if exists "attempt_history_select_self_or_teacher" on public.attempt_history;
drop policy if exists "attempt_history_insert_self" on public.attempt_history;
drop policy if exists "attempt_history_delete_self_or_teacher" on public.attempt_history;

create policy "attempt_history_select_self_or_teacher"
on public.attempt_history for select to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = attempt_history.question_id
      and subjects.teacher_id = auth.uid()
  )
);

create policy "attempt_history_insert_self"
on public.attempt_history for insert to authenticated
with check (student_id = auth.uid());

create policy "attempt_history_delete_self_or_teacher"
on public.attempt_history for delete to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.questions
    join public.subjects on subjects.id = questions.subject_id
    where questions.id = attempt_history.question_id
      and subjects.teacher_id = auth.uid()
  )
);

drop policy if exists "student_badges_self" on public.student_badges;
create policy "student_badges_self"
on public.student_badges for all to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "user_support_tickets_self" on public.user_support_tickets;
create policy "user_support_tickets_self"
on public.user_support_tickets for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_preferences_self" on public.user_preferences;
create policy "user_preferences_self"
on public.user_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_notification_preferences_self" on public.user_notification_preferences;
create policy "user_notification_preferences_self"
on public.user_notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "notification_state_self" on public.notification_state;
create policy "notification_state_self"
on public.notification_state for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
