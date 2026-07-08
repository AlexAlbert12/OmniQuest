import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  return (
    <View className="rounded-xl border border-[#183052] bg-[#07162D] p-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-[16px] font-black text-white">{title}</Text>
        {actionLabel ? (
          <Pressable onPress={onAction}>
            <Text className="text-[12px] font-bold text-[#A78BFA]">{actionLabel}</Text>
          </Pressable>
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
  if (total <= 0) {
    return (
      <View className="rounded-xl border border-dashed border-[#29466F] bg-[#07162D] p-4">
        <Text className="text-center text-[12px] text-[#8FA7C7]">Aún no hay notas para distribuir.</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[12px] font-semibold text-[#B7C4D7]">Alumnos con nota</Text>
        <Text className="text-[18px] font-black text-white">{total}</Text>
      </View>
      {distribution.map((item) => {
        const percent = Math.round((item.count / total) * 100);
        return (
          <View key={item.label}>
            <View className="mb-1 flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 text-[11px] font-semibold text-[#C4D0E3]">{item.label}</Text>
              <Text className="text-[11px] font-bold text-white">
                {item.count} ({percent}%)
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-[#13294C]">
              <View className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: item.color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
