import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const migrationPath = 'supabase/migrations/20260729150000_badge_catalog_pagination.sql'

test('achievement categories and definitions live in the data model', () => {
  const migration = read(migrationPath)

  assert.match(migration, /create table if not exists public\.badge_categories/)
  assert.match(migration, /create table if not exists public\.badge_definitions/)
  assert.match(migration, /category_key text not null references public\.badge_categories/)
  assert.match(migration, /metric_key text not null check/)
  assert.match(migration, /create policy "badge_categories_authenticated_read"/)
  assert.match(migration, /create policy "badge_definitions_authenticated_read"/)
  assert.match(migration, /from public\.badge_definitions bd/)
  assert.doesNotMatch(migration, /badge_id = 'accuracy-80'/)
})

test('achievement catalog RPC returns server pagination, dates and profile selection state', () => {
  const migration = read(migrationPath)
  const client = read('lib/studentBadges.ts')

  assert.match(migration, /create or replace function public\.get_student_badge_catalog/)
  assert.match(migration, /offset v_page \* v_page_size/)
  assert.match(migration, /'has_more'/)
  assert.match(migration, /'awarded_at', awarded_at/)
  assert.match(migration, /'featured_badge_id', v_featured_badge_id/)
  assert.match(client, /fetchStudentBadgeCatalog/)
  assert.match(client, /p_page_size: pageSize/)
  assert.match(client, /awardedAt: typeof row\.awarded_at/)
})

test('achievement screen uses data-driven categories, detail and load-more pagination', () => {
  const screen = read('app/(student)/badges.tsx')
  const profile = read('app/(student)/profile.tsx')
  const avatar = read('components/gamification/GamifiedAvatar.tsx')

  assert.match(screen, /categories\.map/)
  assert.doesNotMatch(screen, /const badgeCategoryTabs:.*\[/)
  assert.doesNotMatch(screen, /badge\.id === 'accuracy-80'/)
  assert.match(screen, /BadgeDetailModal/)
  assert.match(screen, /formatAwardedAt/)
  assert.match(screen, /Destacar en mi perfil/)
  assert.match(screen, /kind: 'profile\.cosmetics'/)
  assert.match(screen, /Cargar más logros/)
  assert.match(screen, /const PAGE_SIZE = 50/)
  assert.match(screen, /fetchBadges\(page \+ 1, true\)/)
  assert.match(profile, /cosmetics=\{cosmetics\}/)
  assert.match(avatar, /Insignia destacada:/)
})


test('achievement screen uses user-facing copy, consistent pending state and stable modal hover', () => {
  const screen = read('app/(student)/badges.tsx')
  const model = read('lib/studentBadges.ts')
  const tabs = read('components/ui/AppTabs.tsx')

  assert.match(screen, /Explora tus insignias por categoría y abre cualquiera para consultar sus detalles y progreso\./)
  assert.doesNotMatch(screen, /se cargan desde el catálogo/)
  assert.doesNotMatch(screen, /MetricTile[^\r\n]*label="Conseguidas"/)
  assert.match(screen, /label="Racha" value=\{formatCount\(summary\.streakDays, 'día', 'días'\)\}/)
  assert.match(screen, /FilterButton label="Pendientes"/)
  assert.match(model, /statusLabel: unlocked \? 'Conseguida' : 'Pendiente'/)
  assert.match(screen, /omni-no-hover-lift flex-1 items-center justify-center/)
  assert.match(screen, /omni-no-hover-lift w-full max-w-\[560px\]/)
  assert.match(screen, /withAlpha\(accentColor, '14'\)/)
  assert.match(tabs, /gap: 8/)
})
