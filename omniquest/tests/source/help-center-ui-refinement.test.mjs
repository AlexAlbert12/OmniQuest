import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('help center keeps the authenticated shell and contextual return to Settings', () => {
  const help = read('components/support/RoleHelpCenter.tsx')
  const header = read('components/ui/RolePageHeader.tsx')

  assert.match(help, /StudentSidebar activeSection="settings"/)
  assert.match(help, /TeacherSidebar activeSection="settings"/)
  assert.match(help, /Ionicons name="arrow-back"[\s\S]*t\('settings\.back'\)/)
  assert.match(help, /settings\?section=about/)
  assert.match(help, /compactMobileTitle/)
  assert.match(header, /compactMobileTitle \? 'text-\[27px\]'/)
})

test('help center prioritizes FAQ and has coherent empty conversation states', () => {
  const help = read('components/support/RoleHelpCenter.tsx')
  const mobileBranch = help.slice(help.indexOf('<View className="gap-5">\n              {faqPanel}'))

  assert.ok(mobileBranch.indexOf('{faqPanel}') < mobileBranch.indexOf('{createTicketPanel}'))
  assert.ok(mobileBranch.indexOf('{createTicketPanel}') < mobileBranch.indexOf('{ticketsPanel}'))
  assert.match(help, /ticketsTotal === 0[\s\S]*support\.detail\.noTicketsTitle/)
  assert.match(help, /support\.detail\.noTicketsDescription/)
  assert.match(help, /externalContactChannels[\s\S]*channel_type !== 'in_app'/)
})

test('help center controls preserve affordance and mobile touch targets', () => {
  const help = read('components/support/RoleHelpCenter.tsx')
  const i18n = read('lib/i18n.tsx')

  assert.match(help, /canSubmitTicket = subject\.trim\(\)\.length >= 5 && body\.trim\(\)\.length >= 15/)
  assert.match(help, /disabled=\{!canSubmitTicket\}/)
  assert.match(help, /min-h-\[42px\]/)
  assert.match(help, /balancedMobile/)
  assert.match(i18n, /'support\.form\.submit': 'Crear ticket'/)
  assert.match(i18n, /Adjuntar imagen, PDF o archivo de texto · Máx\. 10 MB/)
})

test('reported TypeScript and lint regressions stay fixed', () => {
  const hero = read('components/student/profile/StudentProfileHero.tsx')
  const i18n = read('lib/i18n.tsx')
  const audit = read('app/(teacher)/audit.tsx')
  const galaxyHeader = read('components/student/course/CourseGalaxyHeader.tsx')
  const gameState = read('components/student/game/GameStateView.tsx')

  assert.match(hero, /const progressWidth: `\$\{number\}%`/)
  assert.doesNotMatch(audit, /ScrollView, Text, TextInput/)
  assert.doesNotMatch(galaxyHeader, /import \{ Text, View \} from 'react-native'/)
  assert.doesNotMatch(gameState, /import \{ Text, View \} from 'react-native'/)

  const rawStart = i18n.indexOf('const rawUiEnglish:')
  const rawEnd = i18n.indexOf('\n}', rawStart)
  const raw = i18n.slice(rawStart, rawEnd)
  const keys = [...raw.matchAll(/^\s*'([^']+)'\s*:/gm)].map((match) => match[1])
  assert.equal(new Set(keys).size, keys.length, 'rawUiEnglish must not contain duplicate literal keys')
})
