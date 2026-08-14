import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import GamifiedAvatar from './GamifiedAvatar'
import type { AvatarFrame, ProfileCosmetics } from '../../lib/avatarCosmetics'
import { getStudentBadgePresentation, type StudentBadge } from '../../lib/studentBadges'
import { useAppHaptics } from '../../lib/haptics'
import { withAlpha } from '../../lib/color'

const RARITY_LABELS: Record<AvatarFrame['rarity'], string> = {
  common: 'Común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
}

export default function AvatarCustomizationModal({
  alias,
  avatarUrl,
  awardedBadgeIds,
  busy,
  cosmetics,
  frames,
  level,
  onChangePhoto,
  onClose,
  onSave,
  visible,
}: {
  alias: string
  avatarUrl?: string | null
  awardedBadgeIds: string[]
  busy?: boolean
  cosmetics: ProfileCosmetics
  frames: AvatarFrame[]
  level: number
  onChangePhoto: () => void
  onClose: () => void
  onSave: (selection: { frameKey: string | null; featuredBadgeId: string | null }) => Promise<void> | void
  visible: boolean
}) {
  const haptics = useAppHaptics()
  const [selectedFrameKey, setSelectedFrameKey] = useState<string | null>(cosmetics.frame?.key ?? null)
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(cosmetics.featuredBadgeId)

  useEffect(() => {
    if (!visible) return
    setSelectedFrameKey(cosmetics.frame?.key ?? null)
    setSelectedBadgeId(cosmetics.featuredBadgeId)
  }, [cosmetics.featuredBadgeId, cosmetics.frame?.key, visible])

  const selectedFrame = frames.find((frame) => frame.key === selectedFrameKey) || cosmetics.frame || frames[0] || null
  const badgeOptions = useMemo(
    () => awardedBadgeIds
      .map((badgeId) => getStudentBadgePresentation(badgeId))
      .filter((badge): badge is StudentBadge => Boolean(badge)),
    [awardedBadgeIds]
  )

  const selectFrame = (frame: AvatarFrame) => {
    if (!frame.unlocked) return
    void haptics.selection()
    setSelectedFrameKey(frame.key)
  }

  const selectBadge = (badgeId: string | null) => {
    void haptics.selection()
    setSelectedBadgeId((current) => current === badgeId ? null : badgeId)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background-secondary px-4 py-8">
        <Pressable
          accessibilityLabel="Cerrar personalización de avatar"
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0 }}
        />

        <View className="mx-auto max-h-full w-full max-w-[720px] overflow-hidden rounded-[30px] border border-border-default bg-background-primary">
          <View className="flex-row items-center justify-between border-b border-border-default px-5 py-4">
            <View className="min-w-0 flex-1 pr-4">
              <Text className="text-[23px] font-black text-white">Personaliza tu avatar</Text>
              <Text className="mt-1 text-[13px] leading-5 text-text-secondary">
                Equipa un marco y destaca uno de tus logros.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-surface-interactive"
            >
              <Ionicons name="close" size={23} color="#DDE7F4" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <View className="items-center rounded-3xl border border-border-default bg-surface-raised p-5">
              <GamifiedAvatar
                alias={alias}
                avatarUrl={avatarUrl}
                frame={selectedFrame}
                featuredBadgeId={selectedBadgeId}
                level={level}
                size={132}
              />
              <Text className="mt-4 text-[20px] font-black text-white">{alias}</Text>
              <Text className="mt-1 text-[13px] text-text-secondary">Nivel {level}</Text>
              <Pressable
                accessibilityLabel="Cambiar foto de perfil"
                accessibilityRole="button"
                hitSlop={6}
                onPress={onChangePhoto}
                disabled={busy}
                className="mt-4 flex-row items-center gap-2 rounded-2xl border border-border-active bg-surface-interactive px-4 py-3"
                style={({ pressed }) => ({ opacity: busy ? 0.5 : pressed ? 0.82 : 1 })}
              >
                <Ionicons name="camera-outline" size={18} color="#9FD6FF" />
                <Text className="font-black text-text-secondary">Cambiar foto</Text>
              </Pressable>
            </View>

            <Text className="mt-6 text-[19px] font-black text-white">Marcos</Text>
            <Text className="mt-1 text-[13px] text-text-muted">Sube de nivel y consigue logros para desbloquear más.</Text>
            <View className="mt-4 flex-row flex-wrap gap-3">
              {frames.map((frame) => {
                const selected = selectedFrameKey === frame.key
                return (
                  <Pressable
                    key={frame.key}
                    accessibilityLabel={`${frame.name}. ${frame.unlocked ? 'Disponible' : frame.lockedReason || 'Bloqueado'}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !frame.unlocked }}
                    disabled={!frame.unlocked}
                    onPress={() => selectFrame(frame)}
                    className="min-w-[150px] flex-1 rounded-2xl border border-border-default p-4"
                    style={({ pressed }) => ({
                      opacity: frame.unlocked ? (pressed ? 0.82 : 1) : 0.52,
                      borderWidth: selected ? 2 : 1,
                      backgroundColor: selected ? withAlpha(frame.primaryColor, '22') : '#0A1A36',
                    })}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View
                        className="h-12 w-12 items-center justify-center rounded-full border-[5px]"
                        style={{ borderColor: frame.primaryColor, backgroundColor: '#152A50' }}
                      >
                        <Ionicons name={frame.unlocked ? 'person' : 'lock-closed'} size={18} color={frame.secondaryColor} />
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={frame.primaryColor} /> : null}
                    </View>
                    <Text className="mt-3 text-[15px] font-black text-white">{frame.name}</Text>
                    <Text className="mt-1 text-[11px] font-black uppercase tracking-[0.06em]" style={{ color: frame.primaryColor }}>
                      {RARITY_LABELS[frame.rarity]}
                    </Text>
                    <Text className="mt-2 text-[12px] leading-5 text-text-secondary" numberOfLines={3}>
                      {frame.unlocked ? frame.description : frame.lockedReason || 'Todavía bloqueado.'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <Text className="mt-7 text-[19px] font-black text-white">Insignia destacada</Text>
            <Text className="mt-1 text-[13px] text-text-muted">Se mostrará junto a tu avatar en perfil, cabeceras y ranking.</Text>

            {badgeOptions.length > 0 ? (
              <View className="mt-4 flex-row flex-wrap gap-3">
                <BadgeOption
                  badge={null}
                  selected={selectedBadgeId === null}
                  onPress={() => selectBadge(null)}
                />
                {badgeOptions.map((badge) => (
                  <BadgeOption
                    key={badge.id}
                    badge={badge}
                    selected={selectedBadgeId === badge.id}
                    onPress={() => selectBadge(badge.id)}
                  />
                ))}
              </View>
            ) : (
              <View className="mt-4 items-center rounded-2xl border border-dashed border-border-default bg-surface-raised p-5">
                <Ionicons name="ribbon-outline" size={28} color="#8FA7C7" />
                <Text className="mt-2 text-center text-[13px] text-text-secondary">Desbloquea tu primer logro para destacarlo aquí.</Text>
              </View>
            )}

            <View className="mt-7 flex-row gap-3">
              <Pressable
                accessibilityLabel="Cancelar personalización"
                accessibilityRole="button"
                onPress={onClose}
                disabled={busy}
                className="min-h-[50px] flex-1 items-center justify-center rounded-2xl border border-border-default bg-surface-raised px-4"
              >
                <Text className="font-black text-text-secondary">Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Guardar personalización"
                accessibilityRole="button"
                onPress={() => void onSave({ frameKey: selectedFrameKey, featuredBadgeId: selectedBadgeId })}
                disabled={busy}
                className="min-h-[50px] flex-[1.25] flex-row items-center justify-center gap-2 rounded-2xl bg-surface-selected px-4"
                style={({ pressed }) => ({ opacity: busy ? 0.56 : pressed ? 0.84 : 1 })}
              >
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="sparkles" size={18} color="#FFFFFF" />}
                <Text className="font-black text-white">{busy ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function BadgeOption({
  badge,
  onPress,
  selected,
}: {
  badge: StudentBadge | null
  onPress: () => void
  selected: boolean
}) {
  const color = badge?.color || '#8FA7C7'
  return (
    <Pressable
      accessibilityLabel={badge ? `Destacar logro ${badge.title}` : 'No mostrar insignia destacada'}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="w-[30.8%] min-w-[94px] items-center border-border-default rounded-2xl border p-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.82 : 1,
        borderWidth: selected ? 2 : 1,
        backgroundColor: selected ? withAlpha(color, '22') : '#0A1A36',
      })}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full border" style={{ borderColor: color, backgroundColor: withAlpha(color, '1F') }}>
        <Ionicons name={badge?.icon || 'remove'} size={24} color={color} />
      </View>
      <Text className="mt-2 text-center text-[11px] font-black text-white" numberOfLines={2}>
        {badge?.title || 'Ninguna'}
      </Text>
    </Pressable>
  )
}
