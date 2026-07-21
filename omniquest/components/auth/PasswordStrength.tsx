import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import type { PasswordStrengthResult } from '../../lib/auth'

type PasswordStrengthProps = {
  result: PasswordStrengthResult
  compact?: boolean
}

export default function PasswordStrength({ result, compact = false }: PasswordStrengthProps) {
  if (!result.hasValue) return null

  return (
    <View className="rounded-2xl border border-[#1D3760] bg-[#07162C]/80 p-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[12px] font-bold text-[#AFC2DB]">Seguridad de la contraseña</Text>
        <Text className="text-[12px] font-black" style={{ color: result.color }}>{result.label}</Text>
      </View>
      <View className="mt-2 flex-row gap-1.5">
        {[0, 1, 2, 3].map((segment) => (
          <View
            key={segment}
            className="h-2 flex-1 rounded-full"
            style={{ backgroundColor: segment < result.score ? result.color : '#1A3155' }}
          />
        ))}
      </View>
      {!compact ? (
        <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2">
          {result.checks.map((check) => (
            <View key={check.label} className="flex-row items-center gap-1.5">
              <Ionicons
                name={check.met ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={check.met ? '#34D399' : '#64748B'}
              />
              <Text className="text-[11px] font-semibold" style={{ color: check.met ? '#C8F7DF' : '#8FA7C7' }}>
                {check.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
