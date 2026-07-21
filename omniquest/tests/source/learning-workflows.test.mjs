import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

const migrationPath = 'supabase/migrations/20260720120000_learning_planning_manual_review_media.sql'

test('teacher planning provides protected tasks, calendar pages and student completion', () => {
  const migration = read(migrationPath)
  const teacherPlanning = read('app/(teacher)/planning.tsx')
  const studentTasks = read('app/(student)/tasks.tsx')
  const calendar = read('components/planning/MonthCalendar.tsx')
  const editor = read('components/teacher/LearningTaskEditorModal.tsx')

  assert.match(migration, /create table if not exists public\.learning_tasks/)
  assert.match(migration, /create table if not exists public\.learning_task_completions/)
  assert.match(migration, /create or replace function public\.save_learning_task/)
  assert.match(migration, /create or replace function public\.get_teacher_learning_tasks_page/)
  assert.match(migration, /create or replace function public\.get_student_learning_tasks_page/)
  assert.match(migration, /create or replace function public\.set_learning_task_completed/)
  assert.match(migration, /learning_tasks_select_visible/)
  assert.match(teacherPlanning, /Planificación docente/)
  assert.match(teacherPlanning, /get_teacher_learning_tasks_page/)
  assert.match(studentTasks, /get_student_learning_tasks_page/)
  assert.match(studentTasks, /set_learning_task_completed/)
  assert.match(calendar, /getMonthGrid/)
  assert.match(editor, /save_learning_task/)
})

test('advanced manual review has a dedicated queue, comments and explicit states', () => {
  const migration = read(migrationPath)
  const reviews = read('app/(teacher)/reviews.tsx')

  assert.match(migration, /create table if not exists public\.manual_review_comments/)
  assert.match(migration, /'pending', 'in_review', 'needs_changes', 'approved', 'rejected'/)
  assert.match(migration, /create or replace function public\.get_teacher_manual_review_queue/)
  assert.match(migration, /create or replace function public\.claim_open_answer_attempt/)
  assert.match(migration, /create or replace function public\.add_manual_review_comment/)
  assert.match(migration, /create or replace function public\.review_open_answer_attempt_v2/)
  assert.match(migration, /create or replace function public\.get_activity_attempt_detail/)
  assert.match(migration, /perform public\.recalculate_student_points/)
  assert.match(reviews, /get_teacher_manual_review_queue/)
  assert.match(reviews, /get_manual_review_thread/)
  assert.match(reviews, /needs_changes/)
  assert.match(reviews, /nota interna/)
  const activity = read('app/(student)/activity-log.tsx')
  assert.match(activity, /Comentarios del profesor/)
  assert.match(activity, /Pendiente de revisión/)
})

test('question rich media is uploaded by teachers and rendered safely in game', () => {
  const migration = read(migrationPath)
  const mediaLib = read('lib/questionMedia.ts')
  const mediaView = read('components/questions/QuestionMedia.tsx')
  const mediaEditor = read('components/teacher/TeacherQuestionMediaEditor.tsx')
  const form = read('components/teacher/TeacherQuestionForm.tsx')
  const game = read('app/(student)/play/[id].tsx')

  assert.match(migration, /add column if not exists media_type text/)
  assert.match(migration, /'question-media'/)
  assert.match(migration, /questions_media_consistency_check/)
  assert.match(migration, /p_media_alt_text text default null/)
  assert.match(migration, /media_alt_text/)
  assert.match(mediaLib, /pickQuestionMedia/)
  assert.match(mediaLib, /uploadQuestionMedia/)
  assert.match(mediaLib, /cloneQuestionMedia/)
  assert.match(mediaEditor, /QuestionMedia/)
  assert.match(form, /TeacherQuestionMediaEditor/)
  assert.match(form, /p_media_type/)
  assert.match(game, /<QuestionMedia/)
  assert.match(mediaView, /useAudioPlayer/)
  assert.match(mediaView, /VideoView/)
})

test('new teacher and student routes are reachable from shared navigation', () => {
  const teacherSidebar = read('components/teacher/TeacherSidebar.tsx')
  const teacherBottomNav = read('components/teacher/TeacherBottomNav.tsx')
  const studentSidebar = read('components/student/StudentSidebar.tsx')
  const studentBottomNav = read('components/student/StudentBottomNav.tsx')

  assert.match(teacherSidebar, /\/\(teacher\)\/planning/)
  assert.match(teacherSidebar, /\/\(teacher\)\/reviews/)
  assert.match(teacherBottomNav, /active === 'planning'/)
  assert.match(teacherBottomNav, /active === 'reviews'/)
  assert.match(studentSidebar, /\/\(student\)\/tasks/)
  assert.match(studentBottomNav, /active === 'tasks'/)
})
