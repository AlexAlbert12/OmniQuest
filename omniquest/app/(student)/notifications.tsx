import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { getTimeAgo } from '../../lib/time'
import StudentSidebar from '../../components/student/StudentSidebar'
import BrandLogo from '../../components/BrandLogo'
import StudentBottomNav from '../../components/student/StudentBottomNav'
import StudentHeaderAvatar from '../../components/student/StudentHeaderAvatar'
import { AppNotification, NotificationType, useNotifications } from '../../hooks/useNotifications'
import { withAlpha } from '../../lib/color'

type NotificationFilter = 'all' | 'unread' | NotificationType

type Profile = {
  alias: string
  avatar: string | null
  points: number | null
}

const filterOptions: {
  id: NotificationFilter
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { id: 'all', label: 'Todas', icon: 'list' },
  { id: 'unread', label: 'Sin leer', icon: 'mail-unread-outline' },
  { id: 'new_class', label: 'Cursos', icon: 'book-outline' },
  { id: 'student_activity', label: 'Actividad', icon: 'checkmark-circle-outline' },
  { id: 'achievement', label: 'Logros', icon: 'trophy-outline' },
  { id: 'announcement', label: 'Avisos', icon: 'alert-circle-outline' },
]

const categoryLabels: Record<NotificationType, string> = {
  enrollment: 'Inscripciones',
  student_activity: 'Actividad',
  achievement: 'Logros',
  new_class: 'Cursos',
  announcement: 'Avisos',
}

export default function StudentNotificationsScreen() {
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
  } = useNotifications('student')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>('all')

  const isDesktop = width >= 1080
  const isWide = width >= 860
  const points = profile?.points ?? 0
  const level = getStudentLevel(points)
  const nextLevelProgress = getNextLevelProgress(points)

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

  const fetchProfile = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return

      const { data, error } = await supabase
        .from('profiles')
        .select('alias, avatar, points')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data as Profile)
    } catch (error: any) {
      console.error('Error cargando perfil para notificaciones:', error.message)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchProfile()
    }, [fetchProfile])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refresh(), fetchProfile()])
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

  if (loading || profileLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando notificaciones...</Text>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <MobileStudentNotifications
        categoryStats={categoryStats}
        filteredNotifications={filteredNotifications}
        notificationsCount={notifications.length}
        refreshing={refreshing}
        selectedFilter={selectedFilter}
        unreadCount={unreadCount}
        onFilterChange={setSelectedFilter}
        onMarkAllAsRead={() => void markAllAsRead()}
        onNotificationPress={(notification) => void handleNotificationAction(notification)}
        onRefresh={() => void onRefresh()}
      />
    )
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <View className="flex-1 flex-row">
        {isDesktop ? (
          <StudentSidebar
            activeSection="notifications"
            alias={profile?.alias || 'Alumno'}
            avatar={profile?.avatar}
            level={level}
            points={points}
            nextLevelProgress={nextLevelProgress}
            onSignOut={handleSignOut}
          />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: isDesktop ? 28 : 18,
            paddingTop: isDesktop ? 28 : 18,
            paddingBottom: isDesktop ? 32 : MOBILE_BOTTOM_NAV_SPACER,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[280px] flex-1">
              {!isDesktop ? (
                <BrandLogo size={24} style={{ marginBottom: 8 }} />
              ) : null}
              <View className="flex-row items-center gap-3">
                <Ionicons name="notifications" size={38} color="#9FD6FF" />
                <Text className="text-[38px] font-black text-white">Notificaciones</Text>
              </View>
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">
                {unreadCount > 0
                  ? `Tienes ${unreadCount} notificación${unreadCount === 1 ? '' : 'es'} sin leer`
                  : 'Todo está al día en tus cursos'}
              </Text>
            </View>

            <View className="flex-row flex-wrap items-center gap-3">
              <Pressable
                onPress={() => void onRefresh()}
                className="flex-row items-center gap-2 rounded-xl px-4 py-3"
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: '#20375E',
                  backgroundColor: '#09162C',
                  opacity: pressed ? 0.82 : 1,
                })}
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
                  <Text className="text-[12px] font-bold text-white">Marcar leídas</Text>
                </Pressable>
              ) : null}
              <StudentHeaderAvatar />
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

      {!isDesktop ? <StudentBottomNav active="notifications" /> : null}
    </View>
  )
}

