import type { AdminPushDeliveryStatus } from '../components/admin/types/admin'

const STATUS_LABELS: Record<AdminPushDeliveryStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  waiting_receipt: 'Esperando confirmación',
  completed: 'Entregada',
  failed: 'Fallida',
  skipped: 'Omitida',
  cancelled: 'Cancelada',
}

const ERROR_LABELS: Record<string, string> = {
  push_disabled: 'Notificaciones desactivadas por el usuario',
  no_active_tokens: 'Sin dispositivo registrado',
  DeviceNotRegistered: 'Dispositivo ya no registrado',
  MessageRateExceeded: 'Límite temporal de envíos',
  receipt_expired: 'Sin confirmación del proveedor',
  worker_error: 'Error interno de procesamiento',
  all_devices_failed: 'No se pudo entregar en ningún dispositivo',
  all_receipts_failed: 'Ningún dispositivo confirmó la entrega',
  expo_retryable_request: 'Error temporal del proveedor',
  expo_request_error: 'El proveedor rechazó el envío',
  expo_ticket_error: 'El proveedor rechazó el dispositivo',
  expo_message_rate_exceeded: 'Límite temporal de envíos',
  user_rate_limited: 'Límite temporal para este destinatario',
  notification_deleted: 'La notificación fue eliminada',
  notification_missing: 'La notificación ya no existe',
}

const TYPE_LABELS: Record<string, string> = {
  announcement: 'Aviso',
  enrollment: 'Matrícula',
  student_activity: 'Actividad del alumno',
  achievement: 'Logro',
  new_class: 'Contenido del curso',
  manual_review: 'Revisión manual',
  task: 'Tarea',
}

export function getAdminPushStatusLabel(status: string) { return STATUS_LABELS[status as AdminPushDeliveryStatus] || 'Estado desconocido' }
export function getAdminPushErrorLabel(code?: string | null, skipReason?: string | null) { const key = skipReason || code; return key ? ERROR_LABELS[key] || 'Incidencia de entrega' : null }
export function getAdminPushTypeLabel(type: string) { return TYPE_LABELS[type] || 'Notificación' }
export function getAdminPushRoleLabel(role: string) { if (role === 'teacher') return 'Profesor'; if (role === 'admin') return 'Administrador'; if (role === 'student' || role === 'guest') return 'Alumno'; return 'Usuario' }
export function getAdminPushPriorityLabel(priority: string) { if (priority === 'high') return 'Alta'; if (priority === 'low') return 'Baja'; return 'Normal' }
export function getAdminPushPlatformLabel(platform: string) { return platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Dispositivo' }
export function formatAdminPushDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
export function formatAdminPushRelative(value?: string | null) { if (!value) return 'Sin actividad'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Sin actividad'; const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)); if (diffMinutes < 1) return 'Ahora'; if (diffMinutes < 60) return `Hace ${diffMinutes} min`; const hours = Math.floor(diffMinutes / 60); if (hours < 24) return `Hace ${hours} h`; const days = Math.floor(hours / 24); return days === 1 ? 'Ayer' : `Hace ${days} días` }
