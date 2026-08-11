import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { COURSE_ICON_CHOICES, normalizeAcademicIcon, type AcademicIconName } from '../../lib/academicIcons'
import { formatCount } from '../../lib/formatCount'
import { generateUniqueClassCode, isClassCodeAvailable, isValidInviteCode, normalizeInviteCode } from '../../lib/classCode'
import { useAppModal } from '../AppModalProvider'
import AppButton from '../ui/AppButton'
import OmniLoadingScreen from '../ui/OmniLoadingScreen'
import TeacherPageHeader from './TeacherPageHeader'

type TeacherSubjectFormProps = {
  mode: 'create' | 'edit'
  subjectId?: string
}

type InviteMode = 'auto' | 'custom'

type FormSnapshot = {
  name: string
  description: string
  icon: AcademicIconName
  educationLevel: string
  schoolYear: string
  inviteMode: InviteMode
  customCode: string
}

const iconChoices = COURSE_ICON_CHOICES
const CURRENT_ACADEMIC_YEAR = getCurrentAcademicYear()

export default function TeacherSubjectForm({ mode, subjectId }: TeacherSubjectFormProps) {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { showModal } = useAppModal()
  const isEdit = mode === 'edit'
  const isWide = width >= 980

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<AcademicIconName>('book-outline')
  const [educationLevel, setEducationLevel] = useState('')
  const [schoolYear, setSchoolYear] = useState(CURRENT_ACADEMIC_YEAR)
  const [inviteMode, setInviteMode] = useState<InviteMode>('auto')
  const [customCode, setCustomCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [existingCode, setExistingCode] = useState('')
  const [studentCount, setStudentCount] = useState<number | null>(isEdit ? null : 0)
  const [loadingInitial, setLoadingInitial] = useState(isEdit)
  const [codeLoading, setCodeLoading] = useState(!isEdit)
  const [saving, setSaving] = useState(false)

  const initialSnapshotRef = useRef<FormSnapshot>({
    name: '', description: '', icon: 'book-outline', educationLevel: '',
    schoolYear: CURRENT_ACADEMIC_YEAR, inviteMode: 'auto', customCode: '',
  })
  const leaveApprovedRef = useRef(false)

  const currentSnapshot = useMemo<FormSnapshot>(() => ({
    name, description, icon, educationLevel, schoolYear, inviteMode, customCode,
  }), [customCode, description, educationLevel, icon, inviteMode, name, schoolYear])
  const isDirty = useMemo(() => serializeSnapshot(currentSnapshot) !== serializeSnapshot(initialSnapshotRef.current), [currentSnapshot])

  const nameCounter = `${name.trim().length}/50`
  const descriptionCounter = `${description.trim().length}/120`
  const canSave = !saving && !codeLoading && name.trim().length > 0 && (isEdit || (inviteMode === 'auto' && isValidInviteCode(generatedCode)) || (inviteMode === 'custom' && isValidInviteCode(customCode)))
  const previewTitle = useMemo(() => name.trim() || 'Nombre del curso', [name])
  const previewMeta = useMemo(() => [educationLevel.trim(), schoolYear.trim()].filter(Boolean).join('  •  ') || 'Nivel y año sin especificar', [educationLevel, schoolYear])
  const studentsHint = isEdit ? (studentCount === null ? null : formatCount(studentCount, 'alumno', 'alumnos')) : '0 alumnos'

  const showError = useCallback((title: string, message: string) => showModal({ title, message, variant: 'error' }), [showModal])

  useEffect(() => {
    if (isEdit) return
    const loadUniqueCode = async () => {
      try {
        setCodeLoading(true)
        setGeneratedCode(await generateUniqueClassCode())
      } catch (error: any) {
        showError('Error', error.message || 'No se pudo generar un código de invitación.')
      } finally {
        setCodeLoading(false)
      }
    }
    void loadUniqueCode()
  }, [isEdit, showError])

  useEffect(() => {
    if (!isEdit || !subjectId) return
    const fetchSubject = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const teacherId = sessionData.session?.user.id
        if (!teacherId) throw new Error('No se encontró una sesión activa.')

        const { data, error } = await supabase
          .from('subjects')
          .select('name, description, icon, code, education_level, academic_year')
          .eq('id', Number(subjectId))
          .eq('teacher_id', teacherId)
          .single()
        if (error) throw error

        const subjectIcon = normalizeAcademicIcon(data.icon, 'book-outline')
        const legacyMetadata = parseLegacySubjectMetadata(data.description || '')
        const nextSnapshot: FormSnapshot = {
          name: data.name || '',
          description: legacyMetadata.description,
          icon: subjectIcon,
          educationLevel: data.education_level || legacyMetadata.educationLevel || '',
          schoolYear: data.academic_year || legacyMetadata.academicYear || '',
          inviteMode: 'auto',
          customCode: '',
        }
        setName(nextSnapshot.name)
        setDescription(nextSnapshot.description)
        setIcon(nextSnapshot.icon)
        setEducationLevel(nextSnapshot.educationLevel)
        setSchoolYear(nextSnapshot.schoolYear)
        setExistingCode(data.code || '')
        initialSnapshotRef.current = nextSnapshot

        const { data: enrollmentRows, error: enrollmentError } = await supabase.from('enrollments').select('student_id').eq('subject_id', Number(subjectId))
        if (!enrollmentError && enrollmentRows) setStudentCount(new Set(enrollmentRows.map((row) => row.student_id)).size)
      } catch (error: any) {
        showModal({
          title: 'No se pudo cargar el curso',
          message: error.message || 'Inténtalo de nuevo.',
          variant: 'error',
          buttons: [{ label: 'Volver', role: 'primary', onPress: () => router.back() }],
        })
      } finally {
        setLoadingInitial(false)
      }
    }
    void fetchSubject()
  }, [isEdit, router, showModal, subjectId])

  const handleRegenerateCode = useCallback(async () => {
    if (isEdit) return
    try {
      setCodeLoading(true)
      setGeneratedCode(await generateUniqueClassCode())
    } catch (error: any) {
      showError('Error', error.message || 'No se pudo generar un código único.')
    } finally {
      setCodeLoading(false)
    }
  }, [isEdit, showError])

  const confirmLeave = useCallback((onLeave: () => void) => {
    if (!isDirty || saving || leaveApprovedRef.current) return onLeave()
    showModal({
      title: 'Descartar cambios',
      message: 'Hay cambios sin guardar. Si sales ahora se perderán.',
      variant: 'warning',
      buttons: [
        { label: 'Seguir editando', role: 'cancel' },
        { label: 'Descartar', role: 'danger', onPress: () => { leaveApprovedRef.current = true; onLeave() } },
      ],
    })
  }, [isDirty, saving, showModal])

  const handleCancel = useCallback(() => confirmLeave(() => router.back()), [confirmLeave, router])

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.('beforeRemove', (event: any) => {
      if (!isDirty || leaveApprovedRef.current || saving) return
      event.preventDefault()
      confirmLeave(() => (navigation as any).dispatch(event.data.action))
    })
    return unsubscribe
  }, [confirmLeave, isDirty, navigation, saving])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || leaveApprovedRef.current || saving) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty, saving])

  const handleSave = useCallback(async () => {
    const cleanName = name.trim()
    const cleanDescription = description.trim()
    if (!cleanName) return showError('Error', 'El nombre del curso es obligatorio.')
    if (cleanName.length > 50) return showError('Error', 'El nombre no puede superar 50 caracteres.')
    if (cleanDescription.length > 120) return showError('Error', 'La descripción no puede superar 120 caracteres.')
    if (!isEdit && inviteMode === 'custom' && !isValidInviteCode(customCode)) return showError('Error', 'El código personalizado debe tener 6 caracteres alfanuméricos.')

    setSaving(true)
    try {
      if (isEdit) {
        if (!subjectId) throw new Error('No se encontró el curso a editar.')
        const { data, error } = await supabase.functions.invoke('teacher-update-subject', {
          body: {
            subjectId: Number(subjectId), name: cleanName, description: cleanDescription || null, icon,
            educationLevel: educationLevel.trim() || null, academicYear: schoolYear.trim() || null,
          },
        })
        if (error) throw error
        if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)
        initialSnapshotRef.current = currentSnapshot
        leaveApprovedRef.current = true
        showModal({ title: 'Curso actualizado', message: 'Los cambios se guardaron correctamente.', variant: 'success', buttons: [{ label: 'Aceptar', role: 'primary', onPress: () => router.back() }] })
        return
      }

      const code = inviteMode === 'auto' ? generatedCode : normalizeInviteCode(customCode)
      if (!isValidInviteCode(code)) throw new Error('El código de invitación no es válido.')
      const codeAvailable = await isClassCodeAvailable(code)
      if (!codeAvailable) {
        if (inviteMode === 'auto') {
          const nextCode = await generateUniqueClassCode()
          setGeneratedCode(nextCode)
          throw new Error('El código mostrado acaba de dejar de estar disponible. Hemos generado uno nuevo; revísalo y vuelve a crear el curso.')
        }
        throw new Error('Ese código de invitación ya existe. Elige otro o genera uno nuevo.')
      }

      const { data: createdSubject, error: createSubjectError } = await supabase.rpc('create_subject_with_default_topic', {
        p_name: cleanName,
        p_description: cleanDescription || undefined,
        p_icon: icon,
        p_code: code,
        p_education_level: educationLevel.trim() || undefined,
        p_academic_year: schoolYear.trim() || undefined,
        p_theme_color: undefined,
      })
      if (createSubjectError) throw createSubjectError
      const createdCode = createdSubject && typeof createdSubject === 'object' && !Array.isArray(createdSubject) ? String((createdSubject as { code?: string }).code || code) : code
      initialSnapshotRef.current = currentSnapshot
      leaveApprovedRef.current = true
      showModal({ title: 'Curso creado', message: `Código de invitación: ${createdCode}`, variant: 'success', buttons: [{ label: 'Aceptar', role: 'primary', onPress: () => router.back() }] })
    } catch (error: any) {
      showError('No se pudo guardar el curso', error.message || 'Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }, [currentSnapshot, customCode, description, educationLevel, generatedCode, icon, inviteMode, isEdit, name, router, schoolYear, showError, showModal, subjectId])

  if (loadingInitial) return <OmniLoadingScreen />

  const saveLabel = saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear curso'
  const actionButtons = (
    <View className={`flex-row gap-3 ${isWide ? 'justify-end' : ''}`}>
      <AppButton label="Cancelar" accessibilityLabel="Cancelar y volver" icon="close" variant="secondary" disabled={saving} onPress={handleCancel} style={{ flex: isWide ? undefined : 1, minWidth: isWide ? 140 : undefined }} />
      <AppButton label={saveLabel} accessibilityLabel={saveLabel} icon="sparkles-outline" role="teacher" loading={saving} disabled={!canSave} onPress={handleSave} style={{ flex: isWide ? undefined : 1, minWidth: isWide ? 280 : undefined }} />
    </View>
  )

  return (
    <View className="flex-1 bg-background-primary">
      <View className="absolute inset-0 bg-background-primary" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: isWide ? 20 : 112 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pb-5 pt-4 md:px-6 lg:px-8">
          <View className="rounded-[18px] border border-border-default bg-surface-default p-4 md:p-6">
            <TeacherPageHeader
              backAction={{ label: 'Volver', onPress: handleCancel }}
              icon={isEdit ? 'create-outline' : 'add-circle-outline'}
              isDesktop={isWide}
              title={isEdit ? 'Editar curso' : 'Nuevo curso'}
              subtitle={isEdit ? 'Actualiza la información y configuración del curso.' : 'Crea un curso y comienza a añadir clases, contenido y alumnos.'}
              showNotifications={false}
              showAvatar={false}
              showGlobalSearch={false}
              className="mb-0"
            />

            <View className={`mt-5 gap-4 ${isWide ? 'flex-row' : ''}`}>
              <View className={`${isWide ? 'flex-[1.65]' : ''}`}>
                <SectionCard step={1} title="Información básica" description="Completa los datos principales de tu curso.">
                  <View className={`gap-4 ${width >= 760 ? 'flex-row' : ''}`}>
                    <View className={`${width >= 760 ? 'w-[34%]' : ''}`}>
                      <Label text="Icono" />
                      <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                        {iconChoices.map((choice) => {
                          const active = icon === choice.icon
                          return (
                            <View key={choice.icon} style={{ width: '25%', paddingHorizontal: 6, paddingBottom: 10 }}>
                              <Pressable accessibilityLabel={`Icono ${choice.label}`} accessibilityState={{ selected: active }} onPress={() => setIcon(choice.icon)} className={`h-20 items-center justify-center rounded-xl border ${active ? 'border-border-active bg-surface-selected' : 'border-border-default bg-surface-raised'}`}>
                                <Ionicons name={choice.icon} size={30} color={active ? '#38BDF8' : '#9FB0CA'} />
                              </Pressable>
                            </View>
                          )
                        })}
                      </View>
                    </View>

                    <View className={`${width >= 760 ? 'flex-1' : ''}`}>
                      <Label text="Nombre del curso" />
                      <TextInput className="mt-3 rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-[16px] text-white" placeholder="Ej. Matemáticas Avanzadas" placeholderTextColor="#7F95B7" value={name} onChangeText={setName} maxLength={50} />
                      <Text className="mt-2 text-right text-[12px] text-text-muted">{nameCounter}</Text>
                      <Label text="Breve descripción (opcional)" className="mt-3" />
                      <TextInput className="mt-3 min-h-[86px] rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-[15px] text-white" placeholder="Describe brevemente de qué trata este curso..." placeholderTextColor="#7F95B7" value={description} onChangeText={setDescription} multiline textAlignVertical="top" maxLength={120} />
                      <Text className="mt-2 text-right text-[12px] text-text-muted">{descriptionCounter}</Text>
                    </View>
                  </View>
                </SectionCard>

                <SectionCard step={2} title="Configuración del curso" description="Ajusta las opciones principales de tu curso." className="mt-4">
                  <View className={`gap-3 ${width >= 760 ? 'flex-row' : ''}`}>
                    <TextFieldCard icon="people-outline" tint="#8B5CF6" label="Nivel educativo" value={educationLevel} placeholder="Ej. 1.º ESO" onChange={setEducationLevel} />
                    <TextFieldCard icon="calendar-outline" tint="#8B5CF6" label="Año académico (opcional)" value={schoolYear} placeholder="Ej. 2026 - 2027" onChange={setSchoolYear} />
                  </View>
                </SectionCard>

                <SectionCard step={3} title="Código de invitación" description="El código permitirá a tus alumnos unirse al curso y entrar en su clase principal." className="mt-4">
                  {isEdit ? (
                    <View className={`gap-4 ${width >= 840 ? 'flex-row items-center justify-between' : ''}`}>
                      <View className={`${width >= 840 ? 'flex-1' : ''}`}>
                        <Text className="font-bold text-brand-teacher">Código actual del curso</Text>
                        <Text className="mt-1 text-[13px] text-text-secondary">Este código ya está en uso por tus alumnos y se mantiene sin cambios.</Text>
                      </View>
                      <InviteCodeCard label="Código de invitación" code={existingCode || '------'} />
                    </View>
                  ) : (
                    <View className={`gap-4 ${width >= 840 ? 'flex-row items-center justify-between' : ''}`}>
                      <View className={`${width >= 840 ? 'flex-1' : ''}`}>
                        <RadioOption active={inviteMode === 'auto'} title="Generar código automáticamente" detail="El código mostrado será exactamente el que se guardará al crear el curso." onPress={() => setInviteMode('auto')} />
                        <RadioOption active={inviteMode === 'custom'} title="Personalizar código" detail="Elige tu propio código de 6 caracteres." onPress={() => setInviteMode('custom')} className="mt-3" />
                      </View>
                      <View className={`${width >= 840 ? 'w-[320px]' : ''}`}>
                        <View className="rounded-2xl border border-dashed border-border-active bg-surface-raised p-4">
                          <Text className="text-center text-[17px] text-text-secondary">{inviteMode === 'auto' ? 'Código generado' : 'Código personalizado'}</Text>
                          {inviteMode === 'custom' ? (
                            <TextInput className="mt-3 rounded-xl border border-border-default bg-surface-default px-4 py-3 text-center text-[42px] font-black tracking-[8px] text-brand-teacher" value={normalizeInviteCode(customCode)} onChangeText={(text) => setCustomCode(normalizeInviteCode(text))} placeholder="ABC123" placeholderTextColor="#5E6EA6" autoCapitalize="characters" />
                          ) : (
                            <Text className="mt-3 text-center text-[52px] font-black tracking-[8px] text-brand-teacher">{codeLoading ? '------' : generatedCode}</Text>
                          )}
                        </View>
                        <AppButton accessibilityLabel="Generar otro código" icon="refresh" iconOnly size="sm" variant="secondary" disabled={codeLoading || inviteMode !== 'auto'} loading={codeLoading} onPress={handleRegenerateCode} style={{ alignSelf: 'flex-end', marginTop: 12 }} />
                      </View>
                    </View>
                  )}
                </SectionCard>
              </View>

              <View className={`${isWide ? 'w-[30%]' : ''}`}>
                <View className="rounded-2xl border border-border-default bg-surface-default p-4">
                  <Text className="text-[20px] font-black text-white">Vista previa</Text>
                  <Text className="mt-1 text-[14px] text-text-secondary">Así es como verán tus alumnos el curso.</Text>
                  <View className="mt-4 rounded-2xl border border-border-active bg-brand-student p-5">
                    <View className="mx-auto h-20 w-20 items-center justify-center rounded-full bg-surface-selected"><Ionicons name={icon} size={34} color="#38BDF8" /></View>
                    <Text className="mt-4 text-center text-[28px] font-black text-white">{previewTitle}</Text>
                    <Text className="mt-2 text-center text-[15px] text-text-secondary">{previewMeta}</Text>
                    {studentsHint ? <Text className="mt-5 text-center text-[15px] text-text-secondary">{studentsHint}</Text> : null}
                  </View>
                </View>
                <View className="mt-4 rounded-2xl border border-border-default bg-surface-default p-4">
                  <FeatureRow icon="shield-checkmark-outline" tint="#8B5CF6" title="Entorno seguro" detail="Solo los alumnos con el código podrán unirse." />
                  <FeatureRow icon="trophy-outline" tint="#F6A64A" title="Progreso del alumnado" detail="Los alumnos recibirán puntuación y podrán completar retos." className="mt-4" />
                  <FeatureRow icon="bar-chart-outline" tint="#FBBF24" title="Seguimiento" detail="Podrás ver el progreso y rendimiento de tus alumnos." className="mt-4" />
                </View>
              </View>
            </View>

            {isWide ? <View className="mt-4 rounded-2xl border border-border-default bg-surface-default p-4">{actionButtons}</View> : null}
          </View>
        </View>
      </ScrollView>

      {!isWide ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-border-default bg-background-secondary px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          {actionButtons}
        </View>
      ) : null}
    </View>
  )
}

function SectionCard({ step, title, description, className = '', children }: { step: number; title: string; description: string; className?: string; children: React.ReactNode }) {
  return (
    <View className={`rounded-2xl border border-border-default bg-surface-default p-4 ${className}`}>
      <View className="flex-row items-start gap-3">
        <View className="mt-1 h-8 w-8 items-center justify-center rounded-full bg-brand-teacher"><Text className="font-black text-white">{step}</Text></View>
        <View className="min-w-0 flex-1"><Text className="text-[22px] font-black text-white">{title}</Text><Text className="mt-1 text-[14px] text-text-secondary">{description}</Text></View>
      </View>
      <View className="mt-4">{children}</View>
    </View>
  )
}

function Label({ text, className = '' }: { text: string; className?: string }) {
  return <Text className={`text-[15px] font-semibold text-white ${className}`}>{text}</Text>
}

function TextFieldCard({ icon, tint, label, value, placeholder, onChange }: { icon: keyof typeof Ionicons.glyphMap; tint: string; label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <View className="min-w-[220px] flex-1 rounded-xl border border-border-default bg-surface-raised p-3">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: `${tint}2A` }}><Ionicons name={icon} size={19} color={tint} /></View>
        <Text className="min-w-0 flex-1 text-[13px] font-semibold text-text-secondary">{label}</Text>
      </View>
      <TextInput
        accessibilityLabel={label}
        className="min-h-12 rounded-xl border border-border-active bg-surface-default px-4 py-3 text-[15px] font-semibold text-white"
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#7F95B7"
        maxLength={80}
        onChangeText={onChange}
      />
    </View>
  )
}

