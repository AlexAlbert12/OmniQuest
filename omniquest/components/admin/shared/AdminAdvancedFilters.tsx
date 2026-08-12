import React, { useEffect, useMemo, useState } from 'react'
import AdminButton from './AdminButton'
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { useResponsiveLayout } from '../../../lib/responsive'
import { supabase } from '../../../lib/supabase'

export type AdminFilterOption = {
  value: string
  label: string
  subtitle?: string
}

export type AdminDirectoryFilters = {
  courses: { id: number; name: string; teacher_id: string | null; active: boolean; is_archived: boolean }[]
  classrooms: { id: number; name: string; subject_id: number | null; subject_name: string | null; active: boolean }[]
  teachers: { id: string; alias: string; email: string | null; active: boolean }[]
  actors: { id: string; alias: string; email: string | null }[]
  audit_actions: string[]
  audit_entities: string[]
}

const PROFILE_ACCOUNT_OPTIONS: AdminFilterOption[] = [{ value: 'all', label: 'Activos e inactivos' }, { value: 'active', label: 'Solo activos' }, { value: 'inactive', label: 'Solo inactivos' }]
const PROFILE_ACTIVITY_OPTIONS: AdminFilterOption[] = [{ value: 'all', label: 'Cualquier actividad' }, { value: 'recent', label: 'Actividad reciente', subtitle: 'Últimos 30 días' }, { value: 'inactive', label: 'Sin actividad reciente', subtitle: 'Más de 30 días' }, { value: 'never', label: 'Nunca han iniciado actividad' }]

const EMPTY_DIRECTORY: AdminDirectoryFilters = {
  courses: [],
  classrooms: [],
  teachers: [],
  actors: [],
  audit_actions: [],
  audit_entities: [],
}

