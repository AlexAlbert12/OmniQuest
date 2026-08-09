import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function walk(path) {
  const absolute = join(root, path)
  const entries = readdirSync(absolute)
  return entries.flatMap((entry) => {
    const next = join(absolute, entry)
    if (statSync(next).isDirectory()) return walk(relative(root, next))
    return [relative(root, next)]
  })
}

test('student code never reads questions or answers directly', () => {
  const files = [
    ...walk('app/(student)'),
    ...walk('components/student'),
    'hooks/useGame.ts',
    'lib/studentProgress.ts',
    'lib/notifications/derivedStudent.ts',
  ].filter((path) => /\.(ts|tsx)$/.test(path))

  const violations = files.flatMap((path) => {
    const source = read(path)
    const matches = [
      ...source.matchAll(/\.from\(\s*['"](?:questions|answers)['"]\s*\)/g),
    ]
    return matches.map((match) => `${path}:${source.slice(0, match.index).split('\n').length}`)
  })

  assert.deepEqual(violations, [], `Direct answer-key reads found:\n${violations.join('\n')}`)
})

test('game uses the safe question and post-attempt feedback RPCs', () => {
  const source = read('hooks/useGame.ts')

  assert.match(source, /rpc\(['"]get_safe_game_questions_v2['"]/)
  assert.match(source, /fetchAttemptFeedback\(/)
  assert.doesNotMatch(source, /rpc\(['"]get_game_questions['"]/)
  assert.doesNotMatch(source, /currentQ\.explanation/)
})

test('student activity loads safe summaries and fetches details lazily', () => {
  const source = read('app/(student)/activity-log.tsx')

  assert.match(source, /fetchStudentAttemptHistoryPage\(/)
  assert.match(source, /fetchActivityAttemptDetail\(attemptId\)/)
  assert.match(source, /PaginationControls/)
  assert.doesNotMatch(source, /\.from\(['"]attempt_history['"]\)[\s\S]{0,500}questions\s*\(/)
})

test('security migration revokes the legacy RPC and removes student answer-key policies', () => {
  const source = read('supabase/migrations/20260720094000_secure_student_game_data.sql')

  assert.match(source, /drop policy if exists "questions_select_teacher_or_enrolled"/)
  assert.match(source, /drop policy if exists "answers_select_teacher_or_enrolled"/)
  assert.match(source, /revoke execute on function public\.get_game_questions[\s\S]*from authenticated/)
  assert.match(source, /create or replace function public\.get_attempt_feedback/)
  assert.match(source, /create or replace function public\.get_activity_attempt_detail/)
})
