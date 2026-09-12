import { useCallback } from 'react'
import { Platform } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useAppFeedback } from '../../../hooks/useAppFeedback'
import { getErrorMessage } from '../../../lib/typeGuards'
import type { AdminConfirmationRequester } from '../shared/AdminTypedConfirmation'
import { invokeAdminAction, runAdminBulkAction } from '../api/adminApi'
import type { AdminBulkAction, AdminData, ClassroomRow, ProfileRow, SubjectRow } from '../types/admin'

export function useAdminActions(data: AdminData, requestConfirmation?: AdminConfirmationRequester) {
  const router = useRouter()
  const feedback = useAppFeedback()
  const requestSensitiveConfirmation = useCallback(async (options: Parameters<AdminConfirmationRequester>[0]) => {
    if (requestConfirmation) return requestConfirmation(options)
    return feedback.confirm({
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel,
      destructive: options.destructive,
    })
  }, [feedback, requestConfirmation])

  const executeBulkAction = useCallback(async (options: {
    action: AdminBulkAction
    entity: 'profiles' | 'subjects' | 'classrooms'
    ids: (string | number)[]
    reason?: string
    reactivateAt?: string | null
    targetTeacherId?: string | null
    deactivateClassrooms?: boolean
  }) => {
    if (options.ids.length === 0) return
    await runAdminBulkAction(options)
    await data.refresh()
  }, [data])

  const toggleProfileActive = useCallback(async (profile: ProfileRow, governance?: { reason?: string; reactivateAt?: string | null }) => {
    const nextActive = profile.active === false
    if (!nextActive && profile.id === data.portalContext?.user_id) {
      feedback.warning('Acción bloqueada', 'No puedes desactivar tu propia cuenta administradora.')
      return
    }
    const approved = nextActive
      ? await requestSensitiveConfirmation({
          title: 'Activar usuario',
          message: `Se activará la cuenta de ${profile.alias}.`,
          confirmLabel: 'Activar',
          destructive: false,
          icon: 'checkmark-circle-outline',
        })
      : await requestSensitiveConfirmation({
          title: 'Desactivar usuario',
          message: `La cuenta de ${profile.alias} dejará de poder acceder. Motivo: ${governance?.reason || 'No especificado'}.`,
          confirmationText: 'DESACTIVAR', confirmLabel: 'Desactivar cuenta', destructive: true, icon: 'ban-outline',
        })
    if (!approved) return
    try {
      await executeBulkAction({
        action: nextActive ? 'activate_users' : 'deactivate_users',
        entity: 'profiles', ids: [profile.id], reason: governance?.reason, reactivateAt: governance?.reactivateAt,
      })
      feedback.success(nextActive ? 'Usuario activado' : 'Usuario desactivado', `${profile.alias} se ha actualizado correctamente.`)
    } catch (error: unknown) {
      feedback.error('No se pudo actualizar', getErrorMessage(error, 'Revisa tus permisos administrativos.'))
    }
  }, [data.portalContext?.user_id, executeBulkAction, feedback, requestSensitiveConfirmation])

  const resetPassword = useCallback(async (profile: ProfileRow) => {
    if (!profile.email) {
      feedback.warning('Sin correo', 'Este usuario no tiene correo guardado en profiles.email.')
      return
    }
    const approved = await requestSensitiveConfirmation({
      title: 'Restablecer contraseña',
      message: `Se enviará un enlace de recuperación a ${profile.email}. Esta acción quedará registrada en auditoría.`,
      confirmationText: 'RESET', confirmLabel: 'Enviar enlace', destructive: false, icon: 'key-outline',
    })
    if (!approved) return
    try {
      const result = await invokeAdminAction<AdminActionResult & { deliveryMode?: 'real' | 'redirect' }>('admin-reset-password', { profileId: profile.id })
      if (result.deliveryMode === 'redirect') {
        feedback.success('Correo de prueba enviado', 'El enlace se ha redirigido al destinatario de pruebas configurado en Supabase.')
      } else {
        feedback.success('Correo enviado', `Se ha enviado un enlace de restablecimiento a ${profile.email}.`)
      }
    } catch (error: unknown) {
      feedback.error('No se pudo restablecer', getErrorMessage(error, 'Revisa la configuración de correo.'))
    }
  }, [feedback, requestSensitiveConfirmation])

  const deleteStudentProgress = useCallback(async (student: ProfileRow, reason: string) => {
    const administrativeReason = reason.trim()
    if (administrativeReason.length < 5) {
      feedback.warning('Motivo obligatorio', 'Indica un motivo administrativo de al menos 5 caracteres.')
      return
    }
    try {
      await invokeAdminAction('admin-delete-student-progress', { studentId: student.id, reason: administrativeReason })
      await data.refresh()
      feedback.success('Progreso eliminado', `Se han eliminado puntuaciones, progreso por tema, intentos e insignias de ${student.alias}.`)
    } catch (error: unknown) {
      feedback.error('No se pudo eliminar progreso', getErrorMessage(error, 'Inténtalo de nuevo.'))
    }
  }, [data, feedback])

  const toggleCourseArchive = useCallback(async (subject: SubjectRow, governance?: { reason?: string; deactivateClassrooms?: boolean }) => {
    const archive = !subject.is_archived
    const approved = archive
      ? await requestSensitiveConfirmation({
          title: 'Archivar curso',
          message: `El curso ${subject.name} se archivará. ${governance?.deactivateClassrooms === false ? 'Las clases mantendrán su estado.' : 'Las clases activas se desactivarán de forma coherente.'}`,
          confirmationText: 'ARCHIVAR', confirmLabel: 'Archivar curso', destructive: true, icon: 'archive-outline',
        })
      : await feedback.confirm({ title: 'Restaurar curso', message: `Se restaurará el curso ${subject.name}; las clases no se reactivarán automáticamente.`, confirmLabel: 'Restaurar' })
    if (!approved) return
    try {
      await executeBulkAction({
        action: archive ? 'archive_courses' : 'restore_courses', entity: 'subjects', ids: [subject.id],
        reason: governance?.reason, deactivateClassrooms: governance?.deactivateClassrooms ?? true,
      })
      feedback.success(archive ? 'Curso archivado' : 'Curso restaurado', subject.name)
    } catch (error: unknown) {
      feedback.error('No se pudo actualizar el curso', getErrorMessage(error, 'Inténtalo de nuevo.'))
    }
  }, [executeBulkAction, feedback, requestSensitiveConfirmation])

  const transferCourseOwner = useCallback(async (subject: SubjectRow, targetTeacherId: string, reason: string) => {
    try {
      await executeBulkAction({ action: 'transfer_courses', entity: 'subjects', ids: [subject.id], targetTeacherId, reason })
      feedback.success('Curso transferido', subject.name)
    } catch (error: unknown) {
      feedback.error('No se pudo transferir el curso', getErrorMessage(error, 'Inténtalo de nuevo.'))
    }
  }, [executeBulkAction, feedback])

  const toggleClassroomActive = useCallback(async (classroom: ClassroomRow, governance?: { reason?: string }) => {
    const nextActive = classroom.active === false
    const approved = nextActive
      ? await feedback.confirm({ title: 'Activar clase', message: `Se activará la clase ${classroom.name}.`, confirmLabel: 'Activar' })
      : await requestSensitiveConfirmation({
          title: 'Desactivar clase', message: `La clase ${classroom.name} dejará de aceptar actividad.`,
          confirmationText: 'DESACTIVAR', confirmLabel: 'Desactivar clase', destructive: true, icon: 'ban-outline',
        })
    if (!approved) return
    try {
      await executeBulkAction({
        action: nextActive ? 'activate_classrooms' : 'deactivate_classrooms', entity: 'classrooms', ids: [classroom.id], reason: governance?.reason,
      })
      feedback.success(nextActive ? 'Clase activada' : 'Clase desactivada', classroom.name)
    } catch (error: unknown) {
      feedback.error('No se pudo actualizar la clase', getErrorMessage(error, 'Inténtalo de nuevo.'))
    }
  }, [executeBulkAction, feedback, requestSensitiveConfirmation])

  const copyClassroomCode = useCallback(async (classroom: ClassroomRow) => {
    if (!classroom.code) {
      feedback.warning('Sin código', 'Esta clase no tiene código disponible.')
      return
    }
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(classroom.code)
      feedback.success('Código copiado', `Código ${classroom.code} copiado al portapapeles.`)
      return
    }
    feedback.success('Código de clase', classroom.code)
  }, [feedback])

  const viewProfileActivity = useCallback((profile: ProfileRow) => router.push(`/(admin)/user/${profile.id}/activity` as Href), [router])
  const viewRelatedAudit = useCallback((targetTable: string, targetId: string | number) => {
    router.push(`/(admin)/audit?targetTable=${encodeURIComponent(targetTable)}&targetId=${encodeURIComponent(String(targetId))}` as Href)
  }, [router])

  return {
    router, executeBulkAction, toggleProfileActive, resetPassword, deleteStudentProgress,
    toggleCourseArchive, transferCourseOwner, toggleClassroomActive, copyClassroomCode,
    viewProfileActivity, viewRelatedAudit,
  }
}
