import React, { useState } from 'react'
import AdminButton from './AdminButton'
import AdminProfileAvatar from './AdminProfileAvatar'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import { AppDropdown, AppMenu } from '../../ui'
import { useAppTheme } from '../../../lib/appTheme'
import { withAlpha } from '../../../lib/color'
import { useResponsiveLayout } from '../../../lib/responsive'
import type {
  AdminSupportTicketRow,
  ClassroomRow,
  IconName,
  ProfileRow,
  RowAction,
  SubjectRow,
} from '../types/admin'
import {
  formatAdminDate,
  formatAuditDate,
  getSupportPriorityLabel,
  getSupportStatusLabel,
} from '../utils/adminUtils'

export function Panel({ children, className = '', compact = false, icon, title }: {
  children: React.ReactNode
  className?: string
  compact?: boolean
  icon: IconName
  title: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View className={`rounded-2xl border border-border-default bg-surface-default ${compact ? 'p-4' : 'p-5'} ${className}`}>
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(tokens.brand.admin, '18') }}>
          <Ionicons name={icon} size={20} color={tokens.brand.admin} />
        </View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[18px] font-black text-text-primary">{title}</Text>
      </View>
      {children}
    </View>
  )
}

export function AdminMetric({ color, compact = false, icon, label, value, width }: {
  color: string
  compact?: boolean
  icon: IconName
  label: string
  value: string
  width?: number
}) {
  return <MobileMetricCard className={compact ? '' : 'min-w-[160px] flex-1'} color={color} compact={compact} icon={icon} title={label} value={value} width={width} />
}

export function AdminInput({ autoCapitalize, label, onChangeText, placeholder, value }: {
  autoCapitalize?: 'none'
  label: string
  onChangeText: (value: string) => void
  placeholder: string
  value: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View className="min-w-[210px] flex-1">
      <Text className="mb-2 text-[12px] font-bold text-text-secondary">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        placeholder={placeholder}
        placeholderTextColor={tokens.text.muted}
        className="h-12 rounded-xl border border-border-default bg-surface-default px-4 text-text-primary"
      />
    </View>
  )
}

export function AdminSearch({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const { tokens } = useAppTheme()
  return (
    <View className="h-12 flex-row items-center rounded-xl border border-border-default bg-surface-default px-4">
      <TextInput accessibilityLabel={placeholder} className="min-w-0 flex-1 text-text-primary" value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={tokens.text.muted} />
      <Ionicons name="search-outline" size={19} color={tokens.brand.admin} />
    </View>
  )
}

export function AdminListToolbar({ exporting, onChangeSearch, onExport, placeholder, search, exportLabel = 'Exportar CSV' }: {
  exporting: boolean
  onChangeSearch: (value: string) => void
  onExport?: () => void
  placeholder: string
  search: string
  exportLabel?: string
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-3">
      <View className="min-w-[240px] flex-1"><AdminSearch value={search} onChangeText={onChangeSearch} placeholder={placeholder} /></View>
      {onExport ? <AdminButton label={exporting ? 'Preparando...' : exportLabel} accessibilityLabel={exportLabel} icon="download-outline" variant="secondary" loading={exporting} disabled={exporting} onPress={onExport} /> : null}
    </View>
  )
}

export function AdminFilterRow({ label, onChange, options, value }: {
  label: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  value: string
}) {
  return <AppDropdown label={label} value={value} options={options} onChange={onChange} accessibilityLabel={`Filtrar por ${label}`} />
}

export function AdminChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { tokens } = useAppTheme()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Aplica este filtro" accessibilityState={{ selected: active }} onPress={onPress} className="min-h-10 items-center justify-center rounded-xl border px-3 py-2" style={({ pressed }) => ({ borderColor: active ? withAlpha(tokens.brand.admin, 'A0') : tokens.border.default, backgroundColor: active ? withAlpha(tokens.brand.admin, '18') : tokens.surface.default, opacity: pressed ? 0.78 : 1 })}>
      <Text className="text-[12px] font-black" style={{ color: active ? tokens.text.primary : tokens.text.secondary }}>{label}</Text>
    </Pressable>
  )
}

