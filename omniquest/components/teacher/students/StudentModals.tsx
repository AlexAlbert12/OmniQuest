import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ConfirmDialog, IconName, StudentRow } from './types';
import { formatDate, formatRelativeDate, getStatusMeta } from './studentUtils';
import AppConfirmModal from '../../AppConfirmModal';
import { useResponsiveLayout } from '../../../lib/responsive';
import { withAlpha } from '../../../lib/color';
import { useAppTheme } from '../../../lib/appTheme'
import { getStudentAttemptEvaluationState } from '../../../lib/studentAttemptEvaluation';

export function StudentActionsModal({
  student,
  visible,
  reminderBusy,
  onClose,
  onViewDetails,
  onViewHistory,
  onRemoveFromClass,
  onResetProgress,
  onSendReminder,
  onRequestPasswordRecovery,
  onAssignActivity,
}: {
  student: StudentRow | null
  visible: boolean
  reminderBusy: boolean
  onClose: () => void
  onViewDetails: (student: StudentRow) => void
  onViewHistory: (student: StudentRow) => void
  onRemoveFromClass: (student: StudentRow) => void
  onResetProgress: (student: StudentRow) => void
  onSendReminder: (student: StudentRow) => void
  onRequestPasswordRecovery: (student: StudentRow) => void
  onAssignActivity: (student: StudentRow) => void
}) {
  const responsive = useResponsiveLayout();
  const isPhone = responsive.isMobile;

  if (!student) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className={`flex-1 ${isPhone ? 'justify-end' : 'justify-center p-4 md:items-center'}`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar acciones del estudiante" accessibilityHint="Cierra el diálogo" className="absolute inset-0" onPress={onClose} />
        <View accessibilityViewIsModal accessibilityLabel={`Acciones de ${student.alias}`} className={`${isPhone ? 'max-h-[92%] w-full rounded-t-3xl p-5' : 'max-h-[90%] w-full max-w-[420px] rounded-2xl p-5'} border border-border-default bg-surface-default`}>
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-semibold text-semantic-info">Acciones del estudiante</Text>
              <Text accessibilityRole="header" className="mt-1 text-[24px] font-black text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{student.alias}</Text>
              <Text className="mt-1 text-[12px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>{student.handle}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar acciones" accessibilityHint="Cierra el diálogo" onPress={onClose} className="min-h-10 min-w-10 items-center justify-center rounded-xl border border-border-default bg-surface-raised">
              <Ionicons name="close" size={18} color="#DDE7F4" />
            </Pressable>
          </View>

          <ScrollView
            className="mt-5"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <ModalActionButton
              icon="document-text-outline"
              title="Ver detalle"
              detail="Resumen, cursos, áreas a reforzar y últimos intentos"
              onPress={() => onViewDetails(student)}
            />
            <ModalActionButton
              icon="time-outline"
              title="Historial completo"
              detail="Evolución, errores y acciones docentes"
              onPress={() => onViewHistory(student)}
            />
            {student.status === 'no_activity' ? (
              <>
                <ModalActionButton
                  icon="mail-outline"
                  title={reminderBusy ? 'Enviando recordatorio...' : 'Enviar recordatorio'}
                  detail="Avisar al alumno para que haga su primer acceso"
                  onPress={() => onSendReminder(student)}
                />
                <ModalActionButton
                  icon="key-outline"
                  title={reminderBusy ? 'Enviando enlace...' : 'Recuperar acceso'}
                  detail="Envía un enlace de un solo uso que caduca en 30 minutos"
                  onPress={() => onRequestPasswordRecovery(student)}
                />
              </>
            ) : null}
            <ModalActionButton
              icon="add-circle-outline"
              title="Asignar repaso"
              detail="Crear una pregunta o actividad de refuerzo"
              onPress={() => onAssignActivity(student)}
            />
            <ModalActionButton
              icon="refresh-outline"
              title="Reiniciar progreso"
              detail="Borra puntuaciones, temas e historial de intentos"
              destructive
              onPress={() => onResetProgress(student)}
            />
            <ModalActionButton
              icon="person-remove-outline"
              title="Quitar de clase"
              detail="Elimina la inscripción y su progreso asociado"
              destructive
              onPress={() => onRemoveFromClass(student)}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function StudentDetailModal({
  student,
  visible,
  reminderBusy,
  onClose,
  onAssignActivity,
  onViewHistory,
  onRemoveFromClass,
  onSendReminder,
  onRequestPasswordRecovery,
  xpLabel,
}: {
  student: StudentRow | null
  visible: boolean
  reminderBusy: boolean
  onClose: () => void
  onAssignActivity: (student: StudentRow) => void
  onViewHistory: (student: StudentRow) => void
  onRemoveFromClass: (student: StudentRow) => void
  onSendReminder: (student: StudentRow) => void
  onRequestPasswordRecovery: (student: StudentRow) => void
  xpLabel: string
}) {
  const responsive = useResponsiveLayout();
  const isPhone = responsive.isMobile;

  if (!student) return null;

  const status = getStatusMeta(student.status);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className={`flex-1 ${isPhone ? 'justify-end' : 'justify-center p-4 md:items-center'}`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar detalle del estudiante" accessibilityHint="Cierra el diálogo" className="absolute inset-0" onPress={onClose} />
        <View accessibilityViewIsModal accessibilityLabel={`Detalle de ${student.alias}`} className={`${isPhone ? 'max-h-[92%] w-full rounded-t-3xl p-4' : 'max-h-[90%] w-full max-w-[580px] rounded-2xl p-4'} border border-border-default bg-surface-default`}>
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-semibold text-semantic-info">Detalle del estudiante</Text>
              <Text accessibilityRole="header" className="mt-0.5 text-[21px] font-black leading-7 text-white" numberOfLines={2} maxFontSizeMultiplier={2}>{student.alias}</Text>
              <Text className="mt-1 text-[12px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>{student.handle}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar detalle" accessibilityHint="Cierra el diálogo" onPress={onClose} className="min-h-10 min-w-10 items-center justify-center rounded-xl border border-border-default bg-surface-raised">
              <Ionicons name="close" size={18} color="#DDE7F4" />
            </Pressable>
          </View>

          <ScrollView className="mt-3" showsVerticalScrollIndicator={false}>
            <View className="gap-3">
              <View className="flex-row flex-wrap gap-2">
                <DetailMetric label="Precisión" value={student.evaluatedAttempts > 0 ? `${student.accuracyPercent}%` : student.pendingReviewAttempts > 0 ? 'Pendiente' : 'Sin datos'} color="#38BDF8" />
                <DetailMetric label="Intentos" value={student.challenges.toLocaleString()} color="#8B5CF6" />
                <DetailMetric label="Preguntas respondidas" value={student.questions.toLocaleString()} color="#A78BFA" />
                <DetailMetric label={xpLabel} value={student.subjectScore.toLocaleString()} color="#FBBF24" />
                <DetailMetric label="Equivalencia /10" value={student.hasActivity ? `${student.averageScore.toFixed(1)} /10` : 'Sin datos'} color="#F6A64A" />
              </View>

              <View className="rounded-xl border border-border-default bg-surface-default p-3">
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-bold text-text-muted">Estado</Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                      <Text className="font-black" style={{ color: status.color }}>{status.label}</Text>
                    </View>
                    <Text className="mt-1.5 text-[11px] leading-4 text-text-secondary">{status.description}</Text>
                  </View>
                  <View className="rounded-xl border border-border-default bg-surface-raised px-3 py-2.5">
                    <Text className="text-[11px] text-text-muted">Última actividad</Text>
                    <Text className="mt-1 text-[13px] font-black text-white">{formatRelativeDate(student.lastActivityAt)}</Text>
                  </View>
                </View>
              </View>

              <DetailSection title="Cursos y clases">
                <View className="gap-2">
                  {student.courseContexts.map((context) => (
                    <View key={`${context.subjectId}:${context.classroomId ?? 'general'}`} className="rounded-xl border border-border-default bg-surface-default p-2.5">
                      <Text className="text-[13px] font-black text-white">{context.subjectName}</Text>
                      <Text className="mt-1 text-[12px] text-text-secondary">Clase: {context.classroomName}</Text>
                      <Text className="mt-1 text-[11px] text-text-muted">Inscrito: {formatDate(context.joinedAt)}</Text>
                    </View>
                  ))}
                  {student.courseContexts.length === 0 ? (
                    <Text className="text-[13px] text-text-muted">No hay cursos asociados.</Text>
                  ) : null}
                </View>
              </DetailSection>

              <DetailSection title="Áreas a reforzar">
                <View className="gap-2">
                  {student.weakAreas.map((area) => (
                    <View key={`${area.title}:${area.detail}`} className="rounded-xl border border-border-default bg-semantic-surface-danger p-2.5">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-black text-white" numberOfLines={2}>{area.title}</Text>
                          <Text className="mt-1 text-[12px] text-gamification-xp">{area.detail}</Text>
                        </View>
                        <Text className="text-[12px] font-black text-semantic-warning">
                          {area.mistakes} error{area.mistakes === 1 ? '' : 'es'}
                        </Text>
                      </View>
                      <Text className="mt-2 text-[11px] text-semantic-warning">
                        {area.accuracyPercent === null ? 'Acierto pendiente de calcular' : `${area.accuracyPercent}% de acierto`}
                      </Text>
                    </View>
                  ))}
                  {student.weakAreas.length === 0 ? (
                    <Text className="text-[13px] text-text-muted">
                      {student.hasActivity ? 'No hay áreas críticas detectadas.' : 'Aparecerán cuando el alumno responda preguntas.'}
                    </Text>
                  ) : null}
                </View>
              </DetailSection>

              <DetailSection title="Últimos intentos">
                <View className="gap-2">
                  {student.recentAttempts.slice(0, 5).map((attempt) => {
                    const attemptMeta = getTeacherAttemptMeta(attempt.manualReviewStatus, attempt.isCorrect)
                    return (
                      <View key={attempt.id} className="rounded-xl border border-border-default bg-surface-default p-2.5">
                        <View className="flex-row items-start gap-3">
                          <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: attemptMeta.background }}><Ionicons name={attemptMeta.icon} size={17} color={attemptMeta.color} /></View>
                          <View className="min-w-0 flex-1">
                            <Text className="text-[11px] font-black" style={{ color: attemptMeta.color }}>{attemptMeta.label}</Text>
                            <Text className="mt-0.5 text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
                            <Text className="mt-1 text-[11px] text-text-muted" numberOfLines={2} maxFontSizeMultiplier={2}>
                              {attempt.subjectName} · {attempt.topicTitle} · {formatDate(attempt.attemptedAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )
                  })}
                  {student.recentAttempts.length === 0 ? (
                    <Text className="text-[13px] text-text-muted">Todavía no hay intentos registrados.</Text>
                  ) : null}
                </View>
              </DetailSection>

              {student.status === 'no_activity' ? (
                <DetailSection title="Acciones de primer acceso">
                  <View className="flex-row flex-wrap gap-3">
                    <DetailActionButton icon="mail-outline" label={reminderBusy ? 'Enviando...' : 'Enviar recordatorio'} onPress={() => onSendReminder(student)} />
                    <DetailActionButton
                      icon="key-outline"
                      label={reminderBusy ? 'Enviando enlace...' : 'Recuperar acceso'}
                      onPress={() => onRequestPasswordRecovery(student)}
                    />
                  </View>
                </DetailSection>
              ) : null}

              <View className="flex-row flex-wrap gap-3 pt-1">
                <DetailActionButton icon="add-circle-outline" label="Asignar repaso" onPress={() => onAssignActivity(student)} />
                <DetailActionButton icon="time-outline" label="Ver historial" onPress={() => onViewHistory(student)} />
                <DetailActionButton icon="person-remove-outline" label="Quitar de clase" destructive onPress={() => onRemoveFromClass(student)} />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ConfirmModal({
  dialog,
  visible,
  onClose,
}: {
  dialog: ConfirmDialog | null
  visible: boolean
  onClose: () => void
}) {
  if (!dialog) return null;

  const handleConfirm = () => {
    const confirm = dialog.onConfirm;
    onClose();
    confirm();
  };

  return (
    <AppConfirmModal
      confirmLabel={dialog.confirmLabel}
      message={dialog.message}
      onCancel={onClose}
      onConfirm={handleConfirm}
      title={dialog.title}
      variant={dialog.destructive ? 'danger' : 'warning'}
      visible={visible}
    />
  );
}

export function ModalActionButton({
  icon,
  title,
  detail,
  destructive = false,
  onPress,
}: {
  icon: IconName
  title: string
  detail: string
  destructive?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 rounded-xl border border-border-default bg-surface-default px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: destructive ? '#EF444433' : '#8B5CF633' }}>
        <Ionicons name={icon} size={19} color={destructive ? '#FF8A8A' : '#B9A7FF'} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`font-black ${destructive ? 'text-semantic-danger' : 'text-white'}`}>{title}</Text>
        <Text className="mt-1 text-[12px] text-text-muted" numberOfLines={2}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8FA7C7" />
    </Pressable>
  );
}

export function DetailMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="min-w-[150px] flex-1 rounded-xl border px-3 py-3"
      style={{ borderColor: withAlpha(color, '70'), backgroundColor: withAlpha(color, '18'), flexBasis: 150 }}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name="analytics" size={15} color={color} />
        <Text className="min-w-0 flex-1 text-[11px] font-bold leading-4 text-text-secondary" numberOfLines={2} maxFontSizeMultiplier={2}>{label}</Text>
      </View>
      <Text className="mt-2 min-w-0 text-[18px] font-black text-white" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}

