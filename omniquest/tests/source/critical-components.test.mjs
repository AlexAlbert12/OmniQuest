import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('login validates fields before calling Supabase auth', () => {
  const source = read('app/(auth)/login.tsx')

  assert.match(source, /isValidEmail\(normalizedEmail\)/)
  assert.match(source, /if \(!password\)/)
  assert.match(source, /signInWithPassword\(/)
  assert.match(source, /setLoading\(true\)/)
})

test('game submission is server-scored and does not calculate correctness in the component', () => {
  const source = read('hooks/useGame.ts')

  assert.match(source, /rpc[\s\S]*['"]submit_answer_resumable['"]/)
  assert.match(source, /p_attempt_id:\s*attemptIdRef\.current/)
  assert.match(source, /get_safe_game_questions/)
  assert.doesNotMatch(source, /\.is_correct\s*===\s*true\s*\?\s*.*points_base/)
})

test('teacher question form validates content and saves through the transactional RPC', () => {
  const source = read('components/teacher/TeacherQuestionForm.tsx')

  assert.match(source, /const validateContentStep/)
  assert.match(source, /const validateOptionsStep/)
  assert.match(source, /rpc\(['"]save_teacher_question['"]/)
  assert.match(source, /p_answers:\s*answersToSave/)
})

test('student import validates emails and delegates privileged work to an Edge Function', () => {
  const source = read('components/teacher/TeacherStudentImportModal.tsx')

  assert.match(source, /parseEmails\(rawEmails\)/)
  assert.match(source, /validEmails\.length === 0/)
  assert.match(source, /functions\.invoke\(['"]import-students['"]/)
  assert.match(source, /subjectId/)
  assert.match(source, /classroomId/)
})