function MobileStudentNotifications({
  categoryStats,
  filteredNotifications,
  notificationsCount,
  refreshing,
  selectedFilter,
  unreadCount,
  onFilterChange,
  onMarkAllAsRead,
  onNotificationPress,
  onRefresh,
}: {
  categoryStats: {
    id: NotificationType
    label: string
    icon: keyof typeof Ionicons.glyphMap
    count: number
    unread: number
  }[]
  filteredNotifications: AppNotification[]
  notificationsCount: number
  refreshing: boolean
  selectedFilter: NotificationFilter
  unreadCount: number
  onFilterChange: (filter: NotificationFilter) => void
  onMarkAllAsRead: () => void
  onNotificationPress: (notification: AppNotification) => void
  onRefresh: () => void
}) {
  return (
    <View className="flex-1 bg-[#031022]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: MOBILE_BOTTOM_NAV_SPACER + 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 flex-row items-start justify-between">
          <BrandLogo size={32} />
          <View className="flex-row items-center gap-3">
            <NotificationTopButton count={unreadCount} />
            <StudentHeaderAvatar />
          </View>
        </View>

        <View className="mb-5 flex-row items-center gap-3">
          <LinearGradient
            colors={['#6D4AFF', '#4C1D95']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="notifications" size={30} color="#FFFFFF" />
          </LinearGradient>
          <View className="min-w-0 flex-1">
            <Text className="text-[34px] font-black leading-[38px] text-white" numberOfLines={1}>
              Notificaciones
            </Text>
            <Text className="mt-1 text-[14px] leading-5 text-[#C7D3E5]" numberOfLines={2}>
              {unreadCount > 0
                ? `${unreadCount} novedad${unreadCount === 1 ? '' : 'es'} por revisar`
                : 'Todo está al día en tus cursos'}
            </Text>
          </View>
        </View>

        <View className="mb-5 flex-row gap-3">
          <Pressable
            onPress={onRefresh}
            className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-[#20375E] bg-[#071832] px-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
          >
            <Ionicons name="refresh" size={18} color="#DDE7F4" />
            <Text className="text-[14px] font-black text-white">Actualizar</Text>
          </Pressable>
          <Pressable
            onPress={onMarkAllAsRead}
            disabled={unreadCount === 0}
            className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl px-4"
            style={({ pressed }) => ({
              backgroundColor: '#6D4AFF',
              opacity: unreadCount === 0 ? 0.55 : pressed ? 0.78 : 1,
            })}
          >
            <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
            <Text className="text-[14px] font-black text-white">Marcar leídas</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 mb-6"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        >
          {filterOptions.map((option) => (
            <MobileFilterChip
              key={option.id}
              option={option}
              active={selectedFilter === option.id}
              count={option.id === 'unread' ? unreadCount : option.id === 'all' ? notificationsCount : categoryStats.find((category) => category.id === option.id)?.unread}
              onPress={() => onFilterChange(option.id)}
            />
          ))}
        </ScrollView>

        <View className="mb-4 flex-row items-center gap-3">
          <Text className="text-[22px] font-black text-white">{getNotificationSectionTitle(selectedFilter)}</Text>
          <View className="rounded-full bg-[#071832] px-3 py-1">
            <Text className="text-[12px] font-black text-[#8FA7C7]">{filteredNotifications.length}</Text>
          </View>
        </View>

        {filteredNotifications.length > 0 ? (
          <View className="gap-3">
            {filteredNotifications.map((notification) => (
              <MobileNotificationCard
                key={notification.id}
                notification={notification}
                onPress={() => onNotificationPress(notification)}
              />
            ))}
          </View>
        ) : (
          <MobileNotificationEmpty filter={selectedFilter} />
        )}

        <MobileAllCaughtUpBanner unreadCount={unreadCount} />
      </ScrollView>

      <StudentBottomNav active="notifications" />
    </View>
  )
}

function NotificationTopButton({ count }: { count: number }) {
  return (
    <View className="relative h-12 w-12 items-center justify-center rounded-full border border-[#20375E] bg-[#071832]">
      <Ionicons name="notifications-outline" size={22} color="#DDE7F4" />
      {count > 0 ? (
        <View className="absolute -right-1 -top-2 h-6 min-w-6 items-center justify-center rounded-full bg-[#EF4444] px-1.5">
          <Text className="text-[10px] font-black text-white">{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </View>
  )
}

function MobileFilterChip({
  active,
  count,
  onPress,
  option,
}: {
  active: boolean
  count?: number
  onPress: () => void
  option: { id: NotificationFilter; label: string; icon: keyof typeof Ionicons.glyphMap }
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-full px-4"
      style={({ pressed }) => ({
        borderWidth: active ? 0 : 1,
        borderColor: '#20375E',
        backgroundColor: active ? '#6D4AFF' : '#071832',
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <Ionicons name={option.icon} size={15} color={active ? '#FFFFFF' : '#DDE7F4'} />
      <Text className={`text-[13px] font-black ${active ? 'text-white' : 'text-[#DDE7F4]'}`}>{option.label}</Text>
      {typeof count === 'number' ? (
        <View className="min-w-6 items-center rounded-full px-2 py-0.5" style={{ backgroundColor: active ? '#FFFFFF2E' : '#13284A' }}>
          <Text className="text-[10px] font-black text-white">{count}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function MobileNotificationCard({
  notification,
  onPress,
}: {
  notification: AppNotification
  onPress: () => void
}) {
  const timeAgo = getTimeAgo(notification.timestamp)
  const accent = getNotificationTypeAccent(notification.type, notification.color)

  return (
    <Pressable
      onPress={onPress}
      className="relative min-h-[116px] flex-row items-center gap-3 rounded-2xl border border-[#17345B] bg-[#071832] p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      {!notification.isRead ? <View className="absolute left-2 top-7 h-2.5 w-2.5 rounded-full bg-[#7C5CFF]" /> : null}
      <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: withAlpha(accent, '28') }}>
        <Ionicons name={notification.icon} size={27} color={accent} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="min-w-0 flex-1 text-[16px] font-black text-white" numberOfLines={2}>{notification.title}</Text>
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: withAlpha(accent, '26') }}>
            <Text className="text-[11px] font-black" style={{ color: accent }}>{categoryLabels[notification.type]}</Text>
          </View>
        </View>
        <Text className="mt-2 text-[14px] leading-5 text-[#C7D3E5]" numberOfLines={3}>{notification.description}</Text>
        <View className="mt-3 flex-row flex-wrap items-center gap-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="time-outline" size={14} color="#8FA7C7" />
            <Text className="text-[12px] text-[#8FA7C7]">{timeAgo}</Text>
          </View>
          {notification.subjectName ? (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="book-outline" size={14} color="#8FA7C7" />
              <Text className="text-[12px] text-[#C7D3E5]" numberOfLines={1}>{notification.subjectName}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#B7C4D7" />
    </Pressable>
  )
}

function MobileNotificationEmpty({ filter }: { filter: NotificationFilter }) {
  const title = filter === 'unread' ? 'Nada sin leer' : 'Sin notificaciones'
  const detail = filter === 'unread'
    ? 'Todo lo importante ya está marcado como leído.'
    : 'Aquí aparecerán nuevos cursos, actividad, logros y avisos.'

  return (
    <View className="items-center rounded-2xl border border-dashed border-[#1E3A63] bg-[#081B37] px-5 py-9">
      <Ionicons name="mail-open-outline" size={36} color="#8FA7C7" />
      <Text className="mt-3 text-center text-[17px] font-black text-white">{title}</Text>
      <Text className="mt-2 text-center text-[13px] leading-5 text-[#8FA7C7]">{detail}</Text>
    </View>
  )
}

function MobileAllCaughtUpBanner({ unreadCount }: { unreadCount: number }) {
  return (
    <LinearGradient
      colors={['#2A1768', '#181B4B', '#0C1D3C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginTop: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#352A82' }}
    >
      <View className="min-h-[124px] flex-row items-center gap-4 p-5">
        <View className="relative h-20 w-20 items-center justify-center rounded-full bg-[#5B21B6]/35">
          <Ionicons name="notifications" size={44} color="#A78BFA" />
          {unreadCount > 0 ? (
            <View className="absolute right-0 top-2 h-9 min-w-9 items-center justify-center rounded-full bg-[#EF4444] px-2">
              <Text className="text-[14px] font-black text-white">{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[19px] font-black text-white">
            {unreadCount > 0 ? 'Tienes novedades' : '¡Estás al día!'}
          </Text>
          <Text className="mt-2 text-[15px] leading-6 text-[#DDE7F4]">
            {unreadCount > 0
              ? 'Revísalas para seguir avanzando en tus cursos.'
              : 'Sigue así, tu constancia te acerca a tus metas.'}
          </Text>
        </View>
      </View>
    </LinearGradient>
  )
}

function getNotificationSectionTitle(filter: NotificationFilter) {
  if (filter === 'all') return 'Novedades'
  if (filter === 'unread') return 'Sin leer'
  return categoryLabels[filter]
}

function getNotificationTypeAccent(type: NotificationType, fallback?: string) {
  const colors: Record<NotificationType, string> = {
    enrollment: '#A855F7',
    new_class: '#8B5CF6',
    student_activity: '#22C55E',
    achievement: '#F59E0B',
    announcement: '#38BDF8',
  }

  return colors[type] || fallback || '#8B5CF6'
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
              {notification.subjectName && (
                <>
                  <Text className="text-[11px] text-[#415676]">·</Text>
                  <Text className="text-[11px] font-semibold text-[#8FA7C7]">{notification.subjectName}</Text>
                </>
              )}
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
    ? 'Todo lo importante ya está marcado como leído.'
    : 'Aquí aparecerán nuevos cursos, actividad, logros y avisos de tus clases.'

  return (
    <View className="items-center rounded-2xl border border-dashed border-[#29466F] bg-[#09162C] px-6 py-12">
      <Ionicons name="mail-outline" size={48} color="#64748B" />
      <Text className="mt-4 text-center text-lg font-bold text-white">{title}</Text>
      <Text className="mt-2 max-w-[420px] text-center text-[13px] leading-5 text-[#8FA7C7]">{detail}</Text>
    </View>
  )
}