export function useAdminDirectoryFilters() {
  const [directory, setDirectory] = useState<AdminDirectoryFilters>(EMPTY_DIRECTORY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_admin_directory_filters')
      if (!cancelled) {
        if (error) {
          console.warn('[admin filters] No se pudieron cargar las opciones:', error.message)
          setDirectory(EMPTY_DIRECTORY)
        } else {
          const payload = data && typeof data === 'object' && !Array.isArray(data)
            ? data as unknown as Partial<AdminDirectoryFilters>
            : {}
          setDirectory({ ...EMPTY_DIRECTORY, ...payload })
        }
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return { directory, loading }
}

export function AdminFilterSelect({
  accessibilityLabel,
  icon = 'options-outline',
  label,
  onChange,
  options,
  value,
  minWidth = 180,
}: {
  accessibilityLabel?: string
  icon?: keyof typeof Ionicons.glyphMap
  label: string
  onChange: (value: string) => void
  options: AdminFilterOption[]
  value: string
  minWidth?: number
}) {
  const { tokens } = useAppTheme()
  const [visible, setVisible] = useState(false)
  const selected = options.find((option) => option.value === value) || options[0]

  return (
    <View style={{ minWidth, flexGrow: 1, width: minWidth === 0 ? '100%' : undefined }}>
      <Text style={[styles.fieldLabel, { color: tokens.text.muted }]}>{label}</Text>
      <AppPressable
        accessibilityLabel={accessibilityLabel || `Filtrar por ${label}`}
        accessibilityState={{ expanded: visible }}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.select,
          {
            backgroundColor: tokens.surface.interactive,
            borderColor: tokens.border.default,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={17} color={tokens.text.secondary} />
        <View style={styles.selectText}>
          <Text style={[styles.selectValue, { color: tokens.text.primary }]} numberOfLines={1}>{selected?.label || 'Todos'}</Text>
          {selected?.subtitle ? <Text style={[styles.selectSubtitle, { color: tokens.text.muted }]} numberOfLines={1}>{selected.subtitle}</Text> : null}
        </View>
        <Ionicons name="chevron-down" size={17} color={tokens.text.muted} />
      </AppPressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <AppPressable accessibilityLabel="Cerrar selector" onPress={() => setVisible(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalCard, { backgroundColor: tokens.background.primary, borderColor: tokens.border.default }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: tokens.text.primary }]}>{label}</Text>
                <Text style={[styles.modalSubtitle, { color: tokens.text.muted }]}>Selecciona una opción para aplicar el filtro.</Text>
              </View>
              <AdminButton accessibilityLabel="Cerrar" icon="close" iconOnly size="sm" variant="ghost" onPress={() => setVisible(false)} />
            </View>
            <ScrollView style={styles.optionList} contentContainerStyle={{ gap: 8 }}>
              {options.map((option) => {
                const active = option.value === value
                return (
                  <AppPressable
                    key={option.value}
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      onChange(option.value)
                      setVisible(false)
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: active ? withAlpha(tokens.brand.admin, '18') : tokens.surface.interactive,
                        borderColor: active ? withAlpha(tokens.brand.admin, 'A0') : tokens.border.default,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, { color: tokens.text.primary }]}>{option.label}</Text>
                      {option.subtitle ? <Text style={[styles.optionSubtitle, { color: tokens.text.muted }]}>{option.subtitle}</Text> : null}
                    </View>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={19} color={active ? tokens.brand.admin : tokens.text.muted} />
                  </AppPressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

export function AdminDateRangeFields({
  from,
  onChangeFrom,
  onChangeTo,
  to,
}: {
  from: string
  onChangeFrom: (value: string) => void
  onChangeTo: (value: string) => void
  to: string
}) {
  const responsive = useResponsiveLayout()
  return (
    <View style={[styles.dateGroup, responsive.isMobile ? styles.dateGroupMobile : null]}>
      <AdminDateField label="Desde" value={from} onChange={onChangeFrom} />
      <AdminDateField label="Hasta" value={to} onChange={onChangeTo} />
    </View>
  )
}

function AdminDateField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  const { tokens } = useAppTheme()
  return (
    <View style={styles.dateField}>
      <Text style={[styles.fieldLabel, { color: tokens.text.muted }]}>{label}</Text>
      <View style={[styles.dateInputShell, { backgroundColor: tokens.surface.interactive, borderColor: tokens.border.default }]}>
        <Ionicons name="calendar-outline" size={16} color={tokens.text.secondary} />
        <TextInput
          accessibilityLabel={`Fecha ${label.toLowerCase()}`}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={(next) => onChange(normalizeDateInput(next))}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={tokens.text.muted}
          style={[styles.dateInput, { color: tokens.text.primary }]}
        />
        {value ? (
          <AppPressable accessibilityLabel={`Limpiar fecha ${label.toLowerCase()}`} hitSlop={8} onPress={() => onChange('')}>
            <Ionicons name="close-circle" size={17} color={tokens.text.muted} />
          </AppPressable>
        ) : null}
      </View>
    </View>
  )
}

export function AdminProfileFilters({
  accountStatus,
  activityState,
  classroomId,
  courseId,
  createdFrom,
  createdTo,
  currentRole,
  directory,
  onChangeAccountStatus,
  onChangeActivityState,
  onChangeClassroomId,
  onChangeCourseId,
  onChangeCreatedFrom,
  onChangeCreatedTo,
  mobileAction,
}: {
  accountStatus: string
  activityState: string
  classroomId: string
  courseId: string
  createdFrom: string
  createdTo: string
  currentRole: 'teacher' | 'student'
  directory: AdminDirectoryFilters
  onChangeAccountStatus: (value: string) => void
  onChangeActivityState: (value: string) => void
  onChangeClassroomId: (value: string) => void
  onChangeCourseId: (value: string) => void
  onChangeCreatedFrom: (value: string) => void
  onChangeCreatedTo: (value: string) => void
  mobileAction?: React.ReactNode
}) {
  const router = useRouter()
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const classroomOptions = useMemo(() => {
    const filtered = courseId ? directory.classrooms.filter((item) => String(item.subject_id) === courseId) : directory.classrooms
    return [{ value: '', label: 'Todas las clases' }, ...filtered.map((item) => ({ value: String(item.id), label: item.name, subtitle: item.subject_name || undefined }))]
  }, [courseId, directory.classrooms])
  const courseOptions = useMemo(() => [{ value: '', label: 'Todos los cursos' }, ...directory.courses.map((item) => ({ value: String(item.id), label: item.name, subtitle: item.is_archived ? 'Archivado' : item.active ? 'Activo' : 'Inactivo' }))], [directory.courses])

  useEffect(() => {
    if (classroomId && !classroomOptions.some((option) => option.value === classroomId)) onChangeClassroomId('')
  }, [classroomId, classroomOptions, onChangeClassroomId])

  const activeFilters = useMemo(() => {
    const values: { key: string; label: string; clear: () => void }[] = []
    if (accountStatus !== 'all') values.push({ key: 'status', label: `Estado: ${PROFILE_ACCOUNT_OPTIONS.find((item) => item.value === accountStatus)?.label || accountStatus}`, clear: () => onChangeAccountStatus('all') })
    if (activityState !== 'all') values.push({ key: 'activity', label: `Actividad: ${PROFILE_ACTIVITY_OPTIONS.find((item) => item.value === activityState)?.label || activityState}`, clear: () => onChangeActivityState('all') })
    if (courseId) values.push({ key: 'course', label: `Curso: ${courseOptions.find((item) => item.value === courseId)?.label || courseId}`, clear: () => onChangeCourseId('') })
    if (classroomId) values.push({ key: 'classroom', label: `Clase: ${classroomOptions.find((item) => item.value === classroomId)?.label || classroomId}`, clear: () => onChangeClassroomId('') })
    if (createdFrom) values.push({ key: 'from', label: `Desde: ${createdFrom}`, clear: () => onChangeCreatedFrom('') })
    if (createdTo) values.push({ key: 'to', label: `Hasta: ${createdTo}`, clear: () => onChangeCreatedTo('') })
    return values
  }, [accountStatus, activityState, classroomId, classroomOptions, courseId, courseOptions, createdFrom, createdTo, onChangeAccountStatus, onChangeActivityState, onChangeClassroomId, onChangeCourseId, onChangeCreatedFrom, onChangeCreatedTo])

  const sharedFields = (mobile: boolean) => <>
    {!mobile ? <AdminFilterSelect label="Rol" icon="people-outline" value={currentRole} onChange={(value) => router.push(value === 'teacher' ? '/(admin)/teachers' as any : '/(admin)/students' as any)} options={[{ value: 'teacher', label: 'Profesores' }, { value: 'student', label: 'Alumnos' }]} minWidth={mobile ? 0 : 180} /> : null}
    <AdminFilterSelect label="Estado de cuenta" icon="shield-checkmark-outline" value={accountStatus} onChange={onChangeAccountStatus} options={PROFILE_ACCOUNT_OPTIONS} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Actividad" icon="pulse-outline" value={activityState} onChange={onChangeActivityState} options={PROFILE_ACTIVITY_OPTIONS} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Curso" icon="book-outline" value={courseId} onChange={onChangeCourseId} options={courseOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Clase" icon="albums-outline" value={classroomId} onChange={onChangeClassroomId} options={classroomOptions} minWidth={mobile ? 0 : 180} />
    <AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={onChangeCreatedFrom} onChangeTo={onChangeCreatedTo} />
  </>

  if (!responsive.isMobile) return <View style={styles.filterGrid}>{sharedFields(false)}</View>

  return <View style={styles.mobileFilters}>
    <View style={styles.mobileFilterActions}><View style={{ flex: 1 }}><AdminButton label={activeFilters.length > 0 ? `Filtros (${activeFilters.length})` : 'Filtros'} icon="options-outline" variant="secondary" fullWidth onPress={() => setMobileOpen(true)} /></View>{mobileAction}</View>
    {activeFilters.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilterChips}>{activeFilters.map((filter) => <AppPressable key={filter.key} accessibilityLabel={`Quitar ${filter.label}`} onPress={filter.clear} style={({ pressed }) => ({ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, backgroundColor: withAlpha(tokens.brand.admin, '18'), borderColor: withAlpha(tokens.brand.admin, '70'), opacity: pressed ? 0.76 : 1 })}><Text numberOfLines={1} style={{ maxWidth: 220, color: tokens.text.primary, fontSize: 11, fontWeight: '800' }}>{filter.label}</Text><Ionicons name="close" size={14} color={tokens.brand.admin} /></AppPressable>)}</ScrollView> : null}
    <AppBottomSheet visible={mobileOpen} onClose={() => setMobileOpen(false)} title="Filtros" description={`Refina el listado de ${currentRole === 'teacher' ? 'profesores' : 'alumnos'} sin perder espacio en la vista principal.`} footer={<AdminButton label="Ver resultados" icon="checkmark" fullWidth onPress={() => setMobileOpen(false)} />}>
      <View style={styles.mobileFilterStack}>{sharedFields(true)}</View>
    </AppBottomSheet>
  </View>
}

export function toAdminFilterTimestamp(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
}

function normalizeDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

const styles = StyleSheet.create({
  filterGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 12,
  },
  fieldLabel: {
    marginBottom: 7,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  select: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectText: {
    minWidth: 0,
    flex: 1,
  },
  selectValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  selectSubtitle: {
    marginTop: 1,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(1, 5, 15, 0.84)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '78%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  modalHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalHeaderText: {
    minWidth: 0,
    flex: 1,
  },
  modalTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
  },
  optionList: {
    maxHeight: 460,
  },
  option: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    minWidth: 0,
    flex: 1,
  },
  optionLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  optionSubtitle: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
  },
  dateGroup: {
    minWidth: 300,
    flexGrow: 1,
    flexDirection: 'row',
    gap: 10,
  },
  dateGroupMobile: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'column',
  },
  dateField: {
    minWidth: 140,
    flex: 1,
  },
  dateInputShell: {
    height: 48,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    minWidth: 0,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  mobileFilters: {
    marginTop: 14,
    gap: 10,
  },
  mobileFilterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeFilterChips: {
    gap: 8,
    paddingRight: 4,
  },
  mobileFilterStack: {
    gap: 14,
  },
})

export function AdminCourseSupervisionFilters({
  activeState,
  archivedState,
  createdFrom,
  createdTo,
  directory,
  onChangeActiveState,
  onChangeArchivedState,
  onChangeCreatedFrom,
  onChangeCreatedTo,
  onChangeTeacherId,
  teacherId,
}: {
  activeState: string
  archivedState: string
  createdFrom: string
  createdTo: string
  directory: AdminDirectoryFilters
  onChangeActiveState: (value: string) => void
  onChangeArchivedState: (value: string) => void
  onChangeCreatedFrom: (value: string) => void
  onChangeCreatedTo: (value: string) => void
  onChangeTeacherId: (value: string) => void
  teacherId: string
}) {
  return (
    <View style={styles.filterGrid}>
      <AdminFilterSelect
        label="Profesor propietario"
        icon="school-outline"
        value={teacherId}
        onChange={onChangeTeacherId}
        options={[
          { value: '', label: 'Todos los profesores' },
          ...directory.teachers.map((teacher) => ({ value: teacher.id, label: teacher.alias, subtitle: teacher.email || undefined })),
        ]}
      />
      <AdminFilterSelect
        label="Estado"
        icon="power-outline"
        value={activeState}
        onChange={onChangeActiveState}
        options={[
          { value: 'all', label: 'Activos e inactivos' },
          { value: 'active', label: 'Solo activos' },
          { value: 'inactive', label: 'Solo inactivos' },
        ]}
      />
      <AdminFilterSelect
        label="Archivo"
        icon="archive-outline"
        value={archivedState}
        onChange={onChangeArchivedState}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'current', label: 'No archivados' },
          { value: 'archived', label: 'Archivados' },
        ]}
      />
      <AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={onChangeCreatedFrom} onChangeTo={onChangeCreatedTo} />
    </View>
  )
}

