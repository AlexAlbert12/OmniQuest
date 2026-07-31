import { useCallback } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'
import type { AdminConfirmationRequester } from '../shared/AdminTypedConfirmation'
import { invokeAdminAction, runAdminBulkAction } from '../api/adminApi'
import type { AdminBulkAction, AdminData, ClassroomRow, ProfileRow, SubjectRow } from '../types/admin'
import { confirmActionAsync, showAlert } from '../utils/adminUtils'

export function useAdminActions(data: AdminData, requestConfirmation?: AdminConfirmationRequester) {
  const router = useRouter()
  const requestSensitiveConfirmation = useCallback(async (options: Parameters<AdminConfirmationRequester>[0]) => {
    if (requestConfirmation) return requestConfirmation(options)
    return confirmActionAsync(options.title, `${options.message}\n\nEscribe ${options.confirmationText} en la confirmación para continuar.`)
  }, [requestConfirmation])

  const executeBulkAction = useCallback(async (options: {
    action: AdminBulkAction
    entity: 'profiles' | 'subjects' | 'classrooms'
    ids: Array<string | number>
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
      showAlert('Acción bloqueada', 'No puedes desactivar tu propia cuenta administradora.')
      return
    }
    const approved = nextActive
      ? await confirmActionAsync('Activar usuario', `Se activará la cuenta de ${profile.alias}.`)
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
    } catch (error: any) {
      showAlert('No se pudo actualizar', error.message)
    }
  }, [data.portalContext?.user_id, executeBulkAction, requestSensitiveConfirmation])

  const resetPassword = useCallback(async (profile: ProfileRow) => {
    if (!profile.email) return showAlert('Sin correo', 'Este usuario no tiene correo guardado en profiles.email.')
    const approved = await requestSensitiveConfirmation({
      title: 'Restablecer contraseña',
      message: `Se enviará un enlace de recuperación a ${profile.email}. Esta acción quedará registrada en auditoría.`,
      confirmationText: 'RESET', confirmLabel: 'Enviar enlace', destructive: true, icon: 'key-outline',
    })
    if (!approved) return
    try {
      await invokeAdminAction('admin-reset-password', { profileId: profile.id })
      showAlert('Correo enviado', `Se ha enviado un enlace de restablecimiento a ${profile.email}.`)
    } catch (error: any) {
      showAlert('No se pudo restablecer', error.message)
    }
  }, [requestSensitiveConfirmation])

  const deleteStudentProgress = useCallback(async (student: ProfileRow) => {
    const approved = await requestSensitiveConfirmation({
      title: 'Eliminar progreso académico',
      message: `Se eliminarán puntuaciones, progreso por tema e intentos de ${student.alias}. Esta acción no se puede deshacer.`,
      confirmationText: 'ELIMINAR', confirmLabel: 'Eliminar progreso', destructive: true, icon: 'trash-outline',
    })
    if (!approved) return
    try {
      await invokeAdminAction('admin-delete-student-progress', { studentId: student.id })
      await data.refresh()
      showAlert('Progreso eliminado', `El progreso de ${student.alias} se ha eliminado.`)
    } catch (error: any) {
      showAlert('No se pudo eliminar progreso', error.message)
    }
  }, [data, requestSensitiveConfirmation])

  const toggleCourseArchive = useCallback(async (subject: SubjectRow, governance?: { reason?: string; deactivateClassrooms?: boolean }) => {
    const archive = !subject.is_archived
    const approved = archive
      ? await requestSensitiveConfirmation({
          title: 'Archivar curso',
          message: `El curso ${subject.name} se archivará. ${governance?.deactivateClassrooms === false ? 'Las clases mantendrán su estado.' : 'Las clases activas se desactivarán de forma coherente.'}`,
          confirmationText: 'ARCHIVAR', confirmLabel: 'Archivar curso', destructive: true, icon: 'archive-outline',
        })
      : await confirmActionAsync('Restaurar curso', `Se restaurará el curso ${subject.name}; las clases no se reactivarán automáticamente.`)
    if (!approved) return
    try {
      await executeBulkAction({
        action: archive ? 'archive_courses' : 'restore_courses', entity: 'subjects', ids: [subject.id],
        reason: governance?.reason, deactivateClassrooms: governance?.deactivateClassrooms ?? true,
      })
    } catch (error: any) {
      showAlert('No se pudo actualizar el curso', error.message)
    }
  }, [executeBulkAction, requestSensitiveConfirmation])

  const transferCourseOwner = useCallback(async (subject: SubjectRow, targetTeacherId: string, reason: string) => {
    try {
      await executeBulkAction({ action: 'transfer_courses', entity: 'subjects', ids: [subject.id], targetTeacherId, reason })
    } catch (error: any) {
      showAlert('No se pudo transferir el curso', error.message)
    }
  }, [executeBulkAction])

  const toggleClassroomActive = useCallback(async (classroom: ClassroomRow, governance?: { reason?: string }) => {
    const nextActive = classroom.active === false
    const approved = nextActive
      ? await confirmActionAsync('Activar clase', `Se activará la clase ${classroom.name}.`)
      : await requestSensitiveConfirmation({
          title: 'Desactivar clase', message: `La clase ${classroom.name} dejará de aceptar actividad.`,
          confirmationText: 'DESACTIVAR', confirmLabel: 'Desactivar clase', destructive: true, icon: 'ban-outline',
        })
    if (!approved) return
    try {
      await executeBulkAction({
        action: nextActive ? 'activate_classrooms' : 'deactivate_classrooms', entity: 'classrooms', ids: [classroom.id], reason: governance?.reason,
      })
    } catch (error: any) {
      showAlert('No se pudo actualizar la clase', error.message)
    }
  }, [executeBulkAction, requestSensitiveConfirmation])

  const copyClassroomCode = useCallback(async (classroom: ClassroomRow) => {
    if (!classroom.code) return showAlert('Sin código', 'Esta clase no tiene código disponible.')
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(classroom.code)
      return showAlert('Código copiado', `Código ${classroom.code} copiado al portapapeles.`)
    }
    showAlert('Código de clase', classroom.code)
  }, [])

  const viewProfileActivity = useCallback((profile: ProfileRow) => router.push(`/(admin)/user/${profile.id}/activity` as any), [router])
  const viewRelatedAudit = useCallback((targetTable: string, targetId: string | number) => {
    router.push(`/(admin)/audit?targetTable=${encodeURIComponent(targetTable)}&targetId=${encodeURIComponent(String(targetId))}` as any)
  }, [router])

  return {
    router, executeBulkAction, toggleProfileActive, resetPassword, deleteStudentProgress,
    toggleCourseArchive, transferCourseOwner, toggleClassroomActive, copyClassroomCode,
    viewProfileActivity, viewRelatedAudit,
  }
}
