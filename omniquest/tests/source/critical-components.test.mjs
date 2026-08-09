import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('login validates fields before calling Supabase auth', () => {
  const source = read('app/(auth)/login.tsx')

  assert.match(source, /prepareAuthSubmission\(/)
  assert.match(source, /validateLoginForm/)
  assert.match(source, /signInWithPassword\(/)
  assert.match(source, /setLoading\(true\)/)
})

test('game submission is server-scored and does not calculate correctness in the component', () => {
  const source = read('hooks/useGame.ts')

  assert.match(source, /rpc[\s\S]*['"]submit_answer_resumable['"]/)
  assert.match(source, /p_attempt_id:\s*attemptIdRef\.current/)
  assert.match(source, /rpc\(['"]get_safe_game_questions_v2['"]/)
  assert.doesNotMatch(source, /\.is_correct\s*===\s*true\s*\?\s*.*points_base/)
})

test('teacher question form delegates validation and persistence to the reusable form hook', () => {
  const form = read('components/teacher/TeacherQuestionForm.tsx')
  const hook = read('components/teacher/question-form/useTeacherQuestionForm.ts')
  const validation = read('components/teacher/question-form/utils.ts')

  assert.match(form, /useTeacherQuestionForm\(props\)/)
  assert.match(form, /QuestionTypeSelector/)
  assert.match(form, /QuestionSettingsPanel/)
  assert.match(form, /QuestionValidationPanel/)
  assert.match(validation, /getQuestionValidationIssues/)
  assert.match(hook, /rpc\(['"]save_teacher_question_v2['"]/)
  assert.match(hook, /p_hint:\s*hint\.trim\(\) \|\| null/)
  assert.match(hook, /p_answers:\s*answersToSave/)
})

test('student import validates emails and delegates privileged work to an Edge Function', () => {
  const source = read('components/teacher/TeacherStudentImportModal.tsx')

  assert.match(source, /parseEmails\(rawEmails\)/)
  assert.match(source, /validEmails\.length === 0/)
  assert.match(source, /functions\.invoke\(['"]import-students['"]/)
  assert.match(source, /subjectId/)
  assert.match(source, /classroomId/)
})