export function SelectableCardShell({ children, compact = false, selected = false, onToggleSelected, selectionLabel }: {
  children: React.ReactNode
  compact?: boolean
  selected?: boolean
  onToggleSelected?: () => void
  selectionLabel: string
}) {
  const { tokens } = useAppTheme()
  return (
    <View className={`rounded-xl border ${compact ? 'p-3' : 'p-4'}`} style={{ borderColor: selected ? withAlpha(tokens.brand.admin, 'A0') : tokens.border.default, backgroundColor: selected ? withAlpha(tokens.brand.admin, '0D') : tokens.surface.default }}>
      {onToggleSelected ? (
        <Pressable accessibilityRole="checkbox" accessibilityLabel={selectionLabel} accessibilityState={{ checked: selected }} onPress={onToggleSelected} className={`${compact ? 'mb-2' : 'mb-3'} flex-row items-center gap-2 self-start rounded-lg px-2 py-1`} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
          <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={20} color={selected ? tokens.brand.admin : tokens.text.muted} />
          <Text className="text-[12px] font-bold text-text-secondary">{selected ? 'Seleccionado' : 'Seleccionar'}</Text>
        </Pressable>
      ) : null}
      {children}
    </View>
  )
}

export function ProfileRowCard({ actions, meta, profile, selected, onToggleSelected }: {
  actions: RowAction[]
  meta: string
  profile: ProfileRow
  selected?: boolean
  onToggleSelected?: () => void
}) {
  const responsive = useResponsiveLayout()
  const roleLabel = profile.role_id === 'teacher' ? 'Profesor' : profile.role_id === 'admin' ? 'Administrador' : profile.role_id === 'guest' ? 'Invitado' : 'Alumno'
  const activityLabel = profile.last_activity_at ? `Última actividad: ${formatAdminDate(profile.last_activity_at)}` : 'Sin actividad registrada'
  const securityLabel = profile.security_status === 'secure' ? 'Cuenta sin alertas' : profile.security_status === 'inactive' ? 'Cuenta inactiva' : profile.security_status === 'locked' ? 'Acceso bloqueado' : profile.security_status === 'unverified' ? 'Correo sin verificar' : profile.security_status === 'never_signed_in' ? 'Sin primer acceso' : 'Seguridad por revisar'
  const compact = responsive.isDesktop
  return (
    <SelectableCardShell compact={compact} selected={selected} onToggleSelected={onToggleSelected} selectionLabel={`Seleccionar ${profile.alias}`}>
      <View className={`flex-row flex-wrap items-center ${compact ? 'gap-3' : 'gap-4'}`}>
        <AdminProfileAvatar alias={profile.alias} avatar={profile.avatar} size={compact ? 44 : 48} />
        <View className="min-w-[220px] flex-1">
          <Text className="font-black text-text-primary">{profile.alias}</Text>
          <Text className="mt-1 text-[12px] text-text-muted">{profile.email || 'Sin correo guardado'}</Text>
        </View>
        <StatusPill active={profile.active !== false} />
      </View>
      <View className={`${compact ? 'mt-2' : 'mt-3'} flex-row flex-wrap gap-2`}>
        <MiniPill icon={profile.role_id === 'teacher' ? 'school-outline' : profile.role_id === 'guest' ? 'person-circle-outline' : 'person-outline'} label={roleLabel} />
        <MiniPill icon="layers-outline" label={meta} />
        <MiniPill icon="time-outline" label={activityLabel} />
        {profile.last_sign_in_at ? <MiniPill icon="log-in-outline" label={`Último acceso: ${formatAdminDate(profile.last_sign_in_at)}`} /> : null}
        <MiniPill icon={profile.security_status === 'secure' ? 'shield-checkmark-outline' : profile.security_status === 'locked' ? 'lock-closed-outline' : 'shield-outline'} label={securityLabel} />
        {(profile.mfa_factor_count || 0) > 0 ? <MiniPill icon="key-outline" label={`${profile.mfa_factor_count} factor(es) MFA`} /> : null}
        {profile.role_id === 'admin' && profile.admin_role_name ? <MiniPill icon="key-outline" label={profile.admin_role_name} /> : null}
      </View>
      {profile.active === false ? (
        <View className="mt-3 rounded-xl border border-border-default bg-surface-interactive p-3">
          <Text className="text-[12px] font-black text-text-primary">Motivo: {profile.deactivation_reason || 'No indicado'}</Text>
          <Text className="mt-1 text-[11px] text-text-muted">Reactivación prevista: {formatAdminDate(profile.reactivate_at)}</Text>
        </View>
      ) : null}
      <RowActions actions={actions} />
    </SelectableCardShell>
  )
}

