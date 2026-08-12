import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/appTheme';
import { useI18n } from '../../lib/i18n';

export type DestructiveActionType = 'scores' | 'enrollments' | 'all' | 'teacher_data' | 'account'

export const REQUIRED_DESTRUCTIVE_CONFIRMATION = 'ELIMINAR'

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
  const { colors } = useAppTheme()
  const { t } = useI18n()
  const details = getDestructiveActionDetails(action, isTeacher, t)
  const canConfirm = value.trim() === REQUIRED_DESTRUCTIVE_CONFIRMATION && !busy
  const { width } = useWindowDimensions()
  const isPhone = width < 640

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className={`flex-1 bg-black/70 ${isPhone ? 'justify-end' : 'items-center justify-center px-5'}`}>
        <View className={`${isPhone ? 'max-h-[92%] w-full rounded-t-3xl p-5' : 'max-h-[90%] w-full max-w-[430px] rounded-2xl p-5'} border border-semantic-danger bg-surface-default`}>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-semantic-surface-danger">
              <Ionicons name="warning-outline" size={20} color="#FB7185" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-black" style={{ color: colors.text }}>{details.title}</Text>
              <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.danger }}>{details.description}</Text>
            </View>
          </View>

          <Text className="mt-5 text-[12px] font-semibold text-text-secondary">
            {t('danger.confirmInstruction', { confirmation: REQUIRED_DESTRUCTIVE_CONFIRMATION })}
          </Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="characters"
            placeholder={REQUIRED_DESTRUCTIVE_CONFIRMATION}
            placeholderTextColor={colors.textMuted}
            className="mt-2 rounded-lg border px-4 py-3 text-[13px] font-bold"
            style={{ borderColor: colors.danger, backgroundColor: colors.surfaceRaised, color: colors.text }}
          />

          <View className={`mt-5 gap-3 ${isPhone ? '' : 'flex-row justify-end'}`}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              className={`${isPhone ? 'items-center py-4' : 'px-4 py-3'} rounded-lg border border-border-default`}
              style={({ pressed }) => ({ opacity: busy ? 0.55 : pressed ? 0.8 : 1 })}
            >
              <Text className="text-[12px] font-bold" style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={!canConfirm}
              className={`${isPhone ? 'items-center py-4' : 'px-4 py-3'} rounded-lg bg-semantic-surface-danger`}
              style={({ pressed }) => ({ opacity: !canConfirm ? 0.45 : pressed ? 0.82 : 1 })}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-[12px] font-bold text-white">{details.confirmLabel}</Text>
              )}
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function getDestructiveActionDetails(action: DestructiveActionType | null, isTeacher: boolean, t: ReturnType<typeof useI18n>['t']) {
  switch (action) {
    case 'teacher_data':
      return {
        title: t('settings.data.teacherOwn.title'),
        description: t('settings.data.teacherOwn.confirmDescription'),
        confirmLabel: t('settings.data.teacherOwn.confirm'),
      }
    case 'scores':
      return isTeacher
        ? {
          title: t('danger.scores.teacher.title'),
          description: t('danger.scores.teacher.description'),
          confirmLabel: t('danger.scores.teacher.confirm'),
        }
        : {
          title: t('danger.scores.student.title'),
          description: t('danger.scores.student.description'),
          confirmLabel: t('danger.scores.student.confirm'),
        }
    case 'enrollments':
      return isTeacher
        ? {
          title: t('danger.enrollments.teacher.title'),
          description: t('danger.enrollments.teacher.description'),
          confirmLabel: t('danger.enrollments.teacher.confirm'),
        }
        : {
          title: t('danger.enrollments.student.title'),
          description: t('danger.enrollments.student.description'),
          confirmLabel: t('danger.enrollments.student.confirm'),
        }
    case 'all':
      return isTeacher
        ? {
          title: t('danger.all.teacher.title'),
          description: t('danger.all.teacher.description'),
          confirmLabel: t('danger.all.teacher.confirm'),
        }
        : {
          title: t('danger.all.student.title'),
          description: t('danger.all.student.description'),
          confirmLabel: t('danger.all.student.confirm'),
        }
    case 'account':
      return isTeacher
        ? {
          title: t('danger.account.title'),
          description: t('danger.account.teacherDescription'),
          confirmLabel: t('danger.account.confirm'),
        }
        : {
          title: t('danger.account.title'),
          description: t('danger.account.studentDescription'),
          confirmLabel: t('danger.account.confirm'),
        }
    default:
      return {
        title: t('danger.default.title'),
        description: t('danger.default.description'),
        confirmLabel: t('common.continue'),
      }
  }
}
