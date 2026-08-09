import React, { useCallback, useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  type ListRenderItem,
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

type NotificationEmptyCopy = {
  title: string
  message: string
}

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
  emptyState?: NotificationEmptyCopy
  categoryLabel: (notification: AppNotification) => string
  onPress: (notification: AppNotification) => void | Promise<void>
  onMarkAsRead: (notification: AppNotification) => void | Promise<void>
  onDelete: (notification: AppNotification) => void | Promise<void>
  onRefresh: () => void | Promise<void>
  onLoadMore: () => void | Promise<void>
}

type NotificationFeedItemProps = {
  audience: FeedRole
  categoryLabel: string
  compact: boolean
  notification: AppNotification
  swipeEnabled: boolean
  onPress: NotificationFeedProps['onPress']
  onMarkAsRead: NotificationFeedProps['onMarkAsRead']
  onDelete: NotificationFeedProps['onDelete']
}

const keyExtractor = (item: NotificationFeedRow) => item.key

const NotificationFeedItem = React.memo(function NotificationFeedItem({
  audience,
  categoryLabel,
  compact,
  notification,
  swipeEnabled,
  onPress,
  onMarkAsRead,
  onDelete,
}: NotificationFeedItemProps) {
  const handlePress = useCallback(() => onPress(notification), [notification, onPress])
  const handleMarkAsRead = useCallback(() => onMarkAsRead(notification), [notification, onMarkAsRead])
  const handleDelete = useCallback(() => onDelete(notification), [notification, onDelete])

  return (
    <View className="mb-3">
      <NotificationListItem
        notification={notification}
        categoryLabel={categoryLabel}
        role={audience}
        compact={compact}
        swipeEnabled={swipeEnabled}
        onPress={handlePress}
        onMarkAsRead={handleMarkAsRead}
        onDelete={handleDelete}
      />
    </View>
  )
})

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
  emptyState,
  categoryLabel,
  onPress,
  onMarkAsRead,
  onDelete,
  onRefresh,
  onLoadMore,
}: NotificationFeedProps) {
  const { tokens } = useAppTheme()
  const rows = useMemo(() => buildNotificationRows(notifications), [notifications])

  const renderItem: ListRenderItem<NotificationFeedRow> = useCallback(({ item }) => item.kind === 'date' ? (
    <NotificationDateHeader label={item.label} count={item.count} />
  ) : (
    <NotificationFeedItem
      audience={audience}
      categoryLabel={categoryLabel(item.notification)}
      compact={compact}
      notification={item.notification}
      swipeEnabled={swipeEnabled}
      onPress={onPress}
      onMarkAsRead={onMarkAsRead}
      onDelete={onDelete}
    />
  ), [audience, categoryLabel, compact, onDelete, onMarkAsRead, onPress, swipeEnabled])

  const handleRefresh = useCallback(() => { void onRefresh() }, [onRefresh])
  const handleLoadMore = useCallback(() => { void onLoadMore() }, [onLoadMore])
  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMore) void onLoadMore()
  }, [hasMore, loadingMore, onLoadMore])

  return (
    <FlatList
      style={{ flex: 1 }}
      data={rows}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={(
        <NotificationEmptyState
          audience={audience}
          unreadOnly={unreadOnly}
          compact={compact}
          title={emptyState?.title}
          message={emptyState?.message}
        />
      )}
      ListFooterComponent={hasMore ? (
        <View className="items-center py-5">
          {loadingMore ? (
            <>
              <ActivityIndicator color={tokens.brand[audience]} />
              <Text className="mt-2 text-[12px] font-semibold" style={{ color: tokens.text.muted }}>Cargando más notificaciones…</Text>
            </>
          ) : (
            <AppButton accessibilityLabel="Cargar más notificaciones" label="Cargar más" icon="chevron-down-outline" role={audience} size="sm" variant="secondary" onPress={handleLoadMore} />
          )}
        </View>
      ) : notifications.length > 0 ? (
        <Text className="py-5 text-center text-[11px]" style={{ color: tokens.text.muted }}>Has llegado al final de las notificaciones.</Text>
      ) : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.brand[audience]} />}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.35}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={false}
    />
  )
}

export default React.memo(NotificationFeed)

const NotificationDateHeader = React.memo(function NotificationDateHeader({ label, count }: { label: string; count: number }) {
  const { tokens } = useAppTheme()
  return (
    <View className="mb-3 mt-2 flex-row items-center gap-3" accessibilityRole="header">
      <View className="h-px flex-1" style={{ backgroundColor: tokens.border.subtle }} />
      <View className="flex-row items-center gap-2 rounded-full border px-3 py-2" style={{ backgroundColor: tokens.surface.default, borderColor: tokens.border.default }}>
        <Ionicons name="calendar-outline" size={14} color={tokens.text.secondary} />
        <Text className="text-[12px] font-black" style={{ color: tokens.text.secondary }}>{label}</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tokens.surface.interactive }}>
          <Text className="text-[10px] font-black" style={{ color: tokens.text.muted }}>{count}</Text>
        </View>
      </View>
      <View className="h-px flex-1" style={{ backgroundColor: tokens.border.subtle }} />
    </View>
  )
})

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
    rows.push({ kind: 'date', key: `date:${key}`, label: dateLabel(items[0]?.timestamp), count: items.length })
    items.forEach((notification) => rows.push({ kind: 'notification', key: notification.id, notification }))
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

  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (character) => character.toUpperCase())
}
