import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import TeacherSidebar from '../../components/TeacherSidebar';
import { useNotifications } from '../../hooks/useNotifications';

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'enrollment',
    title: 'Nueva inscripción',
    description: 'María García se inscribió en "Matemáticas Avanzadas"',
    icon: 'person-add-outline',
    color: '#8B5CF6',
    timestamp: '2024-05-07T14:30:00',
    isRead: false,
    subjectName: 'Matemáticas Avanzadas',
    studentName: 'María García',
  },
  {
    id: '2',
    type: 'student_activity',
    title: 'Actividad de estudiante',
    description: 'Juan Pérez completó 3 preguntas en "Física I"',
    icon: 'checkmark-circle-outline',
    color: '#34D399',
    timestamp: '2024-05-07T13:15:00',
    isRead: false,
    subjectName: 'Física I',
    studentName: 'Juan Pérez',
  },
  {
    id: '3',
    type: 'achievement',
    title: 'Logro alcanzado',
    description: 'Carlos López obtuvo la máxima puntuación en "Química"',
    icon: 'trophy-outline',
    color: '#F6A64A',
    timestamp: '2024-05-07T11:45:00',
    isRead: false,
    subjectName: 'Química',
    studentName: 'Carlos López',
  },
  {
    id: '4',
    type: 'new_class',
    title: 'Nueva clase creada',
    description: 'Has creado la clase "Biología Molecular"',
    icon: 'book-outline',
    color: '#3B82F6',
    timestamp: '2024-05-06T16:20:00',
    isRead: true,
    subjectName: 'Biología Molecular',
  },
  {
    id: '5',
    type: 'announcement',
    title: 'Aviso importante',
    description: 'El sistema estará en mantenimiento el próximo martes',
    icon: 'alert-circle-outline',
    color: '#F97316',
    timestamp: '2024-05-06T10:00:00',
    isRead: true,
  },
  {
    id: '6',
    type: 'student_activity',
    title: 'Actividad de estudiante',
    description: 'Ana Rodríguez respondió 5 preguntas en "Literatura"',
    icon: 'checkmark-circle-outline',
    color: '#34D399',
    timestamp: '2024-05-05T15:30:00',
    isRead: true,
    subjectName: 'Literatura',
    studentName: 'Ana Rodríguez',
  },
]