export function CourseRowCard({ actions, classesCount, enrollmentsCount, subject, teacher, selected, onToggleSelected }: {
  actions: RowAction[]
  classesCount: number
  enrollmentsCount: number
  subject: SubjectRow
  teacher?: ProfileRow
  selected?: boolean
  onToggleSelected?: () => void
}) {
  const incidentCount = subject.incidents_count ?? 0
  const statusLabel = subject.is_archived ? 'Archivado' : subject.active === false ? 'Inactivo' : 'Activo'
  return (
    <SelectableCardShell selected={selected} onToggleSelected={onToggleSelected} selectionLabel={`Seleccionar curso ${subject.name}`}>
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[240px] flex-1">
          <Text className="font-black text-text-primary">{subject.name}</Text>
          <Text className="mt-1 text-[12px] text-text-muted">Profesor propietario: {teacher?.alias || subject.teacher_alias || 'Sin asignar'}</Text>
          {teacher?.email || subject.teacher_email ? <Text className="mt-1 text-[11px] text-text-muted">{teacher?.email || subject.teacher_email}</Text> : null}
        </View>
        <StatusPill active={subject.active !== false && !subject.is_archived} label={statusLabel} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon="albums-outline" label={`${classesCount} clase(s)`} />
        <MiniPill icon="people-outline" label={`${enrollmentsCount} alumno(s)`} />
        <MiniPill icon="time-outline" label={subject.last_activity_at ? `Última actividad ${formatAuditDate(subject.last_activity_at)}` : 'Sin actividad'} />
        <MiniPill icon={incidentCount > 0 ? 'warning-outline' : 'checkmark-circle-outline'} label={`${incidentCount} incidencia(s)`} />
        {subject.orphaned ? <MiniPill icon="person-remove-outline" label="Curso sin profesor" /> : null}
        {(subject.duplicate_code_count || 0) > 0 ? <MiniPill icon="copy-outline" label={`${subject.duplicate_code_count} código(s) duplicado(s)`} /> : null}
        {(subject.expired_code_count || 0) > 0 ? <MiniPill icon="hourglass-outline" label={`${subject.expired_code_count} código(s) caducado(s)`} /> : null}
      </View>
      {subject.is_archived ? (
        <View className="mt-3 rounded-xl border border-border-default bg-surface-interactive p-3">
          <Text className="text-[12px] font-black text-text-primary">Motivo de archivo: {subject.archive_reason || 'No indicado'}</Text>
          <Text className="mt-1 text-[11px] text-text-muted">Conservación hasta {formatAdminDate(subject.retention_until)}. Eliminación solo tras la retención y mediante confirmación explícita.</Text>
        </View>
      ) : null}
      {incidentCount > 0 ? <Text className="mt-3 text-[11px] leading-4 text-gamification-xp">{subject.pending_reviews_count || 0} revisiones pendientes · {subject.inactive_classrooms_count || 0} clases inactivas · {subject.missing_code_count || 0} clases sin código</Text> : null}
      <RowActions actions={actions} />
    </SelectableCardShell>
  )
}

