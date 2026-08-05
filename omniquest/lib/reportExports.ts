import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

export type CsvValue = string | number | boolean | null | undefined

export function buildCsv(headers: string[], rows: CsvValue[][]) {
  const body = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')

  return `\uFEFF${body}`
}

export function exportCsvFile(filename: string, headers: string[], rows: CsvValue[][]) {
  return exportTextFile(filename, buildCsv(headers, rows), 'text/csv;charset=utf-8;')
}

export function exportMarkdownFile(filename: string, content: string) {
  return exportTextFile(filename, content, 'text/markdown;charset=utf-8;')
}

export async function exportTextFile(filename: string, content: string, mimeType: string) {
  if (Platform.OS === 'web') {
    return downloadTextFile(filename, content, mimeType)
  }

  return shareTextFile(filename, content, mimeType)
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

export async function shareTextFile(filename: string, content: string, mimeType: string) {
  if (Platform.OS === 'web') {
    return false
  }

  const sharingAvailable = await Sharing.isAvailableAsync()
  if (!sharingAvailable) {
    return false
  }

  const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory
  if (!baseDirectory) {
    return false
  }

  const safeFilename = sanitizeExportFilename(filename)
  const fileUri = `${baseDirectory}${safeFilename}`

  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  })

  await Sharing.shareAsync(fileUri, {
    mimeType,
    dialogTitle: safeFilename,
    UTI: getUniformTypeIdentifier(mimeType),
  })

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

function sanitizeExportFilename(filename: string) {
  const sanitized = filename
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return sanitized || `omniquest-export-${Date.now()}.txt`
}

function getUniformTypeIdentifier(mimeType: string) {
  if (mimeType.includes('csv')) {
    return 'public.comma-separated-values-text'
  }

  if (mimeType.includes('markdown')) {
    return 'net.daringfireball.markdown'
  }

  return 'public.plain-text'
}

function escapeCsvValue(value: CsvValue) {
  const rawText = String(value ?? '')
  // Prevent spreadsheet formula injection when exported values come from user input.
  const text = /^[\t\r]/.test(rawText) || /^[=+@-]/.test(rawText.trimStart()) ? `'${rawText}` : rawText
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}