export default function NotificationsScreen() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const { loading: hooksLoading, markAsRead, markAllAsRead, deleteNotification, refresh } = useNotifications()
  const [notifications, setNotifications] = useState(mockNotifications)
  const [loading, setLoading] = useState(hooksLoading)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'enrollment' | 'student_activity' | 'achievement' | 'new_class' | 'announcement'>('all')

  const isDesktop = width >= 1080
  const isWide = width >= 860

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length
  const filteredNotifications = selectedFilter === 'all'
    ? notifications
    : selectedFilter === 'unread'
      ? notifications.filter((n) => !n.isRead)
      : notifications.filter((n) => n.type === selectedFilter)

  useFocusEffect(
    useCallback(() => {
      setLoading(false)
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    refresh().then(() => setRefreshing(false))
  }

  const handleMarkAsRead = (id: string) => {
    markAsRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const handleDeleteNotification = (id: string) => {
    deleteNotification(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`)
      return
    }
    Alert.alert(title, message)
  }

  const handleNotificationAction = (notification: Notification) => {
    if (notification.actionUrl) {
      router.push(notification.actionUrl as any)
    } else {
      handleMarkAsRead(notification.id)
    }
  }

  const filterOptions: { id: 'all' | 'unread' | 'enrollment' | 'student_activity' | 'achievement' | 'new_class' | 'announcement'; label: string; icon: string }[] = [
    { id: 'all', label: 'Todas', icon: 'list' },
    { id: 'unread', label: 'Sin leer', icon: 'mail-unread' },
    { id: 'enrollment', label: 'Inscripciones', icon: 'person-add-outline' },
    { id: 'student_activity', label: 'Actividad', icon: 'checkmark-circle-outline' },
    { id: 'achievement', label: 'Logros', icon: 'trophy-outline' },
    { id: 'new_class', label: 'Clases', icon: 'book-outline' },
    { id: 'announcement', label: 'Avisos', icon: 'alert-circle-outline' },
  ]

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
            onSignOut={() => supabase.auth.signOut()}
            onComingSoon={(feature) => showAlert('Próximamente', `${feature} estará disponible en una próxima iteración.`)}
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
          <View className="mb-6 flex-row items-center justify-between">
            <View>
              {!isDesktop ? (
                <Text className="mb-2 text-[#9FD6FF]" style={{ fontFamily: 'Pacifico_400Regular', fontSize: 24 }}>
                  OmniQuest
                </Text>
              ) : null}
              <Text className="text-[40px] font-black text-white">Centro de Notificaciones</Text>
              <Text className="mt-2 text-[14px] text-[#B7C4D7]">
                {unreadNotificationsCount > 0 ? `Tienes ${unreadNotificationsCount} notificación${unreadNotificationsCount !== 1 ? 'es' : ''} sin leer` : 'Todas las notificaciones leídas'}
              </Text>
            </View>

            {unreadNotificationsCount > 0 ? (
              <Pressable
                onPress={handleMarkAllAsRead}
                className="rounded-lg bg-[#5A46D8] px-4 py-2"
              >
                <Text className="text-[13px] font-bold text-white">Marcar todo como leído</Text>
              </Pressable>
            ) : null}
          </View>

          <View className={isWide ? 'flex-row gap-3' : 'gap-3'} style={{ marginBottom: 24, flexWrap: 'wrap' }}>
            {filterOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setSelectedFilter(option.id)}
                className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${
                  selectedFilter === option.id
                    ? 'bg-[#5A46D8]'
                    : 'border border-[#20375E] bg-[#09162C]'
                }`}
              >
                <Ionicons
                  name={option.icon as any}
                  size={14}
                  color={selectedFilter === option.id ? '#FFFFFF' : '#B7C4D7'}
                />
                <Text
                  className={`text-[13px] font-semibold ${
                    selectedFilter === option.id ? 'text-white' : 'text-[#B7C4D7]'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ gap: 12 }}>
            {filteredNotifications.length === 0 ? (
              <View className="items-center rounded-2xl border border-dashed border-[#29466F] bg-[#09162C] py-12">
                <Ionicons name="mail-outline" size={48} color="#64748B" />
                <Text className="mt-4 text-center text-lg font-bold text-white">
                  {selectedFilter === 'unread' ? 'Sin notificaciones sin leer' : 'Sin notificaciones'}
                </Text>
                <Text className="mt-2 text-center text-[13px] text-[#8FA7C7]">
                  {selectedFilter === 'unread'
                    ? 'Todas tus notificaciones están marcadas como leídas'
                    : 'Aquí aparecerán tus notificaciones'}
                </Text>
              </View>
            ) : (
              filteredNotifications.map((notification, index) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationAction(notification)}
                  onMarkAsRead={() => handleMarkAsRead(notification.id)}
                  onDelete={() => handleDeleteNotification(notification.id)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

function NotificationItem({
  notification,
  onPress,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification
  onPress: () => void
  onMarkAsRead: () => void
  onDelete: () => void
}) {
  const timeAgo = getTimeAgo(notification.timestamp)

  return (
    <View
      className={`flex-row gap-3 rounded-xl border px-4 py-3 ${
        notification.isRead
          ? 'border-[#1A3155] bg-[#07162E]'
          : 'border-[#3B82F6]/50 bg-[#0F1E35]'
      }`}
    >
      <View
        className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${notification.color}20` }}
      >
        <Ionicons name={notification.icon as any} size={22} color={notification.color} />
      </View>

      <Pressable className="flex-1" onPress={onPress}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className={`text-[14px] font-bold ${notification.isRead ? 'text-[#B7C4D7]' : 'text-white'}`}>
                {notification.title}
              </Text>
              {!notification.isRead ? (
                <View className="h-2 w-2 rounded-full bg-[#3B82F6]" />
              ) : null}
            </View>
            <Text className="mt-1 text-[13px] text-[#8FA7C7]">{notification.description}</Text>
            <View className="mt-2 flex-row items-center gap-2">
              <Ionicons name="time-outline" size={12} color="#64748B" />
              <Text className="text-[11px] text-[#64748B]">{timeAgo}</Text>
            </View>
          </View>

          <View className="flex-row gap-2 pl-3">
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
              className="h-8 w-8 items-center justify-center rounded-lg bg-[#EF4444]/20"
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  )
}

function getTimeAgo(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Hace unos segundos'
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)}d`

  return date.toLocaleDateString('es-ES')
}