export function ClassroomRowCard({ actions, classroom, enrollmentsCount, subject, selected, onToggleSelected }: {
  actions: RowAction[]
  classroom: ClassroomRow
  enrollmentsCount: number
  subject?: SubjectRow
  selected?: boolean
  onToggleSelected?: () => void
}) {
  const { tokens } = useAppTheme()
  const incidentCount = classroom.incidents_count ?? 0
  const codeLabel = classroom.code_status === 'duplicate' ? 'Código duplicado' : classroom.code_status === 'expired' ? 'Código caducado' : classroom.code_status === 'missing' ? 'Sin código' : 'Código válido'
  return (
    <SelectableCardShell selected={selected} onToggleSelected={onToggleSelected} selectionLabel={`Seleccionar clase ${classroom.name}`}>
      <View className="flex-row flex-wrap items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-selected"><Ionicons name="albums-outline" size={22} color={tokens.brand.admin} /></View>
        <View className="min-w-[240px] flex-1">
          <Text className="font-black text-text-primary">{classroom.name}</Text>
          <Text className="mt-1 text-[12px] text-text-muted">{subject?.name || classroom.subject_name || 'Curso no disponible'}</Text>
          <Text className="mt-1 text-[11px] text-text-muted">Profesor propietario: {classroom.teacher_alias || 'Sin asignar'}</Text>
        </View>
        {classroom.code ? <Text className="rounded-lg bg-surface-interactive px-3 py-2 font-mono text-[12px] font-black text-semantic-info">{classroom.code}</Text> : null}
        <StatusPill active={classroom.active !== false} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon="people-outline" label={`${enrollmentsCount} alumno(s)`} />
        <MiniPill icon="time-outline" label={classroom.last_activity_at ? `Última actividad ${formatAuditDate(classroom.last_activity_at)}` : 'Sin actividad'} />
        <MiniPill icon={incidentCount > 0 ? 'warning-outline' : 'checkmark-circle-outline'} label={`${incidentCount} incidencia(s)`} />
        <MiniPill icon={classroom.code_status === 'valid' ? 'key-outline' : 'alert-circle-outline'} label={codeLabel} />
      </View>
      {classroom.active === false && classroom.deactivation_reason ? <Text className="mt-3 text-[11px] text-text-muted">Motivo de desactivación: {classroom.deactivation_reason}</Text> : null}
      {incidentCount > 0 ? <Text className="mt-3 text-[11px] leading-4 text-gamification-xp">{classroom.pending_reviews_count || 0} revisiones pendientes{classroom.code ? '' : ' · clase sin código'}{classroom.active === false ? ' · clase inactiva' : ''}</Text> : null}
      <RowActions actions={actions} />
    </SelectableCardShell>
  )
}

