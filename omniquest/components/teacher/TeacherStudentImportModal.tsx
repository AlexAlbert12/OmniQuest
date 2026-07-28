import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../ui/mobile/MobileMetricCard'
import { supabase } from '../../lib/supabase'
import { isValidEmail, normalizeEmail } from '../../lib/auth'

type ImportedStudentRow = {
  email: string
  status: 'created' | 'existing'
  studentId: string
  temporaryPassword?: string
  enrolled?: boolean
  alreadyEnrolled?: boolean
  emailSent?: boolean
  emailError?: string
}

type ImportResult = {
  total: number
  enrolled: number
  created: number
  existing: number
  alreadyEnrolled: number
  invalid: string[]
  failed: { email: string; reason: string }[]
  emailsSent: number
  emailsSkipped: number
  students?: ImportedStudentRow[]
}

type TeacherStudentImportModalProps = {
  visible: boolean
  subjectId: number
  subjectName: string
  classroomId?: number | null
  classroomName?: string | null
  onClose: () => void
  onImported: () => void
  onViewInactiveStudents?: () => void
}

export default function TeacherStudentImportModal({
  visible,
  subjectId,
  subjectName,
  classroomId,
  classroomName,
  onClose,
  onImported,
  onViewInactiveStudents,
}: TeacherStudentImportModalProps) {
  const [rawEmails, setRawEmails] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileMessage, setFileMessage] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [postImportMessage, setPostImportMessage] = useState<string | null>(null)
  const { width } = useWindowDimensions()
  const isPhone = width < 640

  const parsed = useMemo(() => parseEmails(rawEmails), [rawEmails])
  const validEmails = parsed.valid
  const invalidEmails = parsed.invalid

  const importedStudents = result?.students || []
  const hasTemporaryCredentials = importedStudents.some((student) => Boolean(student.temporaryPassword))

  const resetAndClose = () => {
    if (importing || sendingReminder) return
    setResult(null)
    setFileMessage(null)
    setPostImportMessage(null)
    onClose()
  }

  const importStudents = async () => {
    if (validEmails.length === 0 || importing) return

    try {
      setImporting(true)
      setResult(null)
      setPostImportMessage(null)

      const { data, error } = await supabase.functions.invoke('import-students', {
        body: {
          subjectId,
          classroomId,
          emails: validEmails,
        },
      })

      if (error) throw new Error(error.message || 'No se pudo importar la lista.')

      setResult(data as ImportResult)
      onImported()
    } catch (error: any) {
      setResult({
        total: validEmails.length,
        enrolled: 0,
        created: 0,
        existing: 0,
        alreadyEnrolled: 0,
        invalid: invalidEmails,
        failed: [{ email: 'Importación', reason: error.message || 'Error inesperado.' }],
        emailsSent: 0,
        emailsSkipped: 0,
        students: [],
      })
    } finally {
      setImporting(false)
    }
  }

  const handlePickTextFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setFileMessage('En móvil puedes copiar una columna desde Excel y pegarla en el cuadro de correos.')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.txt,text/csv,text/plain'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      setRawEmails((current) => [current, text].filter(Boolean).join('\n'))
      setFileMessage(`Archivo cargado: ${file.name}`)
    }
    input.click()
  }

  const handleExportCredentials = () => {
    if (!result || importedStudents.length === 0) {
      setPostImportMessage('No hay alumnos importados para exportar todavía.')
      return
    }

    const csvText = buildCredentialsCsv(importedStudents, {
      subjectName,
      classroomName: classroomName || 'Clase principal',
    })
    const filename = `omniquest_credenciales_${slugify(subjectName)}_${new Date().toISOString().slice(0, 10)}.csv`

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setPostImportMessage(hasTemporaryCredentials
        ? 'CSV de credenciales descargado. Las contraseñas temporales solo se muestran en esta sesión.'
        : 'CSV descargado. Los alumnos existentes entran con su cuenta habitual.')
      return
    }

    setPostImportMessage('La descarga CSV está disponible desde la versión web. En móvil puedes reenviar el correo de credenciales.')
  }

  const handleSendReminder = async () => {
    if (!result || importedStudents.length === 0 || sendingReminder) return

    try {
      setSendingReminder(true)
      setPostImportMessage(null)
      const { data, error } = await supabase.functions.invoke('teacher-student-reminder', {
        body: {
          studentIds: importedStudents.map((student) => student.studentId),
          subjectIds: [subjectId],
          mode: 'reminder',
        },
      })

      if (error) throw new Error(error.message || 'No se pudo enviar el recordatorio.')
      const sent = Number((data as any)?.sent || 0)
      const failed = Number((data as any)?.failed || 0)
      setPostImportMessage(`Recordatorio enviado a ${sent} alumno${sent === 1 ? '' : 's'}${failed > 0 ? ` · ${failed} error${failed === 1 ? '' : 'es'}` : ''}.`)
    } catch (error: any) {
      setPostImportMessage(error.message || 'No se pudo enviar el recordatorio.')
    } finally {
      setSendingReminder(false)
    }
  }

  const handleCopyCredential = async (student: ImportedStudentRow) => {
    if (!student.temporaryPassword) return
    const text = `Correo: ${student.email}\nContraseña temporal: ${student.temporaryPassword}`

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      setPostImportMessage(`Credenciales de ${student.email} copiadas al portapapeles.`)
      return
    }

    setPostImportMessage(`Credenciales de ${student.email}: ${student.temporaryPassword}`)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View className={`flex-1 bg-black/70 ${isPhone ? 'justify-end' : 'items-center justify-center px-4 py-8'}`}>
        <View className={`${isPhone ? 'h-[94%] w-full rounded-t-3xl' : 'max-h-full w-full max-w-[800px] rounded-3xl'} overflow-hidden border border-border-default bg-surface-default`}>
          <View className="flex-row items-start justify-between gap-4 border-b border-border-default px-5 py-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[22px] font-black text-white">Importar alumnos</Text>
              <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
                Inscribe alumnos en {classroomName || 'la clase activa'} del curso {subjectName}. Puedes pegar correos separados por saltos, comas o copiar una columna desde Excel.
              </Text>
            </View>
            <Pressable
              onPress={resetAndClose}
              className="h-10 w-10 items-center justify-center rounded-xl bg-surface-raised"
              style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
            >
              <Ionicons name="close" size={21} color="#DDE7F4" />
            </Pressable>
          </View>

          <ScrollView className={isPhone ? 'flex-1' : 'max-h-[720px]'} contentContainerStyle={{ padding: isPhone ? 16 : 20, paddingBottom: isPhone ? 28 : 20 }} showsVerticalScrollIndicator={false}>
            <View className="rounded-2xl border border-border-default bg-surface-default p-4">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="font-black text-white">Correos de alumnos</Text>
                  <Text className="mt-1 text-[12px] text-text-muted">Ejemplo: aalbertc@uah.es, mlopez@uah.es</Text>
                </View>
                <Pressable
                  onPress={handlePickTextFile}
                  className="flex-row items-center gap-2 rounded-xl px-4 py-3"
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: '#6D5AF6',
                    backgroundColor: '#111B3D',
                    opacity: pressed ? 0.82 : 1,
                  })}
                >
                  <Ionicons name="document-attach-outline" size={17} color="#C4B5FD" />
                  <Text className="text-[12px] font-black text-brand-teacher">CSV/TXT</Text>
                </Pressable>
              </View>

              <TextInput
                value={rawEmails}
                onChangeText={setRawEmails}
                multiline
                textAlignVertical="top"
                placeholder="Pega aquí los correos o una columna copiada desde Excel"
                placeholderTextColor="#60799C"
                className="mt-4 min-h-[180px] rounded-2xl border border-border-default bg-background-primary px-4 py-3 text-[14px] text-white"
              />

              {fileMessage ? <Text className="mt-2 text-[12px] text-text-secondary">{fileMessage}</Text> : null}

              <View className="mt-4 flex-row flex-wrap gap-3">
                <ImportCounter icon="checkmark-circle-outline" label="Válidos" value={validEmails.length} color="#34D399" />
                <ImportCounter icon="alert-circle-outline" label="Inválidos" value={invalidEmails.length} color="#FB7185" />
                <ImportCounter icon="people-outline" label="Únicos" value={new Set(validEmails).size} color="#60A5FA" />
              </View>

              {invalidEmails.length > 0 ? (
                <View className="mt-4 rounded-xl border border-border-subtle bg-semantic-surface-danger p-3">
                  <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-semantic-danger">Correos ignorados</Text>
                  <Text className="mt-2 text-[12px] leading-5 text-semantic-danger">{invalidEmails.slice(0, 8).join(', ')}</Text>
                </View>
              ) : null}
            </View>

            {result ? (
              <ImportResultPanel
                result={result}
                postImportMessage={postImportMessage}
                sendingReminder={sendingReminder}
                onCopyCredential={handleCopyCredential}
                onExportCredentials={handleExportCredentials}
                onSendReminder={handleSendReminder}
                onViewInactiveStudents={onViewInactiveStudents}
              />
            ) : null}

            <View className={`${isPhone ? 'mt-5 gap-3' : 'mt-5 flex-row flex-wrap justify-end gap-3'}`}>
              <Pressable
                onPress={resetAndClose}
                disabled={importing || sendingReminder}
                className="rounded-xl px-5 py-3"
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: '#20375E',
                  backgroundColor: '#09162C',
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Text className="font-bold text-text-secondary">Cerrar</Text>
              </Pressable>
              <Pressable
                onPress={() => void importStudents()}
                disabled={importing || sendingReminder || validEmails.length === 0}
                className="flex-row items-center justify-center gap-2 rounded-xl px-5 py-3"
                style={({ pressed }) => ({
                  backgroundColor: '#6D5AF6',
                  opacity: importing || sendingReminder || validEmails.length === 0 ? 0.55 : pressed ? 0.82 : 1,
                })}
              >
                {importing ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />}
                <Text className="font-black text-white">{importing ? 'Importando...' : result ? 'Importar otra lista' : 'Importar alumnos'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function ImportCounter({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; color: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl bg-surface-raised px-3 py-2">
      <Ionicons name={icon} size={16} color={color} />
      <Text className="text-[12px] font-bold text-text-secondary">{label}</Text>
      <Text className="text-[12px] font-black" style={{ color }}>{value}</Text>
    </View>
  )
}

function ImportResultPanel({
  result,
  postImportMessage,
  sendingReminder,
  onCopyCredential,
  onExportCredentials,
  onSendReminder,
  onViewInactiveStudents,
}: {
  result: ImportResult
  postImportMessage: string | null
  sendingReminder: boolean
  onCopyCredential: (student: ImportedStudentRow) => void
  onExportCredentials: () => void
  onSendReminder: () => void
  onViewInactiveStudents?: () => void
}) {
  const students = result.students || []
  const successful = students.length || Math.max(0, result.total - result.failed.length)
  const createdWithPassword = students.filter((student) => student.temporaryPassword)
  const errorsCount = result.failed.length + result.invalid.length

  return (
    <View className="mt-5 overflow-hidden rounded-2xl border border-border-default bg-surface-default">
      <View className="border-b border-border-default bg-surface-raised p-5">
        <View className="flex-row items-start gap-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-semantic-success">
            <Ionicons name="checkmark-done-outline" size={25} color="#34D399" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[20px] font-black text-white">Importación completada</Text>
            <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
              {successful} alumno{successful === 1 ? '' : 's'} procesado{successful === 1 ? '' : 's'} correctamente para esta clase.
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-3">
          <ResultMetric label="Importados" value={successful} color="#34D399" />
          <ResultMetric label="Ya existían" value={result.existing} color="#A78BFA" />
          <ResultMetric label="Errores" value={errorsCount} color={errorsCount > 0 ? '#FB7185' : '#8FA7C7'} />
        </View>
      </View>

      <View className="p-4">
        <View className="flex-row flex-wrap gap-3">
          <ImportCounter icon="person-add-outline" label="Creados" value={result.created} color="#60A5FA" />
          <ImportCounter icon="school-outline" label="Inscritos" value={result.enrolled} color="#34D399" />
          <ImportCounter icon="checkmark-done-outline" label="Ya inscritos" value={result.alreadyEnrolled} color="#FBBF24" />
          <ImportCounter icon="mail-outline" label="Emails enviados" value={result.emailsSent} color="#38BDF8" />
        </View>

        <View className="mt-4 flex-row flex-wrap gap-3">
          <PostImportAction
            icon="send-outline"
            label={sendingReminder ? 'Enviando...' : 'Enviar recordatorio'}
            disabled={sendingReminder || students.length === 0}
            onPress={onSendReminder}
          />
          <PostImportAction
            icon="download-outline"
            label="Exportar credenciales"
            disabled={students.length === 0}
            onPress={onExportCredentials}
          />
          {onViewInactiveStudents ? (
            <PostImportAction
              icon="eye-outline"
              label="Ver alumnos sin actividad"
              onPress={onViewInactiveStudents}
            />
          ) : null}
        </View>

        {postImportMessage ? (
          <View className="mt-4 rounded-xl border border-border-default bg-surface-default p-3">
            <Text className="text-[12px] leading-5 text-text-secondary">{postImportMessage}</Text>
          </View>
        ) : null}

        {createdWithPassword.length > 0 ? (
          <View className="mt-4 rounded-xl border border-border-default bg-surface-default p-3">
            <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-brand-teacher">Credenciales temporales de esta sesión</Text>
            <Text className="mt-1 text-[12px] leading-5 text-text-muted">
              Solo se muestran ahora. Después conviene usar “Reenviar credenciales” desde la ficha del alumno.
            </Text>
            <View className="mt-3 gap-2">
              {createdWithPassword.slice(0, 6).map((student) => (
                <View key={student.studentId} className="flex-row items-center gap-2 rounded-lg bg-surface-raised px-3 py-2">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-bold text-white" numberOfLines={1}>{student.email}</Text>
                    <Text className="mt-0.5 text-[11px] text-text-secondary" numberOfLines={1}>Contraseña: {student.temporaryPassword}</Text>
                  </View>
                  <Pressable onPress={() => onCopyCredential(student)} className="rounded-lg bg-brand-teacher px-3 py-2">
                    <Text className="text-[11px] font-black text-white">Copiar</Text>
                  </Pressable>
                </View>
              ))}
              {createdWithPassword.length > 6 ? (
                <Text className="text-[11px] text-text-muted">Hay {createdWithPassword.length - 6} credencial{createdWithPassword.length - 6 === 1 ? '' : 'es'} más en el CSV.</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {result.emailsSkipped > 0 ? (
          <View className="mt-3 rounded-xl border border-border-default bg-semantic-surface-danger p-3">
            <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-gamification-xp">Emails no enviados</Text>
            <Text className="mt-1 text-[12px] leading-5 text-semantic-warning">
              Importación completada: {result.emailsSkipped} email{result.emailsSkipped === 1 ? '' : 's'} no se enviaron porque el servicio de correo no está configurado o está en modo demo incompleto. Puedes exportar las credenciales y copiarlas manualmente.
            </Text>
          </View>
        ) : null}

        {result.failed.length > 0 ? (
          <View className="mt-4 rounded-xl border border-border-subtle bg-semantic-surface-danger p-3">
            <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-semantic-danger">Errores</Text>
            {result.failed.slice(0, 6).map((item) => (
              <Text key={`${item.email}-${item.reason}`} className="mt-2 text-[12px] text-semantic-danger">
                {item.email}: {item.reason}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function ResultMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <MobileMetricCard
      className="min-w-[130px] flex-1"
      color={color}
      compact
      icon="stats-chart"
      label={label}
      value={value}
    />
  )
}

function PostImportAction({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center gap-2 rounded-xl px-4 py-3"
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: '#6D5AF6',
        backgroundColor: '#111B3D',
        opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color="#C4B5FD" />
      <Text className="text-[12px] font-black text-brand-teacher">{label}</Text>
    </Pressable>
  )
}

function parseEmails(value: string) {
  const pieces = value
    .split(/[\s,;]+/)
    .map((item) => normalizeEmail(item))
    .filter(Boolean)

  const valid: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()

  pieces.forEach((email) => {
    if (!isValidEmail(email)) {
      invalid.push(email)
      return
    }
    if (!seen.has(email)) {
      seen.add(email)
      valid.push(email)
    }
  })

  return { valid, invalid }
}

function buildCredentialsCsv(students: ImportedStudentRow[], context: { subjectName: string; classroomName: string }) {
  const headers = ['Email', 'Estado', 'Contraseña temporal', 'Curso', 'Clase', 'Email enviado']
  const rows = students.map((student) => [
    student.email,
    student.status === 'created' ? 'Cuenta creada' : 'Cuenta existente',
    student.temporaryPassword || '',
    context.subjectName,
    context.classroomName,
    student.emailSent === false ? 'No' : 'Sí',
  ])

  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')}`
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'alumnos'
}
