import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('teacher question deletion preserves historical attempts through server-side archiving', () => {
  const edgeFunction = read('supabase/functions/teacher-delete-question/index.ts')
  const sharedTeacher = read('supabase/functions/_shared/teacher.ts')
  const migration = read('supabase/migrations/20260803191000_teacher_question_archive.sql')
  const reportHook = read('hooks/teacher/useQuestionReport.ts')

  assert.match(sharedTeacher, /userClient: any/)
  assert.match(sharedTeacher, /return \{[\s\S]*userClient,/)
  assert.match(edgeFunction, /context\.userClient\.rpc\('archive_teacher_question'/)
  assert.doesNotMatch(edgeFunction, /\.from\('questions'\)[\s\S]*\.delete\(\)/)
  assert.doesNotMatch(edgeFunction, /writeTeacherAudit/)
  assert.match(migration, /and subject\.teacher_id = v_teacher_id/)
  assert.match(migration, /set active = false/)
  assert.match(migration, /teacher\.question\.archive/)
  assert.match(reportHook, /supabase\.functions\.invoke\('teacher-delete-question'/)
  assert.doesNotMatch(reportHook, /\.from\('questions'\)\.update\(\{ active: false \}\)/)
})

test('administrative authorization fails closed when permission context is unavailable', () => {
  const sharedAdmin = read('supabase/functions/_shared/admin.ts')

  assert.match(sharedAdmin, /authorization_unavailable/)
  assert.match(sharedAdmin, /No se pudieron verificar los permisos administrativos/)
  assert.doesNotMatch(sharedAdmin, /permissions = \['dashboard\.read'/)
})

test('outbound email defaults to redirect mode outside explicitly configured production delivery', () => {
  for (const path of [
    'supabase/functions/import-students/index.ts',
    'supabase/functions/teacher-student-reminder/index.ts',
    'supabase/functions/process-support-email-delivery/index.ts',
  ]) {
    const implementation = read(path)
    assert.match(implementation, /Deno\.env\.get\('EMAIL_DELIVERY_MODE'\) \|\| 'redirect'/)
    assert.doesNotMatch(implementation, /Deno\.env\.get\('EMAIL_DELIVERY_MODE'\) \|\| 'real'/)
  }
})

test('CSV exports share formula-injection protection', () => {
  const csv = read('supabase/functions/_shared/csv.ts')
  const adminExport = read('supabase/functions/process-admin-export-jobs/index.ts')
  const teacherExport = read('supabase/functions/process-teacher-audit-exports/index.ts')

  assert.match(csv, /\^\[\\t\\r\]/)
  assert.match(csv, /\^\[=\+@-\]/)
  assert.match(csv, /trimStart\(\)/)
  assert.match(csv, /`'\$\{raw\}`/)
  assert.match(adminExport, /import \{ csvCell \} from '\.\.\/_shared\/csv\.ts'/)
  assert.match(teacherExport, /import \{ csvCell \} from '\.\.\/_shared\/csv\.ts'/)
})

test('course visibility policy avoids recursive RLS evaluation through enrollments', () => {
  const migration = read('supabase/migrations/20260803193000_teacher_authorization_hardening.sql')

  assert.match(migration, /public\.is_subject_enrolled\(subjects\.id\)/)
  assert.doesNotMatch(migration, /from public\.enrollments enrollment/)
  assert.match(migration, /revoke all on table public\.subjects from public, anon, authenticated/)
  assert.match(migration, /grant select on table public\.subjects to authenticated/)
  assert.match(migration, /revoke select on table public\.questions, public\.answers from public, anon/)
  assert.match(migration, /grant select on table public\.questions, public\.answers to authenticated/)
})

test('student progress reads are explicitly granted only through RLS-scoped tables', () => {
  const historicalGrant = read('supabase/migrations/20260803201000_attempt_history_select_grant.sql')
  const finalGrant = read('supabase/migrations/20260805113000_progress_read_privileges.sql')

  assert.match(historicalGrant, /grant select on table public\.attempt_history to authenticated/)
  assert.match(finalGrant, /revoke select on table public\.attempt_history, public\.student_badges from public, anon/)
  assert.match(finalGrant, /grant select on table public\.attempt_history, public\.student_badges to authenticated/)
  assert.doesNotMatch(finalGrant, /grant all/)
})

test('expired classroom invitation codes are rejected by the enrollment RPC', () => {
  const migration = read('supabase/migrations/20260805123000_expired_classroom_code_enforcement.sql')

  assert.match(migration, /v_classroom\.code_expires_at is not null/)
  assert.match(migration, /v_classroom\.code_expires_at <= now\(\)/)
  assert.match(migration, /Este código de clase ha caducado\./)
  assert.match(migration, /grant execute on function public\.join_subject_by_code\(text\) to authenticated, service_role/)
})


test('service-role clients retain explicit data and sequence privileges', () => {
  const migration = read('supabase/migrations/20260805125500_service_role_data_access.sql')

  assert.match(migration, /grant select, insert, update, delete on all tables in schema public to service_role/)
  assert.match(migration, /grant usage, select on all sequences in schema public to service_role/)
  assert.doesNotMatch(migration, /to anon|to authenticated/)
})


test('authenticated profile and notification-state access is explicit and RLS-scoped', () => {
  const migration = read('supabase/migrations/20260805134500_authenticated_profile_notification_access.sql')

  assert.match(migration, /revoke all on table public\.profiles, public\.notification_state from public, anon, authenticated/)
  assert.match(migration, /grant select, update on table public\.profiles to authenticated/)
  assert.match(migration, /grant select, insert, update on table public\.notification_state to authenticated/)
  assert.match(migration, /revoke all on sequence public\.notification_state_id_seq from public, anon, authenticated/)
  assert.match(migration, /grant usage, select on sequence public\.notification_state_id_seq to authenticated/)
  assert.doesNotMatch(migration, /grant all/)
})


test('notification preferences and protected notification RPCs retain explicit client access', () => {
  const migration = read('supabase/migrations/20260805143000_notification_client_access.sql')

  assert.match(migration, /revoke all on table public\.user_notification_preferences from public, anon, authenticated/)
  assert.match(migration, /grant select, insert, update on table public\.user_notification_preferences to authenticated/)
  assert.match(migration, /grant execute on function public\.get_notifications_page\(text, integer, timestamptz, uuid\) to authenticated, service_role/)
  assert.match(migration, /grant execute on function public\.mark_notifications_read\(uuid\[\]\) to authenticated, service_role/)
  assert.match(migration, /grant execute on function public\.delete_notifications\(uuid\[\]\) to authenticated, service_role/)
  assert.doesNotMatch(migration, /grant all/)
})


test('teacher classroom creation is finalized as a protected server operation', () => {
  const historicalMigration = read('supabase/migrations/20260805160000_teacher_classroom_access.sql')
  const finalMatrix = read('supabase/migrations/20260805200000_authenticated_walkthrough_authorization_matrix.sql')

  assert.match(historicalMigration, /alter function public\.create_teacher_classroom\(bigint, text, text\) owner to postgres/)
  assert.match(historicalMigration, /alter function public\.create_teacher_classroom\(bigint, text, text\) security definer/)
  assert.match(historicalMigration, /grant execute on function public\.create_teacher_classroom\(bigint, text, text\) to authenticated, service_role/)
  assert.match(finalMatrix, /grant select on table public\.subjects, public\.classrooms, public\.subject_topics, public\.questions, public\.answers to authenticated/)
  assert.match(finalMatrix, /revoke all on sequence public\.classrooms_id_seq[\s\S]*from public, anon, authenticated/)
  assert.doesNotMatch(finalMatrix, /grant (insert|update|delete) on table public\.classrooms to authenticated/)
})


test('teacher topic creation keeps writes server-side and reads RLS-scoped', () => {
  const migration = read('supabase/migrations/20260805163000_teacher_topic_access.sql')
  const edgeFunction = read('supabase/functions/teacher-create-topic/index.ts')

  assert.match(migration, /revoke all on table public\.subject_topics from public, anon, authenticated/)
  assert.match(migration, /grant select on table public\.subject_topics to authenticated/)
  assert.match(migration, /grant select, insert, update, delete on table public\.subject_topics to service_role/)
  assert.match(migration, /grant usage, select on sequence public\.subject_topics_id_seq to service_role/)
  assert.doesNotMatch(migration, /grant (insert|update|delete).*to authenticated/)
  assert.match(edgeFunction, /context\.adminClient[\s\S]*\.from\('subject_topics'\)[\s\S]*\.insert\(/)
})


test('authenticated learning workflows use explicit RLS-scoped privileges', () => {
  const migration = read('supabase/migrations/20260805170000_authenticated_learning_workflow_access.sql')
  const authorizationTests = read('supabase/tests/010_release_authorization_hardening.sql')

  assert.match(migration, /grant select, delete on table public\.enrollments to authenticated/)
  assert.match(migration, /grant select on table public\.subject_scores, public\.topic_scores to authenticated/)
  assert.match(migration, /grant select, insert, update on table public\.user_preferences to authenticated/)
  assert.match(migration, /grant select, insert on table public\.user_support_tickets to authenticated/)
  assert.match(migration, /grant usage, select on sequence public\.user_support_tickets_id_seq to authenticated/)
  assert.match(migration, /create policy "enrollments_delete_self"[\s\S]*using \(student_id = auth\.uid\(\)\)/)
  assert.doesNotMatch(migration, /grant (insert|update) on table public\.enrollments to authenticated/)
  assert.doesNotMatch(migration, /grant (insert|update|delete) on table public\.(subject_scores|topic_scores) to authenticated/)
  assert.doesNotMatch(authorizationTests, /\(with\s+\w+\s+as\s*\(\s*delete/i)
  assert.match(authorizationTests, /delete from public\.enrollments[\s\S]*teachers cannot bypass the server operation/)
  assert.match(authorizationTests, /delete from public\.enrollments[\s\S]*students can leave their own enrollment/)
})


test('private question media remains server-controlled during teacher question creation', () => {
  const migration = read('supabase/migrations/20260805183000_question_media_server_authorization.sql')
  const authorizationTests = read('supabase/tests/010_release_authorization_hardening.sql')

  assert.match(migration, /grant select, insert, update, delete on table public\.question_media_assets to service_role/)
  assert.match(migration, /alter function public\.save_teacher_question\([\s\S]*\) owner to postgres/)
  assert.match(migration, /alter function public\.save_teacher_question\([\s\S]*\) security definer/)
  assert.match(migration, /create or replace function public\.can_access_question_media_object\(p_name text\)/)
  assert.match(migration, /and public\.can_access_question_media_object\(name\)/)
  assert.doesNotMatch(migration, /grant (select|insert|update|delete).*question_media_assets to authenticated/)
  assert.match(authorizationTests, /the owning teacher can create a question with validated private media/)
  assert.match(authorizationTests, /protected question creation attaches the validated private-media asset/)
})
