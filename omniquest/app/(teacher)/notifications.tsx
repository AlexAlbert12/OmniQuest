import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { getTimeAgo } from '../../lib/time'
import TeacherSidebar from '../../components/TeacherSidebar'
import { AppNotification, NotificationType, useNotifications } from '../../hooks/useNotifications'

type NotificationFilter = 'all' | 'unread' | NotificationType

const filterOptions: {
  id: NotificationFilter
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { id: 'all', label: 'Todas', icon: 'list' },
  { id: 'unread', label: 'Sin leer', icon: 'mail-unread-outline' },
  { id: 'enrollment', label: 'Inscripciones', icon: 'person-add-outline' },
  { id: 'student_activity', label: 'Actividad', icon: 'checkmark-circle-outline' },
  { id: 'new_class', label: 'Clases', icon: 'book-outline' },
  { id: 'announcement', label: 'Avisos', icon: 'alert-circle-outline' },
]

const categoryLabels: Record<NotificationType, string> = {
  enrollment: 'Inscripciones',
  student_activity: 'Actividad',
  new_class: 'Clases',
  announcement: 'Avisos',
}

export default function NotificationsScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    error,
    clearError,
  } = useNotifications()
  const [refreshing, setRefreshing] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>('all')

  const isDesktop = width >= 1080
  const isWide = width >= 860

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'all') return notifications
    if (selectedFilter === 'unread') return notifications.filter((notification) => !notification.isRead)
    return notifications.filter((notification) => notification.type === selectedFilter)
  }, [notifications, selectedFilter])

  const categoryStats = useMemo(
    () =>
      filterOptions
        .filter((option): option is { id: NotificationType; label: string; icon: keyof typeof Ionicons.glyphMap } =>
          option.id !== 'all' && option.id !== 'unread'
        )
        .map((option) => {
          const categoryNotifications = notifications.filter((notification) => notification.type === option.id)
          return {
            ...option,
            count: categoryNotifications.length,
            unread: categoryNotifications.filter((notification) => !notification.isRead).length,
          }
        }),
    [notifications]
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }
    Alert.alert(title, message)
  }

  useEffect(() => {
    if (!error) return
    showAlert('Error de notificaciones', error)
    clearError()
  }, [clearError, error])

  const handleNotificationAction = async (notification: AppNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl as any)
    }
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.replace('/(auth)/login' as any)
    } catch (error: any) {
      console.error('Error cerrando sesión:', error)
      showAlert('No se pudo cerrar sesión', error?.message || 'Revisa tu conexión o inténtalo de nuevo.')
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando notificaciones...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <TeacherSidebar
            activeSection="notifications"
            subjectsCount={0}
            onSignOut={handleSignOut}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 28 : 18,
            paddingBottom: 32,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[280px] flex-1">
              {!isDesktop ? (
                <Text className="mb-2 text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 24 }}>
                  OmniQuest
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="notifications" size={38} color="#9FD6FF" />
                <Text className="text-[38px] font-black text-white">Centro de Notificaciones</Text>
              </View>
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">
                {unreadCount > 0
                  ? `Tienes ${unreadCount} notificación${unreadCount === 1 ? '' : 'es'} sin leer`
                  : 'Todas las notificaciones están al día'}
              </Text>
            </View>

            <View className="flex-row flex-wrap items-center gap-3">
              <Pressable
                onPress={() => void onRefresh()}
                className="flex-row items-center gap-2 rounded-xl border border-[#20375E] bg-[#09162C] px-4 py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
              >
                <Ionicons name="refresh-outline" size={16} color="#AFC2DB" />
                <Text className="text-[12px] font-bold text-[#DDE7F4]">Actualizar</Text>
              </Pressable>
              {unreadCount > 0 ? (
                <Pressable
                  onPress={() => void markAllAsRead()}
                  className="flex-row items-center gap-2 rounded-xl bg-[#5A46D8] px-4 py-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                >
                  <Ionicons name="checkmark-done-outline" size={16} color="#FFFFFF" />
                  <Text className="text-[12px] font-bold text-white">Marcar todo leído</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View className={isWide ? 'mb-5 flex-row gap-4' : 'mb-5 gap-4'}>
            {categoryStats.map((category) => (
              <CategoryCard
                key={category.id}
                label={category.label}
                icon={category.icon}
                count={category.count}
                unread={category.unread}
                active={selectedFilter === category.id}
                onPress={() => setSelectedFilter(category.id)}
              />
            ))}
          </View>

          <View className="mb-5 flex-row flex-wrap gap-3">
            {filterOptions.map((option) => (
              <FilterChip
                key={option.id}
                option={option}
                active={selectedFilter === option.id}
                count={option.id === 'unread' ? unreadCount : option.id === 'all' ? notifications.length : undefined}
                onPress={() => setSelectedFilter(option.id)}
              />
            ))}
          </View>

          <View style={{ gap: 12 }}>
            {filteredNotifications.length === 0 ? (
              <EmptyState filter={selectedFilter} />
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => void handleNotificationAction(notification)}
                  onMarkAsRead={() => void markAsRead(notification.id)}
                  onDelete={() => void deleteNotification(notification.id)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

function CategoryCard({
  label,
  icon,
  count,
  unread,
  active,
  onPress,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  count: number
  unread: number
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-w-[160px] flex-1 rounded-xl border p-4 ${active ? 'border-[#6D5AF6] bg-[#1A1E55]' : 'border-[#183052] bg-[#07162D]'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#13284A]">
          <Ionicons name={icon} size={20} color={active ? '#C4B5FD' : '#AFC2DB'} />
        </View>
        {unread > 0 ? (
          <View className="rounded-full bg-[#EF4444] px-2 py-1">
            <Text className="text-[10px] font-black text-white">{unread}</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-[12px] font-semibold text-[#B7C4D7]">{label}</Text>
      <Text className="mt-1 text-[24px] font-black text-white">{count}</Text>
    </Pressable>
  )
}

function FilterChip({
  option,
  active,
  count,
  onPress,
}: {
  option: { id: NotificationFilter; label: string; icon: keyof typeof Ionicons.glyphMap }
  active: boolean
  count?: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${
        active ? 'bg-[#5A46D8]' : 'border border-[#20375E] bg-[#09162C]'
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Ionicons name={option.icon} size={14} color={active ? '#FFFFFF' : '#B7C4D7'} />
      <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-[#B7C4D7]'}`}>
        {option.label}
      </Text>
      {typeof count === 'number' ? (
        <View className={active ? 'rounded-full bg-white/20 px-2 py-0.5' : 'rounded-full bg-[#13284A] px-2 py-0.5'}>
          <Text className="text-[10px] font-black text-white">{count}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function NotificationItem({
  notification,
  onPress,
  onMarkAsRead,
  onDelete,
}: {
  notification: AppNotification
  onPress: () => void
  onMarkAsRead: () => void
  onDelete: () => void
}) {
  const timeAgo = getTimeAgo(notification.timestamp)
  const [showDeleteAction, setShowDeleteAction] = useState(Platform.OS !== 'web')

  return (
    <View
      onPointerEnter={() => setShowDeleteAction(true)}
      onPointerLeave={() => setShowDeleteAction(Platform.OS !== 'web')}
      className={`flex-row gap-3 rounded-xl border px-4 py-3 ${
        notification.isRead ? 'border-[#1A3155] bg-[#07162E]' : 'border-[#5364F5] bg-[#0F1E35]'
      }`}
    >
      <View
        className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${notification.color}24` }}
      >
        <Ionicons name={notification.icon} size={22} color={notification.color} />
      </View>

      <Pressable className="min-w-0 flex-1" onPress={onPress}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className={`text-[14px] font-bold ${notification.isRead ? 'text-[#B7C4D7]' : 'text-white'}`}>
                {notification.title}
              </Text>
              <View className="rounded-full bg-[#13284A] px-2 py-1">
                <Text className="text-[10px] font-bold text-[#AFC2DB]">{categoryLabels[notification.type]}</Text>
              </View>
              {!notification.isRead ? <View className="h-2 w-2 rounded-full bg-[#3B82F6]" /> : null}
            </View>
            <Text className="mt-1 text-[13px] leading-5 text-[#8FA7C7]">{notification.description}</Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Ionicons name="time-outline" size={12} color="#64748B" />
              <Text className="text-[11px] text-[#64748B]">{timeAgo}</Text>
              {notification.subjectName ? (
                <>
                  <Text className="text-[11px] text-[#415676]">·</Text>
                  <Text className="text-[11px] font-semibold text-[#8FA7C7]">{notification.subjectName}</Text>
                </>
              ) : null}
            </View>
          </View>

          <View className="flex-row gap-2 pl-1">
            {!notification.isRead ? (
              <Pressable
                onPress={onMarkAsRead}
                className="h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/20"
              >
                <Ionicons name="checkmark-outline" size={16} color="#3B82F6" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onDelete}
              onFocus={() => setShowDeleteAction(true)}
              onBlur={() => setShowDeleteAction(Platform.OS !== 'web')}
              className="h-8 w-8 items-center justify-center rounded-lg bg-[#EF4444]/20"
              style={{ opacity: showDeleteAction ? 1 : 0 }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  )
}

function EmptyState({ filter }: { filter: NotificationFilter }) {
  const title = filter === 'unread' ? 'Sin notificaciones sin leer' : 'Sin notificaciones'
  const detail = filter === 'unread'
    ? 'Todas tus notificaciones están marcadas como leídas.'
    : 'Cuando haya inscripciones, actividad, clases o avisos aparecerán aquí.'

  return (
    <View className="items-center rounded-2xl border border-dashed border-[#29466F] bg-[#09162C] px-6 py-12">
      <Ionicons name="mail-outline" size={48} color="#64748B" />
      <Text className="mt-4 text-center text-lg font-bold text-white">{title}</Text>
      <Text className="mt-2 max-w-[420px] text-center text-[13px] leading-5 text-[#8FA7C7]">{detail}</Text>
    </View>
  )
}

