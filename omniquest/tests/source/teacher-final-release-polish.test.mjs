import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('topic creation stays in the course and no longer asks for first-question difficulty', () => {
  const hook = read('features/teacher-subject/useTeacherSubjectDetail.ts')
  const structure = read('components/teacher/subject/SubjectCourseStructure.tsx')
  const screen = read('app/(teacher)/subject/[id].tsx')

  assert.doesNotMatch(hook, /newTopicDifficulty|setNewTopicDifficulty/)
  assert.doesNotMatch(structure, /Dificultad de la primera pregunta|onDifficultyChange/)
  assert.doesNotMatch(screen, /newTopicDifficulty|setNewTopicDifficulty/)
  assert.match(hook, /await topicsResource\.refresh\(\)/)
  assert.match(hook, /setActiveTab\('topics'\)/)
  assert.match(hook, /router\.setParams\(\{ tab: 'topics'/)
  assert.doesNotMatch(hook, /topicId=\$\{topic\.id\}.*difficulty=/)
})

test('topic detail removes the redundant deadline shortcut and question rows open reports', () => {
  const topic = read('app/(teacher)/topic/[id].tsx')
  assert.doesNotMatch(topic, /label=\{isDesktop \? 'Fecha límite'/)
  assert.doesNotMatch(topic, /section=availability/)
  assert.match(topic, /Abrir informe de la pregunta:/)
  assert.match(topic, /question-report\/\$\{question\.id\}/)
  assert.match(topic, /label="Editar"/)
  assert.match(topic, /label="Eliminar"/)
})

test('course students open contextual history and course questions open their report without removing edit/delete', () => {
  const subject = read('app/(teacher)/subject/[id].tsx')
  const students = read('components/teacher/subject/SubjectStudentsTab.tsx')
  const questions = read('components/teacher/subject/SubjectQuestionsTab.tsx')

  assert.match(subject, /pathname: '\/\(teacher\)\/student\/\[id\]\/history'/)
  assert.match(subject, /subjectId: String\(subject\.id\)/)
  assert.match(subject, /classroomId: String\(detail\.selectedClassroomId\)/)
  assert.match(students, /Abrir historial de \$\{student\.name\}/)
  assert.match(questions, /Abrir informe de la pregunta:/)
  assert.match(questions, /question-report\/\$\{question\.id\}/)
  assert.match(questions, /Editar pregunta:/)
  assert.match(questions, /Eliminar pregunta:/)
})

test('affected students include profile avatars through the secured paged RPC', () => {
  const migration = read('supabase/migrations/20260912173000_teacher_question_report_affected_avatars.sql')
  const types = read('lib/teacherQuestionReport.ts')
  const list = read('components/teacher/question-report/AffectedStudentsList.tsx')

  assert.match(migration, /security definer/)
  assert.match(migration, /set search_path = public/)
  assert.match(migration, /public\.is_admin\(\) or s\.teacher_id = v_user_id/)
  assert.match(migration, /p\.avatar/)
  assert.match(migration, /count\(\*\)::integer as attempts/)
  assert.match(migration, /and not ah\.is_correct/)
  assert.match(migration, /count\(\*\)::integer as failures/)
  assert.match(types, /avatar: string \| null/)
  assert.match(list, /StudentProfileAvatar/)
  assert.match(list, /avatar=\{item\.avatar\}/)
})

test('manual review configuration keeps SLA but no longer exposes template mutation', () => {
  const sheet = read('components/teacher/reviews/ManualReviewConfigurationSheet.tsx')
  const hook = read('hooks/teacher/useManualReview.ts')
  const page = read('app/(teacher)/reviews.tsx')

  assert.match(sheet, /Plazo de revisión/)
  assert.match(sheet, /onSaveSla/)
  assert.doesNotMatch(sheet, /Guardar como plantilla|Título de la plantilla|Texto de la plantilla|Visibilidad de la plantilla/)
  assert.doesNotMatch(hook, /save_manual_review_template|saveTemplate/)
  assert.doesNotMatch(page, /onSaveTemplate|review\.saveTemplate/)
})

test('legacy date/time/week-start controls are hidden and native push registration is never exposed on web', () => {
  const sections = read('components/settings/SettingsSections.tsx')
  const teacherSections = read('components/settings/TeacherSettingsSections.tsx')
  const delivery = read('components/settings/TeacherDeliveryPreferencesPanel.tsx')
  const userSettings = read('hooks/useSettingsData.ts')
  const teacherSettings = read('hooks/teacher/useTeacherCommunicationSettings.ts')

  assert.doesNotMatch(sections, /\(\['dateFormat', 'timeFormat', 'weekStart'\]/)
  assert.doesNotMatch(teacherSections, /dateFormat=|timeFormat=|weekStart=/)
  assert.doesNotMatch(delivery, /dateFormat: string|timeFormat: string|weekStart: string/)
  assert.match(sections, /Platform\.OS !== 'web'/)
  assert.match(delivery, /Platform\.OS !== 'web'/)
  assert.match(userSettings, /key === 'push' && Platform\.OS === 'web'/)
  assert.match(teacherSettings, /patch\.pushEnabled !== undefined && Platform\.OS === 'web'/)
})

test('question report exports a real five-sheet XLSX and paginates every affected student', () => {
  const screen = read('app/(teacher)/question-report/[id].tsx')
  const actions = read('components/teacher/question-report/QuestionReportActions.tsx')
  const exporter = read('lib/teacherQuestionReportExport.ts')
  const writer = read('lib/xlsxWriter.ts')

  assert.doesNotMatch(screen, /exportCsvFile|Campo_1|Campo_2/)
  assert.match(screen, /exportTeacherQuestionReportXlsx/)
  assert.match(actions, /Exportar informe/)
  assert.match(actions, /loading=\{exporting\}/)
  for (const sheet of ['Resumen', 'Respuestas', 'Comparación por clase', 'Tendencia', 'Alumnos afectados']) assert.match(exporter, new RegExp(sheet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(exporter, /get_teacher_question_affected_students_page/)
  assert.match(exporter, /p_limit: safePageSize/)
  assert.match(exporter, /items\.length >= expectedTotal/)
  assert.doesNotMatch(exporter, /text\(item\.student_id/)
  assert.match(exporter, /getAnswerDistributionClassification/)
  assert.match(exporter, /getQuestionReportPeriodRange/)
  assert.match(writer, /0x04034b50/)
  assert.match(writer, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml/)
  assert.match(writer, /autoFilter/)
  assert.match(writer, /state=\"frozen\"/)
})