export function SupportTicketCard({ ticket, onManage }: { ticket: AdminSupportTicketRow; onManage: () => void }) {
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[220px] flex-1">
          <View className="flex-row flex-wrap items-center gap-2"><SupportStatusPill status={ticket.status} /><SupportPriorityPill priority={ticket.priority} /></View>
          <Text className="mt-3 text-[16px] font-black text-text-primary">{ticket.subject}</Text>
          <Text className="mt-1 text-[12px] font-semibold text-text-muted">{ticket.user_alias || 'Usuario'} · {ticket.role === 'teacher' ? 'Profesor' : 'Alumno'} · {formatAuditDate(ticket.created_at)}</Text>
        </View>
        <Pressable accessibilityLabel={`Gestionar ticket ${ticket.subject}`} accessibilityHint="Abre las opciones de respuesta y estado del ticket" accessibilityRole="button" onPress={onManage} className="h-10 flex-row items-center gap-2 rounded-xl bg-brand-admin px-4" style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name="create-outline" size={16} color="#FFFFFF" /><Text className="text-[12px] font-black text-white">Gestionar</Text>
        </Pressable>
      </View>
      <Text className="mt-3 text-[13px] leading-5 text-text-secondary" numberOfLines={3}>{ticket.message}</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        <MiniPill icon="chatbubbles-outline" label={`${ticket.message_count || 0} mensajes`} />
        {ticket.attachment_count > 0 ? <MiniPill icon="attach-outline" label={`${ticket.attachment_count} adjuntos`} /> : null}
        {!ticket.first_responded_at && ticket.first_response_due_at ? <MiniPill icon="timer-outline" label={`Respuesta antes de ${formatAuditDate(ticket.first_response_due_at)}`} /> : null}
      </View>
      {ticket.admin_response ? <View className="mt-3 rounded-xl border border-border-active bg-semantic-surface-info p-3"><Text className="text-[11px] font-black uppercase tracking-[0.6px] text-semantic-info">Última respuesta</Text><Text className="mt-1 text-[12px] leading-5 text-text-secondary" numberOfLines={2}>{ticket.admin_response}</Text></View> : null}
    </View>
  )
}

export function SupportStatusPill({ status }: { status: AdminSupportTicketRow['status'] }) {
  const { tokens } = useAppTheme()
  const meta = { open: { bg: tokens.semanticSurface.danger, color: tokens.semantic.danger }, in_progress: { bg: tokens.semanticSurface.warning, color: tokens.semantic.warning }, resolved: { bg: tokens.semanticSurface.success, color: tokens.semantic.success }, closed: { bg: tokens.surface.interactive, color: tokens.text.secondary } }[status]
  return <View className="rounded-full px-3 py-1" style={{ backgroundColor: meta.bg }}><Text className="text-[11px] font-black" style={{ color: meta.color }}>{getSupportStatusLabel(status)}</Text></View>
}

export function SupportPriorityPill({ priority }: { priority: AdminSupportTicketRow['priority'] }) {
  const { tokens } = useAppTheme()
  const meta = { high: { bg: tokens.semanticSurface.danger, color: tokens.semantic.danger }, medium: { bg: tokens.semanticSurface.warning, color: tokens.semantic.warning }, low: { bg: tokens.semanticSurface.info, color: tokens.semantic.info } }[priority]
  return <View className="rounded-full px-3 py-1" style={{ backgroundColor: meta.bg }}><Text className="text-[11px] font-black" style={{ color: meta.color }}>Prioridad {getSupportPriorityLabel(priority).toLowerCase()}</Text></View>
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const menuItems = actions.map((action, index) => ({ key: `${action.label}-${index}`, label: action.label, icon: action.icon, destructive: action.destructive, disabled: action.disabled, onPress: action.onPress }))
  return (
    <View className="mt-4 items-start">
      <AdminButton label="Acciones" icon="ellipsis-horizontal" variant="secondary" size="sm" onPress={() => setOpen(true)} />
      <AppMenu visible={open} onClose={() => setOpen(false)} title="Acciones disponibles" items={menuItems} />
    </View>
  )
}

export function StatusPill({ active, label }: { active: boolean; label?: string }) {
  const { tokens } = useAppTheme()
  const resolvedLabel = label || (active ? 'Activo' : 'Inactivo')
  return <View className="rounded-full px-3 py-1" style={{ backgroundColor: active ? tokens.semanticSurface.success : tokens.semanticSurface.danger }}><Text className="text-[12px] font-black" style={{ color: active ? tokens.semantic.success : tokens.semantic.danger }}>{resolvedLabel}</Text></View>
}

export function MiniPill({ icon, label }: { icon: IconName; label: string }) {
  const { tokens } = useAppTheme()
  return <View className="flex-row items-center gap-2 rounded-lg border border-border-default bg-surface-default px-3 py-2"><Ionicons name={icon} size={14} color={tokens.text.secondary} /><Text className="text-[12px] font-semibold text-text-secondary">{label}</Text></View>
}

