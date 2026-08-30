import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('game interaction hierarchy keeps one shell and adapts its width to complex questions', () => {
  const screen = read('app/(student)/play/[id].tsx')
  const renderer = read('components/student/game/GameQuestionRenderer.tsx')

  assert.match(screen, /isComplexInteraction \? 840 : 720/)
  assert.match(screen, /maxWidth: interactionMaxWidth/)
  assert.match(screen, /showQuestionDescriptor/)
  assert.match(screen, /<TimerPill timeLeft=\{game\.timeLeft\} compact=\{!isDesktop\}/)
  assert.match(screen, /mt-4 rounded-\[24px\] p-4/)

  assert.doesNotMatch(renderer, /gap-4 rounded-\[22px\] border border-border-default bg-surface-default p-5/)
  assert.doesNotMatch(renderer, /<AnswerFeedback/)
  assert.match(renderer, /Completa el hueco marcado con ___\./)
  assert.doesNotMatch(renderer, /El servidor corregirá mayúsculas/)
  assert.match(renderer, /<View className="gap-3">\s*\{options\.length/s)
  assert.match(renderer, /Completa todas las relaciones para activar Comprobar\./)
})

test('routine synchronization is silent while actionable offline and conflict states remain visible', () => {
  const screen = read('app/(student)/play/[id].tsx')
  const sync = read('components/student/game/GameSyncStatus.tsx')

  assert.doesNotMatch(screen, /resumed=\{game\.resumedFromSnapshot\}/)
  assert.match(sync, /state === 'idle' \|\| state === 'saving' \|\| state === 'synced'/)
  assert.doesNotMatch(sync, /Respuesta sincronizada|registrada en el servidor|Guardando respuesta/)
  assert.match(sync, /Sin conexión/)
  assert.match(sync, /La pregunta cambió/)
  assert.match(sync, /No se pudo guardar/)
})

test('feedback, HUD and scoring use compact mobile dimensions and non-system performance tokens', () => {
  const screen = read('app/(student)/play/[id].tsx')
  const hud = read('components/student/game/GameHud.tsx')
  const header = read('components/student/game/GameHeader.tsx')
  const dialogs = read('components/student/game/GameDialogs.tsx')
  const feedback = read('components/student/game/GameQuestionUi.tsx')
  const result = read('components/student/game/GameResultState.tsx')
  const tokens = read('lib/designTokens.ts')

  assert.doesNotMatch(screen, /category=\{category\} lives=\{game\.lives\}/)
  assert.doesNotMatch(hud, /label=\{`\$\{lives\} vidas`\}/)
  assert.match(hud, /XP posibles/)
  assert.match(hud, /detail="-10 XP"[\s\S]*emphasized/)
  assert.match(hud, /detail="-20 XP"/)
  assert.match(header, /\{score\} XP/)
  assert.match(dialogs, /se aplicarán -10 XP/)
  assert.match(dialogs, /Perderás 20 XP/)

  assert.match(feedback, /size=\{isDesktop \? 96 : 82\}/)
  assert.match(feedback, /isDesktop \? 20 : 16/)
  assert.match(feedback, /tokens\.gamification\.performanceLow/)
  assert.match(feedback, /label="Siguiente pregunta"[\s\S]*size="lg"[\s\S]*variant="primary"/)
  assert.match(tokens, /performanceLow:/)
  assert.match(result, /tokens\.gamification\.performanceLow/)
})
