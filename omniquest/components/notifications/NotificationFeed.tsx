import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AppNotification } from '../../lib/notifications/types'
import type { AppRole } from '../../lib/designTokens'
import { useAppTheme } from '../../lib/appTheme'
import AppButton from '../ui/AppButton'
import NotificationEmptyState from './NotificationEmptyState'
import NotificationListItem from './NotificationListItem'

type FeedRole = Extract<AppRole, 'student' | 'teacher'>

type NotificationFeedRow =
  | { kind: 'date'; key: string; label: string; count: number }
  | { kind: 'notification'; key: string; notification: AppNotification }

type NotificationFeedProps = {
  audience: FeedRole
  notifications: AppNotification[]
  unreadOnly?: boolean
  compact?: boolean
  swipeEnabled?: boolean
  hasMore: boolean
  loadingMore: boolean
  refreshing: boolean
  header?: React.ReactElement | null
  contentContainerStyle?: StyleProp<ViewStyle>
  categoryLabel: (notification: AppNotification) => string
  onPress: (notification: AppNotification) => void | Promise<void>
  onMarkAsRead: (notification: AppNotification) => void | Promise<void>
  onDelete: (notification: AppNotification) => void | Promise<void>
  onRefresh: () => void | Promise<void>
  onLoadMore: () => void | Promise<void>
}

function NotificationFeed({
  audience,
  notifications,
  unreadOnly = false,
  compact = false,
  swipeEnabled = false,
  hasMore,
  loadingMore,
  refreshing,
  header,
  contentContainerStyle,
  categoryLabel,
  onPress,
  onMarkAsRead,
  onDelete,
  onRefresh,
  onLoadMore,
}: NotificationFeedProps) {
  const { tokens } = useAppTheme()
  const rows = useMemo(() => buildNotificationRows(notifications), [notifications])

  return (
    <FlatList
      data={rows}
      keyExtractor={(item: NotificationFeedRow) => item.key}
      renderItem={({ item }: { item: NotificationFeedRow }) => item.kind === 'date' ? (
        <NotificationDateHeader label={item.label} count={item.count} />
      ) : (
        <View className="mb-3">
          <NotificationListItem
            notification={item.notification}
            categoryLabel={categoryLabel(item.notification)}
            role={audience}
            compact={compact}
            swipeEnabled={swipeEnabled}
            onPress={() => onPress(item.notification)}
            onMarkAsRead={() => onMarkAsRead(item.notification)}
            onDelete={() => onDelete(item.notification)}
          />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={<NotificationEmptyState audience={audience} unreadOnly={unreadOnly} />}
      ListFooterComponent={hasMore ? (
        <View className="items-center py-5">
          {loadingMore ? (
            <>
              <ActivityIndicator color={tokens.brand[audience]} />
              <Text className="mt-2 text-[12px] font-semibold" style={{ color: tokens.text.muted }}>
                Cargando más notificaciones…
              </Text>
            </>
          ) : (
            <AppButton
              accessibilityLabel="Cargar más notificaciones"
              label="Cargar más"
              icon="chevron-down-outline"
              role={audience}
              size="sm"
              variant="secondary"
              onPress={() => void onLoadMore()}
            />
          )}
        </View>
      ) : notifications.length > 0 ? (
        <Text className="py-5 text-center text-[11px]" style={{ color: tokens.text.muted }}>
          Has llegado al final de las notificaciones.
        </Text>
      ) : null}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={tokens.brand[audience]}
        />
      )}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      onEndReached={() => {
        if (hasMore && !loadingMore) void onLoadMore()
      }}
      onEndReachedThreshold={0.35}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={false}
    />
  )
}

export default React.memo(NotificationFeed)

function NotificationDateHeader({ label, count }: { label: string; count: number }) {
  const { tokens } = useAppTheme()
  return (
    <View className="mb-3 mt-2 flex-row items-center gap-3" accessibilityRole="header">
      <View className="h-px flex-1" style={{ backgroundColor: tokens.border.subtle }} />
      <View
        className="flex-row items-center gap-2 rounded-full border px-3 py-2"
        style={{ backgroundColor: tokens.surface.default, borderColor: tokens.border.default }}
      >
        <Ionicons name="calendar-outline" size={14} color={tokens.text.secondary} />
        <Text className="text-[12px] font-black" style={{ color: tokens.text.secondary }}>{label}</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tokens.surface.interactive }}>
          <Text className="text-[10px] font-black" style={{ color: tokens.text.muted }}>{count}</Text>
        </View>
      </View>
      <View className="h-px flex-1" style={{ backgroundColor: tokens.border.subtle }} />
    </View>
  )
}

function buildNotificationRows(notifications: AppNotification[]): NotificationFeedRow[] {
  const groups = new Map<string, AppNotification[]>()

  notifications.forEach((notification) => {
    const key = dateKey(notification.timestamp)
    const current = groups.get(key) || []
    current.push(notification)
    groups.set(key, current)
  })

  const rows: NotificationFeedRow[] = []
  groups.forEach((items, key) => {
    rows.push({
      kind: 'date',
      key: `date:${key}`,
      label: dateLabel(items[0]?.timestamp),
      count: items.length,
    })
    items.forEach((notification) => rows.push({
      kind: 'notification',
      key: notification.id,
      notification,
    }))
  })

  return rows
}

function dateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dateLabel(value?: string) {
  if (!value) return 'Notificaciones'
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (dateKey(value) === dateKey(today.toISOString())) return 'Hoy'
  if (dateKey(value) === dateKey(yesterday.toISOString())) return 'Ayer'

  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).replace(/^./, (character) => character.toUpperCase())
}