export function SideFact({ label, value }: { label: string; value: string }) {
  return <View className="flex-row items-center justify-between border-b border-border-subtle py-3"><Text className="text-[13px] font-semibold text-text-secondary">{label}</Text><Text className="font-black text-text-primary">{value}</Text></View>
}

export function SystemAlertRow({ color, icon, label, value }: { color: string; icon: IconName; label: string; value: number }) {
  return <View className="flex-row items-center justify-between border-b border-border-subtle py-3"><View className="min-w-0 flex-1 flex-row items-center gap-3"><View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}24` }}><Ionicons name={icon} size={17} color={color} /></View><Text className="min-w-0 flex-1 text-[13px] font-semibold text-text-secondary">{label}</Text></View><Text className="text-[18px] font-black text-text-primary">{value}</Text></View>
}

export function EmptyState({ label }: { label: string }) {
  const { tokens } = useAppTheme()
  return <View className="items-center rounded-xl border border-dashed border-border-default bg-surface-default p-8"><Ionicons name="search-outline" size={34} color={tokens.text.muted} /><Text className="mt-3 text-center font-bold text-text-secondary">{label}</Text></View>
}

export function ListLoadingState() {
  const { tokens } = useAppTheme()
  return <View className="items-center rounded-xl border border-border-default bg-surface-default p-5"><ActivityIndicator color={tokens.brand.admin} /><Text className="mt-3 text-[13px] font-semibold text-text-muted">Cargando página...</Text></View>
}

export function AdminPaginationControls({ hasNext, hasPrevious, onNext, onPrevious, page, pageSize, total }: {
  hasNext: boolean
  hasPrevious: boolean
  onNext: () => void
  onPrevious: () => void
  page: number
  pageSize: number
  total: number
}) {
  const firstItem = total === 0 ? 0 : page * pageSize + 1
  const lastItem = Math.min(total, (page + 1) * pageSize)
  return (
    <View className="mt-4 flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-default px-4 py-3">
      <Text className="text-[12px] font-semibold text-text-secondary">{total === 0 ? 'Sin resultados' : `${firstItem}-${lastItem} de ${total}`}</Text>
      <View className="flex-row items-center gap-2">
        <AdminButton label="Anterior" accessibilityLabel="Página anterior" icon="chevron-back" size="sm" variant="secondary" disabled={!hasPrevious} onPress={onPrevious} />
        <AdminButton label="Siguiente" accessibilityLabel="Página siguiente" icon="chevron-forward" iconPosition="right" size="sm" disabled={!hasNext} onPress={onNext} />
      </View>
    </View>
  )
}

export function HomeShortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { tokens } = useAppTheme()
  const responsive = useResponsiveLayout()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={`${responsive.isDesktop ? 'flex-row items-center gap-3' : ''} rounded-2xl border border-border-default bg-surface-default p-4`} style={({ pressed }) => ({ flexBasis: responsive.isDesktop ? '15%' : '47%', flexGrow: 1, minWidth: responsive.isDesktop ? 145 : 0, minHeight: 76, opacity: pressed ? 0.8 : 1 })}>
      {responsive.isDesktop ? <><View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-selected"><Ionicons name={icon} size={21} color={tokens.brand.admin} /></View><Text numberOfLines={2} className="min-w-0 flex-1 font-black text-text-primary" style={{ flexShrink: 1 }}>{label}</Text><Ionicons name="chevron-forward" size={18} color={tokens.text.muted} /></> : <><View className="flex-row items-center justify-between"><View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-selected"><Ionicons name={icon} size={20} color={tokens.brand.admin} /></View><Ionicons name="chevron-forward" size={17} color={tokens.text.muted} /></View><Text numberOfLines={2} className="mt-3 font-black text-text-primary">{label}</Text></>}
    </Pressable>
  )
}
