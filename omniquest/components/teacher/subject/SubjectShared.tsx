import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../../ui/AppButton';
import MobileMetricCard from '../../ui/mobile/MobileMetricCard';
import { useAppTheme } from '../../../lib/appTheme';

export type IconName = keyof typeof Ionicons.glyphMap

export function SubjectKpiCard({
  color,
  detail,
  icon,
  isDesktop,
  label,
  value,
}: {
  color?: string
  detail: string
  icon: IconName
  isDesktop: boolean
  label: string
  value: string
}) {
  const { tokens } = useAppTheme();
  const resolvedColor = color || tokens.brand.teacher;

  if (!isDesktop) {
    return (
      <View
        accessible
        accessibilityLabel={`${label}: ${value}. ${detail}`}
        className="min-w-0 flex-1 items-center justify-center rounded-xl border border-border-default bg-surface-default p-1.5"
        style={{ aspectRatio: 1 }}
      >
        <Ionicons name={icon} size={19} color={resolvedColor} />
        <Text className="mt-1 text-center text-[17px] font-black text-text-primary" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text className="mt-0.5 text-center text-[9px] font-bold leading-3 text-text-secondary" numberOfLines={2}>{label}</Text>
      </View>
    );
  }

  return (
    <MobileMetricCard
      className="min-w-[190px] flex-1"
      color={resolvedColor}
      detail={detail}
      icon={icon}
      label={label}
      value={value}
    />
  );
}

export function SubjectPanel({
  actionLabel,
  children,
  headerAction,
  onAction,
  title,
}: {
  title: string
  children: React.ReactNode
  actionLabel?: string
  headerAction?: React.ReactNode
  onAction?: () => void
}) {
  const { tokens } = useAppTheme();

  return (
    <View className="rounded-xl border p-5" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[16px] font-black" style={{ color: tokens.text.primary }}>{title}</Text>
        {headerAction ?? (actionLabel ? (
          <AppButton label={actionLabel} variant="ghost" size="sm" role="teacher" onPress={onAction || (() => undefined)} />
        ) : null)}
      </View>
      {children}
    </View>
  );
}

export function GradeDistributionBars({
  distribution,
  total,
  unassessed = 0,
}: {
  distribution: { label: string; color: string; count: number }[]
  total: number
  unassessed?: number
}) {
  const { tokens } = useAppTheme();

  if (total <= 0) {
    return (
      <View className="rounded-xl border border-dashed p-4" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.default }}>
        <Text className="text-center text-[12px]" style={{ color: tokens.text.muted }}>Aún no hay notas para distribuir.</Text>
        {unassessed > 0 ? <Text className="mt-2 text-center text-[11px] font-semibold" style={{ color: tokens.text.secondary }}>{unassessed} alumno{unassessed === 1 ? '' : 's'} sin actividad / sin evaluar</Text> : null}
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between border-b border-border-subtle pb-3">
        <Text className="text-[12px] font-semibold" style={{ color: tokens.text.secondary }}>Alumnos con nota</Text>
        <Text className="text-[18px] font-black" style={{ color: tokens.text.primary }}>{total}</Text>
      </View>
      {distribution.map((item) => {
        const percent = Math.min(100, Math.max(0, Math.round((item.count / total) * 100)));
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
      {unassessed > 0 ? (
        <View className="mt-1 flex-row items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <Text className="text-[11px] font-semibold" style={{ color: tokens.text.muted }}>Sin actividad / sin evaluar</Text>
          <Text className="text-[11px] font-black" style={{ color: tokens.text.secondary }}>{unassessed} alumno{unassessed === 1 ? '' : 's'}</Text>
        </View>
      ) : null}
    </View>
  );
}
