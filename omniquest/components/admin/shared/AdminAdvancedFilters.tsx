import React, { useEffect, useMemo, useState } from 'react'
import AdminButton from './AdminButton'
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppBottomSheet from '../../ui/AppBottomSheet'
import AppPressable from '../../ui/AppPressable'
import DateCalendar from '../../ui/DateCalendar'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { useI18n } from '../../../lib/i18n'
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
  fromLabel = 'Desde',
  onChangeFrom,
  onChangeTo,
  to,
  toLabel = 'Hasta',
}: {
  from: string
  fromLabel?: string
  onChangeFrom: (value: string) => void
  onChangeTo: (value: string) => void
  to: string
  toLabel?: string
}) {
  const responsive = useResponsiveLayout()
  return (
    <View style={[styles.dateGroup, responsive.isMobile ? styles.dateGroupMobile : null]}>
      <AdminDateField label={fromLabel} value={from} onChange={onChangeFrom} />
      <AdminDateField label={toLabel} value={to} onChange={onChangeTo} />
    </View>
  )
}

export function AdminDateField({ label, minWidth, onChange, value }: { label: string; minWidth?: number; onChange: (value: string) => void; value: string }) {
  const { tokens } = useAppTheme()
  const { locale } = useI18n()
  const selectedDate = useMemo(() => parseAdminDate(value), [value])
  const [visible, setVisible] = useState(false)
  const [month, setMonth] = useState(selectedDate || new Date())
  const formatted = selectedDate
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(selectedDate)
    : 'Sin límite'

  const selectDate = (date: Date) => {
    onChange(formatAdminDateInput(date))
    setVisible(false)
  }

  return (
    <View style={[styles.dateField, minWidth !== undefined ? { minWidth } : null]}>
      <Text style={[styles.fieldLabel, { color: tokens.text.muted }]}>{label}</Text>
      <AppPressable
        accessibilityLabel={`Fecha ${label.toLowerCase()}`}
        accessibilityHint="Abre un calendario para elegir la fecha"
        accessibilityState={{ expanded: visible }}
        onPress={() => { setMonth(selectedDate || new Date()); setVisible(true) }}
        style={({ pressed }) => [styles.dateInputShell, { backgroundColor: tokens.surface.interactive, borderColor: tokens.border.default, opacity: pressed ? 0.82 : 1 }]}
      >
        <Ionicons name="calendar-outline" size={18} color={tokens.brand.admin} />
        <Text numberOfLines={1} style={[styles.dateValue, { color: selectedDate ? tokens.text.primary : tokens.text.muted }]}>{formatted}</Text>
        <Ionicons name="chevron-down" size={17} color={tokens.text.muted} />
      </AppPressable>
      <AppBottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title={`Fecha ${label.toLowerCase()}`}
        description="Selecciona un día en el calendario."
        footer={<View className="flex-row flex-wrap justify-end gap-2"><AdminButton label="Limpiar" icon="close-circle-outline" variant="ghost" onPress={() => { onChange(''); setVisible(false) }} /><AdminButton label="Cancelar" variant="secondary" onPress={() => setVisible(false)} /></View>}
      >
        <DateCalendar month={month} selectedDate={selectedDate} onMonthChange={setMonth} onSelectDate={selectDate} subtitle="Selecciona un día" locale={locale} minimumDate={null} selectionColor={tokens.brand.admin} />
      </AppBottomSheet>
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
    if (createdFrom) values.push({ key: 'from', label: `Alta desde: ${createdFrom}`, clear: () => onChangeCreatedFrom('') })
    if (createdTo) values.push({ key: 'to', label: `Alta hasta: ${createdTo}`, clear: () => onChangeCreatedTo('') })
    return values
  }, [accountStatus, activityState, classroomId, classroomOptions, courseId, courseOptions, createdFrom, createdTo, onChangeAccountStatus, onChangeActivityState, onChangeClassroomId, onChangeCourseId, onChangeCreatedFrom, onChangeCreatedTo])

  const sharedFields = (mobile: boolean) => <>
    <AdminFilterSelect label="Estado de cuenta" icon="shield-checkmark-outline" value={accountStatus} onChange={onChangeAccountStatus} options={PROFILE_ACCOUNT_OPTIONS} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Actividad" icon="pulse-outline" value={activityState} onChange={onChangeActivityState} options={PROFILE_ACTIVITY_OPTIONS} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Curso" icon="book-outline" value={courseId} onChange={onChangeCourseId} options={courseOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Clase" icon="albums-outline" value={classroomId} onChange={onChangeClassroomId} options={classroomOptions} minWidth={mobile ? 0 : 180} />
    <AdminDateRangeFields from={createdFrom} to={createdTo} fromLabel="Alta desde" toLabel="Alta hasta" onChangeFrom={onChangeCreatedFrom} onChangeTo={onChangeCreatedTo} />
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

function parseAdminDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null
  return date
}

function formatAdminDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  dateValue: {
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
  mobileAction,
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
  mobileAction?: React.ReactNode
  onChangeActiveState: (value: string) => void
  onChangeArchivedState: (value: string) => void
  onChangeCreatedFrom: (value: string) => void
  onChangeCreatedTo: (value: string) => void
  onChangeTeacherId: (value: string) => void
  teacherId: string
}) {
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const teacherOptions = useMemo(() => [{ value: '', label: 'Todos los profesores' }, ...directory.teachers.map((teacher) => ({ value: teacher.id, label: teacher.alias, subtitle: teacher.email || undefined }))], [directory.teachers])
  const activeOptions = useMemo(() => [{ value: 'all', label: 'Activos e inactivos' }, { value: 'active', label: 'Solo activos' }, { value: 'inactive', label: 'Solo inactivos' }], [])
  const archiveOptions = useMemo(() => [{ value: 'all', label: 'Todos' }, { value: 'current', label: 'No archivados' }, { value: 'archived', label: 'Archivados' }], [])
  const activeFilters = useMemo(() => {
    const values: { key: string; label: string; clear: () => void }[] = []
    if (teacherId) values.push({ key: 'teacher', label: `Profesor: ${teacherOptions.find((item) => item.value === teacherId)?.label || teacherId}`, clear: () => onChangeTeacherId('') })
    if (activeState !== 'all') values.push({ key: 'status', label: `Estado: ${activeOptions.find((item) => item.value === activeState)?.label || activeState}`, clear: () => onChangeActiveState('all') })
    if (archivedState !== 'all') values.push({ key: 'archive', label: `Archivo: ${archiveOptions.find((item) => item.value === archivedState)?.label || archivedState}`, clear: () => onChangeArchivedState('all') })
    if (createdFrom) values.push({ key: 'from', label: `Creación desde: ${createdFrom}`, clear: () => onChangeCreatedFrom('') })
    if (createdTo) values.push({ key: 'to', label: `Creación hasta: ${createdTo}`, clear: () => onChangeCreatedTo('') })
    return values
  }, [activeOptions, activeState, archiveOptions, archivedState, createdFrom, createdTo, onChangeActiveState, onChangeArchivedState, onChangeCreatedFrom, onChangeCreatedTo, onChangeTeacherId, teacherId, teacherOptions])
  const fields = (mobile: boolean) => <>
    <AdminFilterSelect label="Profesor propietario" icon="school-outline" value={teacherId} onChange={onChangeTeacherId} options={teacherOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Estado" icon="power-outline" value={activeState} onChange={onChangeActiveState} options={activeOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Archivo" icon="archive-outline" value={archivedState} onChange={onChangeArchivedState} options={archiveOptions} minWidth={mobile ? 0 : 180} />
    <View style={{ width: mobile ? '100%' : undefined, minWidth: mobile ? 0 : 300, flexGrow: 1 }}><Text style={[styles.fieldLabel, { color: tokens.text.muted }]}>Fecha de creación</Text><AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={onChangeCreatedFrom} onChangeTo={onChangeCreatedTo} /></View>
  </>
  if (!responsive.isMobile) return <View style={styles.filterGrid}>{fields(false)}</View>
  return <AdminMobileFilterShell activeFilters={activeFilters} mobileAction={mobileAction} open={mobileOpen} setOpen={setMobileOpen} description="Refina el listado de cursos sin perder espacio en la vista principal.">{fields(true)}</AdminMobileFilterShell>
}

export function AdminClassroomSupervisionFilters({
  activeState,
  courseId,
  createdFrom,
  createdTo,
  directory,
  mobileAction,
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
  mobileAction?: React.ReactNode
  onChangeActiveState: (value: string) => void
  onChangeCourseId: (value: string) => void
  onChangeCreatedFrom: (value: string) => void
  onChangeCreatedTo: (value: string) => void
  onChangeTeacherId: (value: string) => void
  teacherId: string
}) {
  const responsive = useResponsiveLayout()
  const { tokens } = useAppTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const teacherOptions = useMemo(() => [{ value: '', label: 'Todos los profesores' }, ...directory.teachers.map((teacher) => ({ value: teacher.id, label: teacher.alias, subtitle: teacher.email || undefined }))], [directory.teachers])
  const courseOptions = useMemo(() => [{ value: '', label: 'Todos los cursos' }, ...directory.courses.filter((course) => !teacherId || course.teacher_id === teacherId).map((course) => ({ value: String(course.id), label: course.name }))], [directory.courses, teacherId])
  const activeOptions = useMemo(() => [{ value: 'all', label: 'Activas e inactivas' }, { value: 'active', label: 'Solo activas' }, { value: 'inactive', label: 'Solo inactivas' }], [])
  useEffect(() => { if (courseId && !courseOptions.some((course) => course.value === courseId)) onChangeCourseId('') }, [courseId, courseOptions, onChangeCourseId])
  const activeFilters = useMemo(() => {
    const values: { key: string; label: string; clear: () => void }[] = []
    if (teacherId) values.push({ key: 'teacher', label: `Profesor: ${teacherOptions.find((item) => item.value === teacherId)?.label || teacherId}`, clear: () => onChangeTeacherId('') })
    if (courseId) values.push({ key: 'course', label: `Curso: ${courseOptions.find((item) => item.value === courseId)?.label || courseId}`, clear: () => onChangeCourseId('') })
    if (activeState !== 'all') values.push({ key: 'status', label: `Estado: ${activeOptions.find((item) => item.value === activeState)?.label || activeState}`, clear: () => onChangeActiveState('all') })
    if (createdFrom) values.push({ key: 'from', label: `Creación desde: ${createdFrom}`, clear: () => onChangeCreatedFrom('') })
    if (createdTo) values.push({ key: 'to', label: `Creación hasta: ${createdTo}`, clear: () => onChangeCreatedTo('') })
    return values
  }, [activeOptions, activeState, courseId, courseOptions, createdFrom, createdTo, onChangeActiveState, onChangeCourseId, onChangeCreatedFrom, onChangeCreatedTo, onChangeTeacherId, teacherId, teacherOptions])
  const fields = (mobile: boolean) => <>
    <AdminFilterSelect label="Profesor propietario" icon="school-outline" value={teacherId} onChange={onChangeTeacherId} options={teacherOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Curso" icon="book-outline" value={courseId} onChange={onChangeCourseId} options={courseOptions} minWidth={mobile ? 0 : 180} />
    <AdminFilterSelect label="Estado" icon="power-outline" value={activeState} onChange={onChangeActiveState} options={activeOptions} minWidth={mobile ? 0 : 180} />
    <View style={{ width: mobile ? '100%' : undefined, minWidth: mobile ? 0 : 300, flexGrow: 1 }}><Text style={[styles.fieldLabel, { color: tokens.text.muted }]}>Fecha de creación</Text><AdminDateRangeFields from={createdFrom} to={createdTo} onChangeFrom={onChangeCreatedFrom} onChangeTo={onChangeCreatedTo} /></View>
  </>
  if (!responsive.isMobile) return <View style={styles.filterGrid}>{fields(false)}</View>
  return <AdminMobileFilterShell activeFilters={activeFilters} mobileAction={mobileAction} open={mobileOpen} setOpen={setMobileOpen} description="Refina el listado de clases sin perder espacio en la vista principal.">{fields(true)}</AdminMobileFilterShell>
}

export function AdminMobileFilterShell({ actionFirst = false, activeFilters, applyLabel = 'Ver resultados', children, description, mobileAction, onClear, open, setOpen }: { actionFirst?: boolean; activeFilters: { key: string; label: string; clear: () => void }[]; applyLabel?: string; children: React.ReactNode; description: string; mobileAction?: React.ReactNode; onClear?: () => void; open: boolean; setOpen: (value: boolean) => void }) {
  const { tokens } = useAppTheme()
  const filterButton = <View style={{ flex: 1 }}><AdminButton label={activeFilters.length > 0 ? `Filtros (${activeFilters.length})` : 'Filtros'} icon="options-outline" variant="secondary" fullWidth onPress={() => setOpen(true)} /></View>
  const footer = onClear ? <View className="flex-row gap-2"><View className="flex-1"><AdminButton label="Limpiar" icon="refresh-outline" variant="secondary" fullWidth onPress={onClear} /></View><View className="flex-1"><AdminButton label={applyLabel} icon="checkmark" fullWidth onPress={() => setOpen(false)} /></View></View> : <AdminButton label={applyLabel} icon="checkmark" fullWidth onPress={() => setOpen(false)} />
  return <View style={styles.mobileFilters}>
    <View style={styles.mobileFilterActions}>{actionFirst ? mobileAction : filterButton}{actionFirst ? filterButton : mobileAction}</View>
    {activeFilters.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilterChips}>{activeFilters.map((filter) => <AppPressable key={filter.key} accessibilityLabel={`Quitar ${filter.label}`} onPress={filter.clear} style={({ pressed }) => ({ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, backgroundColor: withAlpha(tokens.brand.admin, '18'), borderColor: withAlpha(tokens.brand.admin, '70'), opacity: pressed ? 0.76 : 1 })}><Text numberOfLines={1} style={{ maxWidth: 220, color: tokens.text.primary, fontSize: 11, fontWeight: '800' }}>{filter.label}</Text><Ionicons name="close" size={14} color={tokens.brand.admin} /></AppPressable>)}</ScrollView> : null}
    <AppBottomSheet visible={open} onClose={() => setOpen(false)} title="Filtros" description={description} footer={footer}><View style={styles.mobileFilterStack}>{children}</View></AppBottomSheet>
  </View>
}
