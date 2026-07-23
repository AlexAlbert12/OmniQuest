import React from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MobileMetricCard from '../../ui/mobile/MobileMetricCard'
import type { ConfirmDialog, IconName, StudentRow } from './types';
import { formatDate, formatRelativeDate, getStatusMeta } from './studentUtils';

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
  const { width } = useWindowDimensions();
  const isPhone = width < 640;

  if (!student) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className={`flex-1 ${isPhone ? 'justify-end' : 'justify-center p-4 md:items-center'}`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className={`${isPhone ? 'max-h-[92%] w-full rounded-t-3xl p-5' : 'w-full max-w-[420px] rounded-2xl p-5'} border border-[#1A3155] bg-[#09162C]`}>
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-semibold text-[#9FD6FF]">Acciones del estudiante</Text>
              <Text className="mt-1 text-[24px] font-black text-white" numberOfLines={1}>{student.alias}</Text>
              <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>{student.handle}</Text>
            </View>
            <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C]">
              <Ionicons name="close" size={18} color="#DDE7F4" />
            </Pressable>
          </View>

          <View className="mt-5 gap-3">
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
          </View>
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
}) {
  const { width } = useWindowDimensions();
  const isPhone = width < 640;

  if (!student) return null;

  const status = getStatusMeta(student.status);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className={`flex-1 ${isPhone ? 'justify-end' : 'justify-center p-4 md:items-center'}`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className={`${isPhone ? 'max-h-[94%] w-full rounded-t-3xl p-5' : 'max-h-[92%] w-full max-w-[620px] rounded-2xl p-5'} border border-[#1A3155] bg-[#09162C]`}>
          <View className="flex-row items-start justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] font-semibold text-[#9FD6FF]">Detalle del estudiante</Text>
              <Text className="mt-1 text-[24px] font-black text-white" numberOfLines={1}>{student.alias}</Text>
              <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={1}>{student.handle}</Text>
            </View>
            <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C]">
              <Ionicons name="close" size={18} color="#DDE7F4" />
            </Pressable>
          </View>

          <ScrollView className="mt-5" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              <View className="flex-row flex-wrap gap-3">
                <DetailMetric label="Precisión" value={student.hasActivity ? `${student.accuracyPercent}%` : 'Sin datos'} color="#38BDF8" />
                <DetailMetric label="Preguntas" value={student.challenges.toLocaleString()} color="#8B5CF6" />
                <DetailMetric label="XP" value={student.subjectScore.toLocaleString()} color="#FBBF24" />
                <DetailMetric label="Nota media" value={student.hasActivity ? `${student.averageScore.toFixed(1)} /10` : 'Sin datos'} color="#F6A64A" />
              </View>

              <View className="rounded-xl border border-[#20375E] bg-[#07162E] p-4">
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-bold text-[#8FA7C7]">Estado</Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                      <Text className="font-black" style={{ color: status.color }}>{status.label}</Text>
                    </View>
                    <Text className="mt-2 text-[12px] leading-5 text-[#B7C4D7]">{status.description}</Text>
                  </View>
                  <View className="rounded-xl border border-[#20375E] bg-[#0D1D3B] px-4 py-3">
                    <Text className="text-[11px] text-[#8FA7C7]">Última actividad</Text>
                    <Text className="mt-1 text-[13px] font-black text-white">{formatRelativeDate(student.lastActivityAt)}</Text>
                  </View>
                </View>
              </View>

              <DetailSection title="Cursos y clases">
                <View className="gap-2">
                  {student.courseContexts.map((context) => (
                    <View key={`${context.subjectId}:${context.classroomId ?? 'general'}`} className="rounded-xl border border-[#20375E] bg-[#071A32] p-3">
                      <Text className="text-[13px] font-black text-white">{context.subjectName}</Text>
                      <Text className="mt-1 text-[12px] text-[#AFC2DB]">Clase: {context.classroomName}</Text>
                      <Text className="mt-1 text-[11px] text-[#8FA7C7]">Inscrito: {formatDate(context.joinedAt)}</Text>
                    </View>
                  ))}
                  {student.courseContexts.length === 0 ? (
                    <Text className="text-[13px] text-[#8FA7C7]">No hay cursos asociados.</Text>
                  ) : null}
                </View>
              </DetailSection>

              <DetailSection title="Áreas a reforzar">
                <View className="gap-2">
                  {student.weakAreas.map((area) => (
                    <View key={`${area.title}:${area.detail}`} className="rounded-xl border border-[#4A2B1A] bg-[#21140A] p-3">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-black text-white" numberOfLines={2}>{area.title}</Text>
                          <Text className="mt-1 text-[12px] text-[#FBBF24]">{area.detail}</Text>
                        </View>
                        <Text className="text-[12px] font-black text-[#F59E0B]">
                          {area.mistakes} error{area.mistakes === 1 ? '' : 'es'}
                        </Text>
                      </View>
                      <Text className="mt-2 text-[11px] text-[#F8D7A1]">
                        {area.accuracyPercent === null ? 'Acierto pendiente de calcular' : `${area.accuracyPercent}% de acierto`}
                      </Text>
                    </View>
                  ))}
                  {student.weakAreas.length === 0 ? (
                    <Text className="text-[13px] text-[#8FA7C7]">
                      {student.hasActivity ? 'No hay áreas críticas detectadas.' : 'Aparecerán cuando el alumno responda preguntas.'}
                    </Text>
                  ) : null}
                </View>
              </DetailSection>

              <DetailSection title="Últimos intentos">
                <View className="gap-2">
                  {student.recentAttempts.slice(0, 5).map((attempt) => (
                    <View key={attempt.id} className="rounded-xl border border-[#20375E] bg-[#071A32] p-3">
                      <View className="flex-row items-start gap-3">
                        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: attempt.isCorrect ? '#22C55E24' : '#EF444424' }}>
                          <Ionicons name={attempt.isCorrect ? 'checkmark' : 'close'} size={17} color={attempt.isCorrect ? '#22C55E' : '#FB7185'} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-bold text-white" numberOfLines={2}>{attempt.questionText}</Text>
                          <Text className="mt-1 text-[11px] text-[#8FA7C7]" numberOfLines={1}>
                            {attempt.subjectName} · {attempt.topicTitle} · {formatDate(attempt.attemptedAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {student.recentAttempts.length === 0 ? (
                    <Text className="text-[13px] text-[#8FA7C7]">Todavía no hay intentos registrados.</Text>
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
  const { width } = useWindowDimensions();
  const isPhone = width < 640;

  if (!dialog) return null;

  const handleConfirm = () => {
    const confirm = dialog.onConfirm;
    onClose();
    confirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className={`flex-1 ${isPhone ? 'justify-end' : 'justify-center p-4 md:items-center'}`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.62)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className={`${isPhone ? 'w-full rounded-t-3xl p-5' : 'w-full max-w-[420px] rounded-2xl p-5'} border border-[#1A3155] bg-[#09162C]`}>
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: dialog.destructive ? '#EF444433' : '#8B5CF633' }}>
            <Ionicons name={dialog.destructive ? 'warning-outline' : 'information-circle-outline'} size={24} color={dialog.destructive ? '#FF8A8A' : '#B9A7FF'} />
          </View>
          <Text className="mt-4 text-[24px] font-black text-white">{dialog.title}</Text>
          <Text className="mt-2 text-[14px] leading-6 text-[#B7C4D7]">{dialog.message}</Text>

          <View className={`mt-6 gap-3 ${isPhone ? '' : 'flex-row'}`}>
            <Pressable onPress={onClose} className="flex-1 items-center justify-center rounded-xl border border-[#20375E] bg-[#111E3C] px-4 py-3">
              <Text className="font-bold text-[#DDE7F4]">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              className="flex-1 items-center justify-center rounded-xl px-4 py-3"
              style={{ backgroundColor: dialog.destructive ? '#DC2626' : '#5A46D8' }}
            >
              <Text className="font-black text-white">{dialog.confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-[#20375E] bg-[#07162E] px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: destructive ? '#EF444433' : '#8B5CF633' }}>
        <Ionicons name={icon} size={19} color={destructive ? '#FF8A8A' : '#B9A7FF'} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`font-black ${destructive ? 'text-[#FFB4B4]' : 'text-white'}`}>{title}</Text>
        <Text className="mt-1 text-[12px] text-[#8FA7C7]" numberOfLines={2}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8FA7C7" />
    </Pressable>
  );
}

export function DetailMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <MobileMetricCard
      className="min-w-[140px] flex-1 rounded-xl"
      color={color}
      compact
      icon="analytics"
      label={label}
      value={value}
    />
  )
}

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-[#20375E] bg-[#0A1830] p-4">
      <Text className="mb-3 font-black text-white">{title}</Text>
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
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-xl px-4 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        backgroundColor: destructive ? '#7F1D1D66' : '#5A46D8',
        borderWidth: destructive ? 1 : 0,
        borderColor: destructive ? '#BE123C' : 'transparent',
      })}
    >
      <Ionicons name={icon} size={15} color="#FFFFFF" />
      <Text className="text-[12px] font-black text-white">{label}</Text>
    </Pressable>
  );
}

