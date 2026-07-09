import { Platform } from 'react-native'

export type CsvValue = string | number | boolean | null | undefined

export function buildCsv(headers: string[], rows: CsvValue[][]) {
  const body = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')

  return `\uFEFF${body}`
}

export function exportCsvFile(filename: string, headers: string[], rows: CsvValue[][]) {
  return downloadTextFile(filename, buildCsv(headers, rows), 'text/csv;charset=utf-8;')
}

export function exportMarkdownFile(filename: string, content: string) {
  return downloadTextFile(filename, content, 'text/markdown;charset=utf-8;')
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  if (Platform.OS !== 'web') {
    return false
  }

  const blob = new Blob([content], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  return true
}

export function slugifyFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || 'informe'
}

export function formatExportDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatExportDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeCsvValue(value: CsvValue) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}