export function AdminClassroomSupervisionFilters({
  activeState,
  courseId,
  createdFrom,
  createdTo,
  directory,
  onChangeActiveState,
  onChangeCourseId,
  onChangeCreatedFrom,
  onChangeCreatedTo,
  onChangeTeacherId,
  teacherId,
}: {
  activeState: string
  courseId: string
  createdFrom: string
  createdTo: string
  directory: AdminDirectoryFilters
  onChangeActiveState: (value: string) => void
  onChangeCourseId: (value: string) => void
  onChangeCreatedFrom: (value: string) => void
  onChangeCreatedTo: (value: string) => void
  onChangeTeacherId: (value: string) => void
  teacherId: string
}) {
  const courseOptions = directory.courses.filter((course) => !teacherId || course.teacher_id === teacherId)

  useEffect(() => {
    if (courseId && !courseOptions.some((course) => String(course.id) === courseId)) {
      onChangeCourseId('')
    }
  }, [courseId, courseOptions, onChangeCourseId])

  return (
    <View style={styles.filterGrid}>
      <AdminFilterSelect
        label="Profesor propietario"
        icon="school-outline"
        value={teacherId}
        onChange={onChangeTeacherId}
        options={[
          { value: '', label: 'Todos los profesores' },
          ...directory.teachers.map((teacher) => ({ value: teacher.id, label: teacher.alias, subtitle: teacher.email || undefined })),
        ]}
      />
      <AdminFilterSelect
        label="Curso"
        icon="book-outline"
        value={courseId}
        onChange={onChangeCourseId}
        options={[
          { value: '', label: 'Todos los cursos' },
          ...courseOptions.map((course) => ({ value: String(course.id), label: course.name })),
        ]}
      />
      <AdminFilterSelect
        label="Estado"
        icon="power-outline"
        value={activeState}
        onChange={onChangeActiveState}
        options={[
          { value: 'all', label: 'Activas e inactivas' },
          { value: 'active', label: 'Solo activas' },
          { value: 'inactive', label: 'Solo inactivas' },
        ]}
      />
      <AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={onChangeCreatedFrom} onChangeTo={onChangeCreatedTo} />
    </View>
  )
}
