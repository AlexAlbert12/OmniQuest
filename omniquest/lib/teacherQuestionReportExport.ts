import { callPlatformRpc } from './platformRpc'
import { exportBinaryFile, slugifyFilename } from './reportExports'
import type { AffectedStudent, AffectedStudentsPage, QuestionReportPeriod, TeacherQuestionReport } from './teacherQuestionReport'
import {
  getAnswerDistributionClassification,
  getDiscriminationLabel,
  getFailureTrendLabel,
  getQuestionDifficultyLabel,
  getQuestionFailureRate,
  getQuestionReportPeriodRange,
  getQuestionTypeLabel,
  QUESTION_REPORT_PERIOD_LABELS,
} from './teacherQuestionReportPresentation'
import { buildXlsxWorkbook, type XlsxCell, type XlsxSheet } from './xlsxWriter'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const EXPORT_PAGE_SIZE = 100

export type TeacherQuestionReportExportInput = {
  report: TeacherQuestionReport
  period: QuestionReportPeriod
  classroomId: number | null
  exportedAt?: Date
}

export async function exportTeacherQuestionReportXlsx(input: TeacherQuestionReportExportInput) {
  const exportedAt = input.exportedAt || new Date()
  const affectedStudents = await loadAllAffectedStudents({
    questionId: input.report.question.id,
    classroomId: input.classroomId,
    period: input.period,
  })
  const sheets = buildTeacherQuestionReportSheets({ ...input, exportedAt, affectedStudents })
  const binary = buildXlsxWorkbook(sheets)
  const filename = buildTeacherQuestionReportFilename(input.report, exportedAt)
  const exported = await exportBinaryFile(filename, binary, XLSX_MIME)
  if (!exported) throw new Error('No se pudo abrir el sistema de descarga o compartición de archivos en este dispositivo.')
  return { filename, affectedCount: affectedStudents.length }
}

export async function loadAllAffectedStudents({ questionId, classroomId, period, pageSize = EXPORT_PAGE_SIZE }: {
  questionId: number
  classroomId: number | null
  period: QuestionReportPeriod
  pageSize?: number
}) {
  const range = getQuestionReportPeriodRange(period)
  const safePageSize = Math.max(1, Math.min(100, Math.trunc(pageSize) || EXPORT_PAGE_SIZE))
  const items: AffectedStudent[] = []
  let offset = 0
  let expectedTotal: number | null = null
  let safety = 0

  while (safety < 1000) {
    const result = await callPlatformRpc<AffectedStudentsPage>('get_teacher_question_affected_students_page', {
      p_question_id: questionId,
      p_classroom_id: classroomId ?? undefined,
      p_date_from: range.from ?? undefined,
      p_date_to: range.to ?? undefined,
      p_limit: safePageSize,
      p_offset: offset,
    })
    if (result.error) throw result.error
    const page = result.data || { items: [], total: 0 }
    if (expectedTotal === null) expectedTotal = Math.max(0, Number(page.total) || 0)
    if (!page.items.length) break
    items.push(...page.items)
    offset += page.items.length
    safety += 1
    if (items.length >= expectedTotal) break
    if (page.items.length < safePageSize) break
  }

  if (safety >= 1000) throw new Error('No se pudo completar la exportación de alumnos afectados de forma segura.')
  return items.slice(0, expectedTotal ?? items.length)
}

