import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type DestructiveActionType = 'scores' | 'enrollments' | 'all' | 'account'

export const REQUIRED_DESTRUCTIVE_CONFIRMATION = 'ELIMINAR'

export function SecurityDangerCard({
  deletingAccount,
  onDeleteAccount,
}: {
  deletingAccount: boolean
  onDeleteAccount: () => void
}) {
  return (
    <View className="rounded-2xl border border-[#4A1E2B] bg-[#160813] p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#2A0B18]">
          <Ionicons name="warning-outline" size={21} color="#FB7185" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-white">Zona sensible</Text>
          <Text className="mt-1 text-[12px] leading-5 text-[#FCA5A5]">
            Estas acciones afectan a tu cuenta y no deberían usarse para limpiar solo una partida.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onDeleteAccount}
        disabled={deletingAccount}
        className="mt-4 flex-row items-center justify-between rounded-xl border border-[#BE123C] bg-[#7F1D1D33] p-4"
        style={({ pressed }) => ({ opacity: deletingAccount ? 0.65 : pressed ? 0.84 : 1 })}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
          <View className="min-w-0 flex-1">
            <Text className="font-black text-[#FF6B6B]">Borrar mi cuenta</Text>
            <Text className="mt-1 text-[12px] text-[#FCA5A5]">Elimina tu perfil, progreso y datos asociados.</Text>
          </View>
        </View>
        {deletingAccount ? <ActivityIndicator color="#FF6B6B" /> : <Ionicons name="chevron-forward" size={18} color="#FF6B6B" />}
      </Pressable>
    </View>
  )
}

export function DestructiveConfirmModal({
  visible,
  action,
  isTeacher,
  value,
  busy,
  onChangeText,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  action: DestructiveActionType | null
  isTeacher: boolean
  value: string
  busy: boolean
  onChangeText: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const details = getDestructiveActionDetails(action, isTeacher)
  const canConfirm = value.trim() === REQUIRED_DESTRUCTIVE_CONFIRMATION && !busy
  const { width } = useWindowDimensions()
  const isPhone = width < 640

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className={`flex-1 bg-black/70 ${isPhone ? 'justify-end' : 'items-center justify-center px-5'}`}>
        <View className={`${isPhone ? 'max-h-[92%] w-full rounded-t-3xl p-5' : 'w-full max-w-[430px] rounded-2xl p-5'} border border-[#4A1E2B] bg-[#07162D]`}>
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#2A0B18]">
              <Ionicons name="warning-outline" size={20} color="#FB7185" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-black text-white">{details.title}</Text>
              <Text className="mt-1 text-[12px] leading-5 text-[#FCA5A5]">{details.description}</Text>
            </View>
          </View>

          <Text className="mt-5 text-[12px] font-semibold text-[#B7C4D7]">
            Escribe {REQUIRED_DESTRUCTIVE_CONFIRMATION} para continuar.
          </Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="characters"
            placeholder={REQUIRED_DESTRUCTIVE_CONFIRMATION}
            placeholderTextColor="#64748B"
            className="mt-2 rounded-lg border border-[#4A1E2B] bg-[#0D1D3B] px-4 py-3 text-[13px] font-bold text-white"
          />

          <View className={`mt-5 gap-3 ${isPhone ? '' : 'flex-row justify-end'}`}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              className={`${isPhone ? 'items-center py-4' : 'px-4 py-3'} rounded-lg border border-[#263E61]`}
              style={({ pressed }) => ({ opacity: busy ? 0.55 : pressed ? 0.8 : 1 })}
            >
              <Text className="text-[12px] font-bold text-[#DDE7F4]">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={!canConfirm}
              className={`${isPhone ? 'items-center py-4' : 'px-4 py-3'} rounded-lg bg-[#BE123C]`}
              style={({ pressed }) => ({ opacity: !canConfirm ? 0.45 : pressed ? 0.82 : 1 })}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-[12px] font-bold text-white">{details.confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function getDestructiveActionDetails(action: DestructiveActionType | null, isTeacher: boolean) {
  switch (action) {
    case 'scores':
      return isTeacher
        ? {
          title: 'Eliminar progreso de alumnos',
          description: 'Se borrarán puntuaciones por curso, clase, puntuaciones por tema e intentos de alumnos en tus cursos. No se borran cursos, clases, preguntas ni perfiles.',
          confirmLabel: 'Eliminar progreso',
        }
        : {
          title: 'Eliminar puntuaciones',
          description: 'Se borrarán subject_scores, topic_scores, intentos e insignias; tu XP global se recalculará a 0.',
          confirmLabel: 'Eliminar puntuaciones',
        }
    case 'enrollments':
      return isTeacher
        ? {
          title: 'Eliminar cursos y contenido',
          description: 'Se borrarán tus cursos, clases, temas, preguntas, respuestas, inscripciones y progreso asociado. Tu cuenta seguirá activa.',
          confirmLabel: 'Eliminar contenido',
        }
        : {
          title: 'Salir de todas los cursos',
          description: 'Se eliminarán tus inscripciones actuales. Tu cuenta seguirá activa.',
          confirmLabel: 'Salir de cursos',
        }
    case 'all':
      return isTeacher
        ? {
          title: 'Eliminar todos mis datos docentes',
          description: 'Se borrarán tus cursos, clases, temas, preguntas, respuestas, inscripciones, puntuaciones de alumnos, intentos, preferencias, notificaciones y avatar. Tu cuenta seguirá activa.',
          confirmLabel: 'Eliminar todo',
        }
        : {
          title: 'Eliminar datos de uso',
          description: 'Se borrarán progreso, intentos, estado de notificaciones, preferencias y avatar. Tu cuenta seguirá activa.',
          confirmLabel: 'Eliminar datos',
        }
    case 'account':
      return isTeacher
        ? {
          title: 'Borrar mi cuenta',
          description: 'Se eliminarán tu usuario, perfil docente y datos asociados. Revisa antes tus clases y contenido creado. No se puede deshacer.',
          confirmLabel: 'Borrar cuenta',
        }
        : {
          title: 'Borrar mi cuenta',
          description: 'Se eliminarán tu usuario, perfil, progreso académico y datos asociados. No se puede deshacer.',
          confirmLabel: 'Borrar cuenta',
        }
    default:
      return {
        title: 'Confirmar acción',
        description: 'Esta acción no se puede deshacer.',
        confirmLabel: 'Continuar',
      }
  }
}
