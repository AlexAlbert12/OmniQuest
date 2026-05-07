import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Notification = {
  id: string
  type: 'enrollment' | 'student_activity' | 'achievement' | 'new_class' | 'announcement'
  title: string
  description: string
  icon: string
  color: string
  timestamp: string
  isRead: boolean
  relatedId?: number
  subjectName?: string
  studentName?: string
  actionUrl?: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        setLoading(false)
        return
      }

      // TODO: Una vez que la tabla de notificaciones esté creada en Supabase:
      // const { data, error } = await supabase
      //   .from('notifications')
      //   .select('*')
      //   .eq('teacher_id', session.session.user.id)
      //   .order('timestamp', { ascending: false })

      // Por ahora usamos datos ficticios para demostración
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'enrollment',
          title: 'Nueva inscripción',
          description: 'María García se inscribió en tu clase',
          icon: 'person-add-outline',
          color: '#8B5CF6',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          isRead: false,
          subjectName: 'Matemáticas',
        },
        {
          id: '2',
          type: 'student_activity',
          title: 'Actividad de estudiante',
          description: 'Juan Pérez completó 3 preguntas',
          icon: 'checkmark-circle-outline',
          color: '#34D399',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          isRead: false,
        },
        {
          id: '3',
          type: 'achievement',
          title: 'Logro alcanzado',
          description: 'Carlos López obtuvo la máxima puntuación',
          icon: 'trophy-outline',
          color: '#F6A64A',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          isRead: false,
        },
      ]

      setNotifications(mockNotifications)
      setUnreadCount(mockNotifications.filter((n) => !n.isRead).length)
      setLoading(false)
    } catch (error: any) {
      console.error('Error cargando notificaciones:', error.message)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      // TODO: Actualizar en Supabase cuando la tabla esté lista
      // await supabase
      //   .from('notifications')
      //   .update({ is_read: true })
      //   .eq('id', id)
    },
    []
  )

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)

    // TODO: Actualizar en Supabase cuando la tabla esté lista
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))

    // TODO: Eliminar en Supabase cuando la tabla esté lista
  }, [])

  const refresh = useCallback(async () => {
    await fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  }
}
