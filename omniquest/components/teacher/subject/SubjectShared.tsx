import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../../ui/AppButton';
import { useAppTheme } from '../../../lib/appTheme';

export type IconName = keyof typeof Ionicons.glyphMap

export function SubjectPanel({
  actionLabel,
  children,
  onAction,
  title,
}: {
  title: string
  children: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}) {
  const { tokens } = useAppTheme();

  return (
    <View className="rounded-xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[16px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>
        {actionLabel ? (
          <AppButton
            label={actionLabel}
            variant="ghost"
            size="sm"
            role="teacher"
            onPress={onAction || (() => undefined)}
          />
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function GradeDistributionBars({
  distribution,
  total,
}: {
  distribution: { label: string; color: string; count: number }[]
  total: number
}) {
  const { tokens } = useAppTheme();

  if (total <= 0) {
    return (
      <View className="rounded-xl border border-dashed p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="text-center text-[12px]" style={{ color: tokens.text.muted }}>Aún no hay notas para distribuir.</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[12px] font-semibold" style={{ color: tokens.text.secondary }}>Alumnos con nota</Text>
        <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>{total}</Text>
      </View>
      {distribution.map((item) => {
        const percent = Math.round((item.count / total) * 100);
        return (
          <View key={item.label}>
            <View className="mb-1 flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 text-[11px] font-semibold" style={{ color: tokens.text.secondary }}>{item.label}</Text>
              <Text className="text-[11px] font-bold" style={{ color: tokens.text.primary }}>
                {item.count} ({percent}%)
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: tokens.surface.interactive }}>
              <View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: item.color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
