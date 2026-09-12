import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('topic archive and restore preserve each question individual archived state', () => {
  const migration = read('supabase/migrations/20260912213000_teacher_topic_question_lifecycle.sql')
  const lifecycle = migration.slice(migration.indexOf('create or replace function public.set_teacher_topic_archived'), migration.indexOf('revoke all on function public.set_teacher_topic_archived'))

  assert.match(lifecycle, /update public\.subject_topics set active = v_next_active/)
  assert.doesNotMatch(lifecycle, /update public\.questions/)
  assert.match(lifecycle, /teacher\.topic\.archive/)
  assert.match(lifecycle, /teacher\.topic\.restore/)
  assert.match(lifecycle, /curso esté archivado o inactivo/)
})

test('teacher topic and question permanent deletion is server guarded and audited', () => {
  const migration = read('supabase/migrations/20260912213000_teacher_topic_question_lifecycle.sql')
  const edge = read('supabase/functions/teacher-delete-question/index.ts')

  assert.match(migration, /create or replace function public\.delete_teacher_question/)
  assert.match(migration, /select count\(\*\) into v_attempts from public\.attempt_history/)
  assert.match(migration, /teacher\.question\.delete/)
  assert.match(migration, /create or replace function public\.delete_teacher_topic/)
  assert.match(migration, /from public\.game_attempts where topic_id = v_topic\.id/)
  assert.match(migration, /from public\.topic_scores where topic_id = v_topic\.id/)
  assert.match(migration, /from public\.learning_tasks where topic_id = v_topic\.id/)
  assert.match(migration, /delete from public\.questions where topic_id = v_topic\.id/)
  assert.match(migration, /teacher\.topic\.delete/)
  assert.match(edge, /rpc\('delete_teacher_question'/)
})

test('archived topics and questions have explicit teacher catalog filters', () => {
  const migration = read('supabase/migrations/20260912213000_teacher_topic_question_lifecycle.sql')
  const topicHook = read('hooks/teacher/subject/useTeacherSubjectTopics.ts')
  const questionHook = read('hooks/teacher/subject/useTeacherSubjectQuestions.ts')
  const topicUi = read('components/teacher/subject/SubjectCourseStructure.tsx')
  const questionUi = read('components/teacher/subject/SubjectQuestionsTab.tsx')

  assert.match(migration, /p_visibility text default 'active'/)
  assert.match(migration, /v_visibility not in \('active', 'archived'\)/)
  assert.match(migration, /p_visibility text default 'visible'/)
  assert.match(migration, /v_visibility not in \('all', 'visible', 'archived'\)/)
  assert.match(topicHook, /p_visibility: visibility/)
  assert.match(questionHook, /p_visibility: visibility/)
  assert.match(topicUi, /label: 'Archivados'/)
  assert.match(topicUi, /No tienes temas archivados/)
  assert.match(topicUi, /Restaurar/)
  assert.match(topicUi, /Eliminar/)
  assert.match(questionUi, /label: 'Archivadas'/)
  assert.match(questionUi, /No hay preguntas archivadas/)
  assert.match(questionUi, /Archivar/)
  assert.match(questionUi, /Restaurar/)
  assert.match(questionUi, /Eliminar/)
})

test('student game payload excludes active questions whose parent topic is archived', () => {
  const migration = read('supabase/migrations/20260912213000_teacher_topic_question_lifecycle.sql')

  assert.match(migration, /left join public\.subject_topics st on st\.id = q\.topic_id/)
  assert.match(migration, /q\.topic_id is null or coalesce\(st\.active, true\)/)
  assert.match(migration, /create or replace function public\.get_student_question_catalog/)
})

test('question reports remain available for archived questions and expose restore/delete actions', () => {
  const actions = read('components/teacher/question-report/QuestionReportActions.tsx')
  const hook = read('hooks/teacher/useQuestionReport.ts')
  const screen = read('app/(teacher)/question-report/[id].tsx')

  assert.match(actions, /label="Restaurar"/)
  assert.match(actions, /label="Eliminar definitivamente"/)
  assert.match(hook, /const restore = useCallback/)
  assert.match(hook, /const deletePermanent = useCallback/)
  assert.match(screen, /onRestore=\{\(\) => setQuestionAction\('restore'\)\}/)
  assert.match(screen, /onDelete=\{\(\) => setQuestionAction\('delete'\)\}/)
})
