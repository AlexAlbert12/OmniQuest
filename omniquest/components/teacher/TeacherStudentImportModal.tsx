import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { isValidEmail, normalizeEmail } from '../../lib/auth'

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
}

type TeacherStudentImportModalProps = {
  visible: boolean
  subjectId: number
  subjectName: string
  classroomId?: number | null
  classroomName?: string | null
  onClose: () => void
  onImported: () => void
}

export default function TeacherStudentImportModal({
  visible,
  subjectId,
  subjectName,
  classroomId,
  classroomName,
  onClose,
  onImported,
}: TeacherStudentImportModalProps) {
  const [rawEmails, setRawEmails] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileMessage, setFileMessage] = useState<string | null>(null)
  const { width } = useWindowDimensions()
  const isPhone = width < 640

  const parsed = useMemo(() => parseEmails(rawEmails), [rawEmails])
  const validEmails = parsed.valid
  const invalidEmails = parsed.invalid

  const resetAndClose = () => {
    if (importing) return
    setResult(null)
    setFileMessage(null)
    onClose()
  }

  const importStudents = async () => {
    if (validEmails.length === 0 || importing) return

    try {
      setImporting(true)
      setResult(null)

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View className={`flex-1 bg-black/70 ${isPhone ? 'justify-end' : 'items-center justify-center px-4 py-8'}`}>
        <View className={`${isPhone ? 'h-[94%] w-full rounded-t-3xl' : 'max-h-full w-full max-w-[760px] rounded-3xl'} overflow-hidden border border-[#1A3155] bg-[#07162D]`}>
          <View className="flex-row items-start justify-between gap-4 border-b border-[#1A3155] px-5 py-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[22px] font-black text-white">Importar alumnos</Text>
              <Text className="mt-1 text-[13px] leading-5 text-[#AFC2DB]">
                Inscribe alumnos en {classroomName || 'la clase activa'} del curso {subjectName}. Puedes pegar correos separados por saltos, comas o copiar una columna desde Excel.
              </Text>
            </View>
            <Pressable
              onPress={resetAndClose}
              className="h-10 w-10 items-center justify-center rounded-xl bg-[#0D1D3B]"
              style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
            >
              <Ionicons name="close" size={21} color="#DDE7F4" />
            </Pressable>
          </View>

          <ScrollView className={isPhone ? 'flex-1' : 'max-h-[680px]'} contentContainerStyle={{ padding: isPhone ? 16 : 20, paddingBottom: isPhone ? 28 : 20 }} showsVerticalScrollIndicator={false}>
            <View className="rounded-2xl border border-[#20375E] bg-[#09162C] p-4">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="font-black text-white">Correos de alumnos</Text>
                  <Text className="mt-1 text-[12px] text-[#8FA7C7]">Ejemplo: aalbertc@uah.es, mlopez@uah.es</Text>
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
                  <Text className="text-[12px] font-black text-[#C4B5FD]">CSV/TXT</Text>
                </Pressable>
              </View>

              <TextInput
                value={rawEmails}
                onChangeText={setRawEmails}
                multiline
                textAlignVertical="top"
                placeholder="Pega aquí los correos o una columna copiada desde Excel"
                placeholderTextColor="#60799C"
                className="mt-4 min-h-[180px] rounded-2xl border border-[#2A456A] bg-[#061426] px-4 py-3 text-[14px] text-white"
              />

              {fileMessage ? <Text className="mt-2 text-[12px] text-[#AFC2DB]">{fileMessage}</Text> : null}

              <View className="mt-4 flex-row flex-wrap gap-3">
                <ImportCounter icon="checkmark-circle-outline" label="Válidos" value={validEmails.length} color="#34D399" />
                <ImportCounter icon="alert-circle-outline" label="Inválidos" value={invalidEmails.length} color="#FB7185" />
                <ImportCounter icon="people-outline" label="Únicos" value={new Set(validEmails).size} color="#60A5FA" />
              </View>

              {invalidEmails.length > 0 ? (
                <View className="mt-4 rounded-xl border border-[#3B1D2A] bg-[#1F1020] p-3">
                  <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-[#FB7185]">Correos ignorados</Text>
                  <Text className="mt-2 text-[12px] leading-5 text-[#FCA5A5]">{invalidEmails.slice(0, 8).join(', ')}</Text>
                </View>
              ) : null}
            </View>

            {result ? <ImportResultPanel result={result} /> : null}

            <View className={`${isPhone ? 'mt-5 gap-3' : 'mt-5 flex-row flex-wrap justify-end gap-3'}`}>
              <Pressable
                onPress={resetAndClose}
                disabled={importing}
                className="rounded-xl px-5 py-3"
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: '#20375E',
                  backgroundColor: '#09162C',
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Text className="font-bold text-[#B7C4D7]">Cerrar</Text>
              </Pressable>
              <Pressable
                onPress={() => void importStudents()}
                disabled={importing || validEmails.length === 0}
                className="flex-row items-center gap-2 rounded-xl px-5 py-3"
                style={({ pressed }) => ({
                  backgroundColor: '#6D5AF6',
                  opacity: importing || validEmails.length === 0 ? 0.55 : pressed ? 0.82 : 1,
                })}
              >
                {importing ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />}
                <Text className="font-black text-white">{importing ? 'Importando...' : 'Importar alumnos'}</Text>
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
    <View className="flex-row items-center gap-2 rounded-xl bg-[#0D1D3B] px-3 py-2">
      <Ionicons name={icon} size={16} color={color} />
      <Text className="text-[12px] font-bold text-[#DDE7F4]">{label}</Text>
      <Text className="text-[12px] font-black" style={{ color }}>{value}</Text>
    </View>
  )
}

function ImportResultPanel({ result }: { result: ImportResult }) {
  return (
    <View className="mt-5 rounded-2xl border border-[#1A3155] bg-[#09162C] p-4">
      <Text className="font-black text-white">Resultado de la importación</Text>
      <View className="mt-3 flex-row flex-wrap gap-3">
        <ImportCounter icon="person-add-outline" label="Creados" value={result.created} color="#60A5FA" />
        <ImportCounter icon="school-outline" label="Inscritos" value={result.enrolled} color="#34D399" />
        <ImportCounter icon="person-outline" label="Ya tenían cuenta" value={result.existing} color="#A78BFA" />
        <ImportCounter icon="checkmark-done-outline" label="Ya inscritos" value={result.alreadyEnrolled} color="#FBBF24" />
        <ImportCounter icon="mail-outline" label="Emails enviados" value={result.emailsSent} color="#38BDF8" />
      </View>

      {result.emailsSkipped > 0 ? (
        <Text className="mt-3 text-[12px] leading-5 text-[#FBBF24]">
          {result.emailsSkipped} email{result.emailsSkipped === 1 ? '' : 's'} no se enviaron. Configura RESEND_API_KEY y MAIL_FROM en Supabase Functions.
        </Text>
      ) : null}

      {result.failed.length > 0 ? (
        <View className="mt-4 rounded-xl border border-[#3B1D2A] bg-[#1F1020] p-3">
          <Text className="text-[12px] font-black uppercase tracking-[0.06em] text-[#FB7185]">Errores</Text>
          {result.failed.slice(0, 6).map((item) => (
            <Text key={`${item.email}-${item.reason}`} className="mt-2 text-[12px] text-[#FCA5A5]">
              {item.email}: {item.reason}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
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
