import React, { useCallback, useMemo, useRef } from 'react'
import { Animated, PanResponder, Platform, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AppNotification } from '../../lib/notifications/types'
import { getTimeAgo } from '../../lib/time'
import { useAppTheme } from '../../lib/appTheme'
import type { AppRole } from '../../lib/designTokens'
import { withAlpha } from '../../lib/color'
import { USE_NATIVE_ANIMATION_DRIVER } from '../../lib/animation'

type NotificationListItemProps = {
  notification: AppNotification
  categoryLabel: string
  role: Extract<AppRole, 'student' | 'teacher'>
  compact?: boolean
  swipeEnabled?: boolean
  onPress: () => void | Promise<void>
  onMarkAsRead: () => void | Promise<void>
  onDelete: () => void | Promise<void>
}

const SWIPE_LIMIT = 80
const SWIPE_TRIGGER = 50

function NotificationListItem({
  notification,
  categoryLabel,
  role,
  compact = false,
  swipeEnabled = Platform.OS !== 'web',
  onPress,
  onMarkAsRead,
  onDelete,
}: NotificationListItemProps) {
  const { tokens } = useAppTheme()
  const translateX = useRef(new Animated.Value(0)).current
  const roleColor = tokens.brand[role]
  const accent = notification.color || roleColor

  const resetPosition = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start()
  }, [translateX])

  const commitAction = useCallback((direction: 'read' | 'delete') => {
    Animated.timing(translateX, {
      toValue: direction === 'read' ? SWIPE_LIMIT : -SWIPE_LIMIT,
      duration: 120,
      useNativeDriver: USE_NATIVE_ANIMATION_DRIVER,
    }).start(() => {
      void Promise.resolve(direction === 'read' ? onMarkAsRead() : onDelete())
      resetPosition()
    })
  }, [onDelete, onMarkAsRead, resetPosition, translateX])

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => (
      swipeEnabled && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
    ),
    onPanResponderMove: (_event, gesture) => {
      const min = -SWIPE_LIMIT
      const max = notification.isRead ? 0 : SWIPE_LIMIT
      translateX.setValue(Math.max(min, Math.min(max, gesture.dx)))
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx <= -SWIPE_TRIGGER) {
        commitAction('delete')
        return
      }
      if (!notification.isRead && gesture.dx >= SWIPE_TRIGGER) {
        commitAction('read')
        return
      }
      resetPosition()
    },
    onPanResponderTerminate: resetPosition,
  }), [commitAction, notification.isRead, resetPosition, swipeEnabled, translateX])

  return (
    <View className="w-full overflow-hidden rounded-2xl" style={{ backgroundColor: tokens.surface.interactive }}>
      {swipeEnabled ? (
        <View className="absolute inset-0 flex-row items-stretch justify-between" style={{ pointerEvents: 'none' }}>
          <View className="w-20 items-center justify-center" style={{ backgroundColor: withAlpha(tokens.semantic.success, '36') }}>
            <Ionicons name="checkmark-done" size={24} color={tokens.semantic.success} />
            <Text className="mt-1 text-[10px] font-black" style={{ color: tokens.semantic.success }}>Leída</Text>
          </View>
          <View className="w-20 items-center justify-center" style={{ backgroundColor: withAlpha(tokens.semantic.danger, '36') }}>
            <Ionicons name="trash" size={23} color={tokens.semantic.danger} />
            <Text className="mt-1 text-[10px] font-black" style={{ color: tokens.semantic.danger }}>Eliminar</Text>
          </View>
        </View>
      ) : null}

      <Animated.View
        {...(swipeEnabled ? panResponder.panHandlers : {})}
        style={{ width: '100%', transform: [{ translateX }] }}
      >
        <View
          className={`flex-row gap-3 border ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}
          style={{
            backgroundColor: notification.isRead ? tokens.surface.default : withAlpha(roleColor, '13'),
            borderColor: notification.isRead ? tokens.border.default : withAlpha(roleColor, '88'),
            borderRadius: 16,
          }}
        >
          <View
            className={`${compact ? 'h-11 w-11' : 'h-12 w-12'} flex-shrink-0 items-center justify-center rounded-2xl`}
            style={{ backgroundColor: withAlpha(accent, '24') }}
          >
            <Ionicons name={notification.icon} size={compact ? 20 : 22} color={accent} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${notification.title}. ${notification.description}`}
            accessibilityHint={swipeEnabled ? 'Abre la notificación. Desliza a la derecha para marcarla como leída o a la izquierda para eliminarla.' : 'Abre la notificación.'}
            onPress={() => void onPress()}
            className="min-w-0 flex-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
          >
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text
                    className={`${compact ? 'text-[13px]' : 'text-[14px]'} font-black`}
                    style={{ color: notification.isRead ? tokens.text.secondary : tokens.text.primary }}
                    numberOfLines={2}
                    maxFontSizeMultiplier={2}
                  >
                    {notification.title}
                  </Text>
                  <View className="rounded-full px-2 py-1" style={{ backgroundColor: withAlpha(accent, '20') }}>
                    <Text className="text-[9px] font-black" style={{ color: accent }}>{categoryLabel}</Text>
                  </View>
                  {!notification.isRead ? <View className="h-2 w-2 rounded-full" style={{ backgroundColor: roleColor }} /> : null}
                </View>

                <Text
                  className="mt-1 text-[12px] leading-5"
                  style={{ color: tokens.text.muted }}
                  numberOfLines={3}
                  maxFontSizeMultiplier={2}
                >
                  {notification.description}
                </Text>

                <View className="mt-2 flex-row flex-wrap items-center gap-2">
                  <Ionicons name="time-outline" size={12} color={tokens.text.muted} />
                  <Text className="text-[10px]" style={{ color: tokens.text.muted }}>{getTimeAgo(notification.timestamp)}</Text>
                  {notification.subjectName ? (
                    <>
                      <Text className="text-[10px]" style={{ color: tokens.border.active }}>·</Text>
                      <Text className="text-[10px] font-bold" style={{ color: tokens.text.secondary }} numberOfLines={1}>{notification.subjectName}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            </Pressable>

              <View className="flex-row gap-2" accessibilityLabel="Acciones de notificación" style={{ display: swipeEnabled ? 'none' : 'flex' }}>
                {!notification.isRead ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Marcar como leída" accessibilityHint="Alternativa al gesto de deslizar hacia la derecha" hitSlop={6} onPress={() => void onMarkAsRead()} className="min-h-9 min-w-9 items-center justify-center rounded-xl" style={({ pressed }) => ({ backgroundColor: withAlpha(tokens.semantic.success, '22'), opacity: pressed ? 0.7 : 1 })}>
                    <Ionicons name="checkmark" size={17} color={tokens.semantic.success} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel="Eliminar notificación" accessibilityHint="Alternativa al gesto de deslizar hacia la izquierda" hitSlop={6} onPress={() => void onDelete()} className="min-h-9 min-w-9 items-center justify-center rounded-xl" style={({ pressed }) => ({ backgroundColor: withAlpha(tokens.semantic.danger, '22'), opacity: pressed ? 0.7 : 1 })}>
                  <Ionicons name="trash-outline" size={17} color={tokens.semantic.danger} />
                </Pressable>
              </View>
        </View>
      </Animated.View>
    </View>
  )
}

export default React.memo(NotificationListItem)
