-- Idempotent answer submission used by offline/retry support.

create table if not exists public.game_answer_submission_receipts (
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (student_id, submission_id)
);

create index if not exists game_answer_submission_receipts_created_at_idx
  on public.game_answer_submission_receipts(created_at);

alter table public.game_answer_submission_receipts enable row level security;

revoke all on public.game_answer_submission_receipts from anon, authenticated;

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
begin
  if v_user_id is null then
    raise exception 'No authenticated user';
  end if;

  if p_submission_id is null then
    raise exception 'Submission id is required';
  end if;

  -- Serialize retries of the same answer without blocking unrelated students.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_submission_id::text, 0));

  select r.result
  into v_result
  from public.game_answer_submission_receipts r
  where r.student_id = v_user_id
    and r.submission_id = p_submission_id;

  if found then
    return v_result;
  end if;

  v_result := public.submit_answer(
    p_question_id => p_question_id,
    p_answer_id => p_answer_id,
    p_answer_text => p_answer_text,
    p_answer_payload => p_answer_payload,
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

revoke all on function public.submit_answer_resumable(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) from public, anon;
grant execute on function public.submit_answer_resumable(uuid, bigint, bigint, text, jsonb, integer, boolean, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