export function buildTeacherQuestionReportSheets(input: TeacherQuestionReportExportInput & { exportedAt: Date; affectedStudents: AffectedStudent[] }): XlsxSheet[] {
  const { report, period, classroomId, exportedAt, affectedStudents } = input
  const { question, summary } = report
  const classroomLabel = classroomId == null
    ? 'Todas las clases'
    : report.classOptions.find((item) => item.id === classroomId)?.name || question.classroomName || `Clase ${classroomId}`
  const failureRate = getQuestionFailureRate(summary)
  const summaryRows: XlsxCell[][] = [
    [text('OmniQuest — Informe de pregunta', 'title'), blank()],
    [text('Pregunta', 'label'), text(question.text, 'wrap')],
    [text('Curso', 'label'), text(question.subjectName, 'border')],
    [text('Tema', 'label'), text(question.topicName || 'Sin tema', 'border')],
    [text('Clase', 'label'), text(classroomLabel, 'border')],
    [text('Periodo analizado', 'label'), text(QUESTION_REPORT_PERIOD_LABELS[period], 'border')],
    [text('Fecha de exportación', 'label'), date(exportedAt, 'datetime')],
    [text('Tipo', 'label'), text(getQuestionTypeLabel(question.type), 'border')],
    [text('Dificultad', 'label'), text(getQuestionDifficultyLabel(question.difficulty), 'border')],
    [text('Estado', 'label'), text(question.active === false ? 'Archivada' : 'Activa', 'border')],
    [text('Puntuación base', 'label'), integer(question.pointsBase)],
    [text('Tiempo límite (s)', 'label'), decimal(question.timeLimitSeconds)],
    [text('ID de pregunta', 'label'), integer(question.id)],
  ]
  if (question.explanation?.trim()) summaryRows.push([text('Explicación', 'label'), text(question.explanation.trim(), 'wrap')])
  summaryRows.push([blank(), blank()])
  summaryRows.push([text('Métrica', 'header'), text('Resultado', 'header')])
  summaryRows.push(
    [text('Alumnos en la muestra', 'border'), integer(summary.sampleSize)],
    [text('Intentos', 'border'), integer(summary.totalAttempts)],
    [text('Respuestas correctas', 'border'), integer(summary.correctAttempts)],
    [text('Fallos', 'border'), integer(summary.failedAttempts)],
    [text('Tasa de fallo', 'border'), percent(failureRate)],
    [text('Abandono', 'border'), percent(summary.abandonmentPercent / 100)],
    [text('Tiempo medio (s)', 'border'), decimal(summary.averageTimeSeconds)],
    [text('Discriminación', 'border'), decimal(summary.discrimination)],
    [text('Interpretación de discriminación', 'border'), text(getDiscriminationLabel(summary.discrimination), 'border')],
    [text('Tendencia últimos 7 días (p.p.)', 'border'), decimal(summary.failureTrendPoints)],
    [text('Interpretación de tendencia', 'border'), text(getFailureTrendLabel(summary.failureTrendPoints), 'border')],
  )
  if (summary.lowSample) {
    summaryRows.push([text('ADVERTENCIA', 'warning'), text(`Muestra todavía pequeña. Solo hay ${summary.sampleSize} alumno${summary.sampleSize === 1 ? '' : 's'} en la muestra. Interpreta porcentajes y tendencias con cautela.`, 'warning')])
  }

  const answerRows = report.answerDistribution.length
    ? report.answerDistribution.map((item) => [
      text(item.label, 'wrap'),
      integer(item.count),
      percent(item.percent / 100),
      text(getAnswerDistributionClassification(question.type, item), 'border'),
    ])
    : [[text('Sin datos disponibles', 'wrap'), blank(), blank(), blank()]]

  const classRows = report.classComparison.length
    ? report.classComparison.map((item) => [
      text(item.classroom_name, 'wrap'),
      integer(item.attempts),
      integer(item.correct),
      integer(Math.max(0, item.attempts - item.correct)),
      percent(item.failure_percent / 100),
      decimal(item.average_time_seconds),
    ])
    : [[text('Sin datos disponibles', 'wrap'), blank(), blank(), blank(), blank(), blank()]]

  const trendRows = report.temporalTrend.length
    ? report.temporalTrend.map((item) => [
      date(parseReportDay(item.day), 'date'),
      integer(item.attempts),
      percent(item.failure_percent / 100),
      decimal(item.average_time_seconds),
    ])
    : [[text('Sin datos disponibles', 'wrap'), blank(), blank(), blank()]]

  const affectedRows = affectedStudents.length
    ? affectedStudents.map((item) => [
      text(item.alias, 'wrap'),
      text(item.classroom_name, 'wrap'),
      integer(item.failures),
      integer(item.attempts),
      percent(item.attempts > 0 ? item.failures / item.attempts : null),
      decimal(item.average_time_seconds),
      date(parseOptionalDate(item.last_attempt_at), 'datetime'),
    ])
    : [[text('Sin alumnos afectados', 'wrap'), blank(), blank(), blank(), blank(), blank(), blank()]]

  return [
    {
      name: 'Resumen',
      rows: summaryRows,
      columnWidths: [34, 72],
      freezeRows: 1,
      merges: ['A1:B1'],
    },
    dataSheet('Respuestas', ['Respuesta', 'Selecciones', 'Porcentaje', 'Clasificación'], answerRows, [44, 14, 14, 20]),
    dataSheet('Comparación por clase', ['Clase', 'Intentos', 'Respuestas correctas', 'Fallos', 'Tasa de fallo', 'Tiempo medio (s)'], classRows, [32, 12, 20, 12, 16, 18]),
    dataSheet('Tendencia', ['Fecha', 'Intentos', 'Tasa de fallo', 'Tiempo medio (s)'], trendRows, [16, 12, 16, 18]),
    dataSheet('Alumnos afectados', ['Alumno', 'Clase', 'Fallos', 'Intentos', 'Tasa de fallo', 'Tiempo medio (s)', 'Último intento'], affectedRows, [28, 28, 12, 12, 16, 18, 20]),
  ]
}

function dataSheet(name: string, headers: string[], rows: XlsxCell[][], widths: number[]): XlsxSheet {
  const sheetRows: XlsxCell[][] = [headers.map((header) => text(header, 'header')), ...rows]
  return {
    name,
    rows: sheetRows,
    columnWidths: widths,
    freezeRows: 1,
    autoFilter: { fromRow: 1, toRow: sheetRows.length, toColumn: headers.length },
  }
}

function buildTeacherQuestionReportFilename(report: TeacherQuestionReport, exportedAt: Date) {
  const dateLabel = `${exportedAt.getFullYear()}-${String(exportedAt.getMonth() + 1).padStart(2, '0')}-${String(exportedAt.getDate()).padStart(2, '0')}`
  return `OmniQuest_Informe_Pregunta_${report.question.id}_${slugifyFilename(report.question.subjectName)}_${dateLabel}.xlsx`
}

function parseReportDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function parseOptionalDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function text(value: string, style: XlsxCell['style'] = 'border'): XlsxCell { return { value, style } }
function blank(): XlsxCell { return { value: null } }
function integer(value: number | null | undefined): XlsxCell { return { value: value == null || !Number.isFinite(value) ? null : value, style: 'integer' } }
function decimal(value: number | null | undefined): XlsxCell { return { value: value == null || !Number.isFinite(value) ? null : value, style: 'decimal' } }
function percent(value: number | null | undefined): XlsxCell { return { value: value == null || !Number.isFinite(value) ? null : value, style: 'percent' } }
function date(value: Date | null, style: 'date' | 'datetime'): XlsxCell { return { value, style } }