export 
function getTeacherAttemptMeta(manualReviewStatus: string | null | undefined, isCorrect: boolean) {
  const state = getStudentAttemptEvaluationState({ manualReviewStatus, isCorrect })
  if (state === 'correct') return { label: manualReviewStatus === 'approved' ? 'Respuesta aprobada' : 'Respuesta correcta', icon: 'checkmark' as const, color: '#22C55E', background: '#22C55E24' }
  if (state === 'incorrect') return { label: manualReviewStatus === 'rejected' ? 'Respuesta revisada' : 'Respuesta incorrecta', icon: 'close' as const, color: '#FB7185', background: '#EF444424' }
  if (state === 'needs_changes') return { label: 'Necesita cambios', icon: 'refresh' as const, color: '#A78BFA', background: '#A78BFA24' }
  return { label: 'Pendiente de revisión', icon: 'time-outline' as const, color: '#F59E0B', background: '#F59E0B24' }
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-border-default bg-surface-default p-3">
      <Text className="mb-2 text-[14px] font-black text-white">{title}</Text>
      {children}
    </View>
  );
}

export function DetailActionButton({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: IconName
  label: string
  destructive?: boolean
  onPress: () => void
}) {
  const { tokens } = useAppTheme()
  const actionColor = destructive ? tokens.semantic.danger : tokens.brand.teacher
  const actionSurface = destructive ? tokens.semanticSurface.danger : tokens.semanticSurface.info

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={destructive ? 'Esta acción puede eliminar datos del alumno' : 'Ejecuta esta acción para el alumno'}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-2 rounded-xl px-4 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        backgroundColor: actionColor,
        borderWidth: 1,
        borderColor: actionColor,
      })}
    >
      <View style={{ width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: actionSurface }}>
        <Ionicons name={icon} size={15} color="#FFFFFF" />
      </View>
      <Text className="text-[12px] font-black text-white">{label}</Text>
    </Pressable>
  );
}