function InviteCodeCard({ label, code }: { label: string; code: string }) {
  return (
    <View className="rounded-2xl border border-dashed border-border-active bg-surface-raised p-4" style={{ minWidth: 280 }}>
      <Text className="text-center text-[17px] text-text-secondary">{label}</Text>
      <Text className="mt-3 text-center text-[52px] font-black tracking-[8px] text-brand-teacher">{code}</Text>
    </View>
  )
}

function RadioOption({ active, title, detail, onPress, className = '' }: { active: boolean; title: string; detail: string; onPress: () => void; className?: string }) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-start gap-3 ${className}`}>
      <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full border border-border-active">{active ? <View className="h-3 w-3 rounded-full bg-brand-teacher" /> : null}</View>
      <View className="min-w-0 flex-1"><Text className={`font-bold ${active ? 'text-brand-teacher' : 'text-white'}`}>{title}</Text><Text className="mt-1 text-[13px] text-text-secondary">{detail}</Text></View>
    </Pressable>
  )
}

function FeatureRow({ icon, tint, title, detail, className = '' }: { icon: keyof typeof Ionicons.glyphMap; tint: string; title: string; detail: string; className?: string }) {
  return (
    <View className={`flex-row items-start gap-3 ${className}`}>
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${tint}26` }}><Ionicons name={icon} size={19} color={tint} /></View>
      <View className="min-w-0 flex-1"><Text className="font-black text-white">{title}</Text><Text className="mt-1 text-[13px] text-text-secondary">{detail}</Text></View>
    </View>
  )
}

function getCurrentAcademicYear(now = new Date()) {
  const calendarYear = now.getFullYear()
  const startYear = now.getMonth() >= 8 ? calendarYear : calendarYear - 1
  return `${startYear} - ${startYear + 1}`
}

function serializeSnapshot(snapshot: FormSnapshot) {
  return JSON.stringify(snapshot)
}

function parseLegacySubjectMetadata(value: string) {
  const parts = value.split(' · ').map((part) => part.trim()).filter(Boolean)
  let educationLevel = ''
  let academicYear = ''
  const descriptionParts: string[] = []
  parts.forEach((part) => {
    if (part.startsWith('Materia: ')) return
    if (part.startsWith('Nivel: ')) return void (educationLevel = part.replace('Nivel: ', '').trim())
    if (part.startsWith('Curso: ')) return void (academicYear = part.replace('Curso: ', '').trim())
    descriptionParts.push(part)
  })
  return { description: descriptionParts.join(' · '), educationLevel, academicYear }
}
