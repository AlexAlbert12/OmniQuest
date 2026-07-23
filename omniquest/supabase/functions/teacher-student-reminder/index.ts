import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  errorResponse,
  getPublicErrorMessage,
  logInternalError,
  methodNotAllowedResponse,
  publicError,
  publicErrorResponse,
} from '../_shared/errors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ReminderMode = 'reminder' | 'recovery'

type ReminderRequest = {
  studentId?: string
  studentIds?: string[]
  subjectIds?: Array<number | string>
  mode?: ReminderMode
}

type EmailDeliveryResult = {
  sent: boolean
  to?: string
  mode: 'real' | 'redirect'
  error?: string
}

type ReminderResult = {
  studentId: string
  email?: string
  sent: boolean
  emailSent?: boolean
  notificationQueued?: boolean
  mode: ReminderMode
  recoveryExpiresAt?: string
  error?: string
}

type RecoveryReservation = {
  request_id: string
  expires_at: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return publicErrorResponse('El servicio no está configurado correctamente.', 500, 'service_unavailable')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return publicErrorResponse('Necesitas iniciar sesión para continuar.', 401, 'unauthorized')
    }

    const body = await req.json() as ReminderRequest
    const studentIds = normalizeIds([body.studentId, ...(Array.isArray(body.studentIds) ? body.studentIds : [])])
    const requestedSubjectIds = normalizeNumberIds(body.subjectIds || [])
    const reminderMode: ReminderMode = body.mode === 'recovery' ? 'recovery' : 'reminder'

    if (studentIds.length === 0) {
      return publicErrorResponse('Selecciona al menos un alumno.', 400, 'bad_request')
    }

    if (reminderMode === 'recovery' && studentIds.length > 1) {
      return publicErrorResponse('Solicita la recuperación de contraseña de un alumno cada vez.', 400, 'bad_request')
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return publicErrorResponse('Tu sesión no es válida o ha caducado. Vuelve a iniciar sesión.', 401, 'unauthorized')
    }

    const teacherId = userData.user.id
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: teacherProfile } = await adminClient
      .from('profiles')
      .select('alias, role_id, active')
      .eq('id', teacherId)
      .single()

    if (teacherProfile?.role_id !== 'teacher' || teacherProfile.active === false) {
      return publicErrorResponse('Esta acción requiere una cuenta de profesor activa.', 403, 'forbidden')
    }

    const teacherName = teacherProfile.alias || userData.user.email || 'Tu profesor'

    let subjectsQuery = adminClient
      .from('subjects')
      .select('id, name')
      .eq('teacher_id', teacherId)
      .neq('is_archived', true)

    if (requestedSubjectIds.length > 0) subjectsQuery = subjectsQuery.in('id', requestedSubjectIds)

    const { data: teacherSubjects, error: subjectsError } = await subjectsQuery
    if (subjectsError) throw subjectsError

    const subjectIds = (teacherSubjects || [])
      .map((subject: { id: number | null }) => subject.id)
      .filter((id: number | null): id is number => typeof id === 'number')

    if (subjectIds.length === 0) {
      return publicErrorResponse('No tienes cursos activos para esta acción.', 403, 'forbidden')
    }

    const subjectMap = new Map(
      (teacherSubjects || []).map((subject: { id: number; name: string }) => [subject.id, subject.name]),
    )
    const results: ReminderResult[] = []

    for (const studentId of studentIds) {
      let recoveryRequestId: string | null = null

      try {
        const { data: enrollment, error: enrollmentError } = await adminClient
          .from('enrollments')
          .select('subject_id, classroom_id')
          .eq('student_id', studentId)
          .in('subject_id', subjectIds)
          .order('joined_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (enrollmentError) throw enrollmentError
        if (!enrollment) {
          throw publicError('El alumno no pertenece a ningún curso de este profesor.', 403, 'forbidden')
        }

        const subjectName = subjectMap.get(enrollment.subject_id) || 'tu curso'
        const classroomName = await getClassroomName(adminClient, enrollment.classroom_id)
        const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(studentId)
        if (authUserError || !authUser?.user?.email) {
          throw publicError('No se pudo recuperar el correo del alumno.', 404, 'not_found')
        }

        const email = authUser.user.email
        let recoveryLink: string | undefined
        let recoveryExpiresAt: string | undefined

        if (reminderMode === 'recovery') {
          const { data: reservationData, error: reservationError } = await adminClient.rpc(
            'reserve_teacher_student_recovery_request',
            {
              p_teacher_id: teacherId,
              p_student_id: studentId,
              p_subject_id: enrollment.subject_id,
              p_classroom_id: enrollment.classroom_id,
            },
          )
          if (reservationError) {
            const message = reservationError.message || 'No se pudo reservar la recuperación.'
            if (message.includes('15 minutes') || message.includes('Daily recovery request limit')) {
              throw publicError(
                message.includes('15 minutes')
                  ? 'Ya se envió un enlace recientemente. Espera 15 minutos antes de volver a intentarlo.'
                  : 'Se alcanzó el límite diario de enlaces de recuperación para este alumno.',
                429,
                'rate_limited',
              )
            }
            throw reservationError
          }

          const reservation = reservationData as RecoveryReservation | null
          recoveryRequestId = reservation?.request_id || null
          recoveryExpiresAt = reservation?.expires_at
          if (!recoveryRequestId) throw new Error('Recovery request reservation did not return an identifier.')

          const redirectTo = getRecoveryRedirectTo()
          if (!redirectTo) {
            throw publicError(
              'La recuperación no está configurada. Define PASSWORD_RESET_REDIRECT_TO en Supabase Functions.',
              500,
              'service_unavailable',
            )
          }
          const { data: recoveryData, error: recoveryError } = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: { redirectTo },
          })
          if (recoveryError) throw recoveryError

          recoveryLink = recoveryData?.properties?.action_link
          if (!recoveryLink) throw new Error('Supabase did not return a recovery link.')
        }

        const delivery = await sendStudentEmail({
          classroomName,
          email,
          mode: reminderMode,
          recoveryLink,
          subjectName,
          teacherName,
        })

        if (reminderMode === 'recovery' && !delivery.sent) {
          await finishRecoveryRequest(adminClient, recoveryRequestId, 'failed', delivery.mode, 'email_delivery_failed', delivery.error)
          throw publicError(
            delivery.error || 'No se pudo enviar el enlace de recuperación.',
            503,
            'service_unavailable',
          )
        }

        if (reminderMode === 'recovery') {
          await finishRecoveryRequest(adminClient, recoveryRequestId, 'sent', delivery.mode)
        }

        const notificationTitle = reminderMode === 'recovery'
          ? 'Enlace de recuperación enviado'
          : `Tienes una actividad pendiente en ${subjectName}`
        const notificationBody = reminderMode === 'recovery'
          ? `${teacherName} ha solicitado un enlace seguro para que restablezcas tu contraseña. Revisa tu correo; caduca en 30 minutos.`
          : `${teacherName} te recuerda continuar tu progreso en ${classroomName}.`
        const actionUrl = reminderMode === 'recovery'
          ? '/forgot-password'
          : `/(student)/class/${enrollment.subject_id}${enrollment.classroom_id ? `?classroomId=${enrollment.classroom_id}` : ''}`

        const { data: notificationId, error: notificationError } = await adminClient.rpc('create_notification', {
          p_user_id: studentId,
          p_audience: 'student',
          p_type: 'announcement',
          p_title: notificationTitle,
          p_description: notificationBody,
          p_icon: reminderMode === 'recovery' ? 'key-outline' : 'notifications-outline',
          p_color: '#7C5CFF',
          p_action_url: actionUrl,
          p_related_table: 'enrollments',
          p_related_id: `${studentId}:${enrollment.subject_id}:${enrollment.classroom_id ?? 'general'}`,
          p_metadata: {
            teacher_id: teacherId,
            subject_id: enrollment.subject_id,
            classroom_id: enrollment.classroom_id,
            reminder_mode: reminderMode,
            preference_category: 'activity',
            push_priority: reminderMode === 'recovery' ? 'high' : 'normal',
            ...(recoveryRequestId ? { recovery_request_id: recoveryRequestId } : {}),
          },
          p_fingerprint: reminderMode === 'recovery'
            ? `teacher-recovery:${recoveryRequestId}`
            : `teacher-reminder:${teacherId}:${studentId}:${enrollment.subject_id}:reminder`,
        })
        if (notificationError) {
          if (reminderMode === 'recovery') {
            logInternalError(notificationError, {
              functionName: 'teacher-student-reminder',
              metadata: { studentId, reminderMode, phase: 'persistent_notification' },
            })
          } else {
            throw notificationError
          }
        }

        const notificationQueued = Boolean(notificationId) && !notificationError
        const sent = reminderMode === 'recovery'
          ? delivery.sent
          : delivery.sent || notificationQueued

        results.push({
          studentId,
          email,
          sent,
          emailSent: delivery.sent,
          notificationQueued,
          mode: reminderMode,
          recoveryExpiresAt,
          error: sent ? undefined : delivery.error || 'No se pudo entregar el recordatorio.',
        })
      } catch (error) {
        if (reminderMode === 'recovery' && recoveryRequestId) {
          await finishRecoveryRequest(
            adminClient,
            recoveryRequestId,
            'failed',
            null,
            'recovery_processing_failed',
            error instanceof Error ? error.message : String(error),
          ).catch(() => undefined)
        }

        const message = getPublicErrorMessage(error, 'No se pudo procesar este alumno.')
        if (!(error instanceof Error && error.name === 'PublicFunctionError')) {
          logInternalError(error, { functionName: 'teacher-student-reminder', metadata: { studentId, reminderMode } })
        }
        results.push({ studentId, sent: false, mode: reminderMode, error: message })
      }
    }

    const sent = results.filter((result) => result.sent).length
    const failed = results.length - sent
    return json({ total: results.length, sent, failed, results })
  } catch (error) {
    return errorResponse(error, 'No se pudo enviar el recordatorio.', { functionName: 'teacher-student-reminder' })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeIds(values: Array<string | undefined>) {
  const seen = new Set<string>()
  const ids: string[] = []
  values.forEach((value) => {
    const id = String(value || '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  })
  return ids
}

function normalizeNumberIds(values: Array<number | string>) {
  const seen = new Set<number>()
  const ids: number[] = []
  values.forEach((value) => {
    const id = Number(value)
    if (!Number.isFinite(id) || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  })
  return ids
}

async function getClassroomName(adminClient: any, classroomId: number | null) {
  if (typeof classroomId !== 'number') return 'Clase principal'
  const { data } = await adminClient
    .from('classrooms')
    .select('name')
    .eq('id', classroomId)
    .maybeSingle()
  return data?.name || 'Clase principal'
}

async function finishRecoveryRequest(
  adminClient: any,
  requestId: string | null,
  status: 'sent' | 'failed',
  deliveryMode?: string | null,
  errorCode?: string | null,
  errorMessage?: string | null,
) {
  if (!requestId) return
  const { error } = await adminClient.rpc('finish_teacher_student_recovery_request', {
    p_request_id: requestId,
    p_status: status,
    p_delivery_mode: deliveryMode || null,
    p_error_code: errorCode || null,
    p_error_message: errorMessage || null,
  })
  if (error) throw error
}

function getRecoveryRedirectTo() {
  const explicit = Deno.env.get('PASSWORD_RESET_REDIRECT_TO')?.trim()
    || Deno.env.get('PASSWORD_RECOVERY_REDIRECT_URL')?.trim()
  if (explicit) return explicit

  const siteUrl = Deno.env.get('SITE_URL')?.trim()
  if (!siteUrl) return undefined

  try {
    return new URL('/update-password', siteUrl).toString()
  } catch {
    return siteUrl
  }
}

async function sendStudentEmail({
  classroomName,
  email,
  mode,
  recoveryLink,
  subjectName,
  teacherName,
}: {
  classroomName: string
  email: string
  mode: ReminderMode
  recoveryLink?: string
  subjectName: string
  teacherName: string
}): Promise<EmailDeliveryResult> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('MAIL_FROM') || Deno.env.get('RESEND_FROM_EMAIL')
  const deliveryMode = getEmailDeliveryMode()
  const testTo = Deno.env.get('RESEND_TEST_TO')?.trim()

  if (!resendApiKey || !from) {
    return {
      sent: false,
      mode: deliveryMode,
      error: 'Email no enviado: faltan RESEND_API_KEY o MAIL_FROM en Supabase Functions.',
    }
  }

  if (deliveryMode === 'redirect' && !testTo) {
    return {
      sent: false,
      mode: 'redirect',
      error: 'Email no enviado: EMAIL_DELIVERY_MODE=redirect requiere RESEND_TEST_TO.',
    }
  }

  if (mode === 'recovery' && !recoveryLink) {
    return { sent: false, mode: deliveryMode, error: 'No se pudo generar el enlace seguro de recuperación.' }
  }

  const delivery = resolveEmailDelivery(email)
  const subject = mode === 'recovery'
    ? 'Restablece tu contraseña de OmniQuest'
    : `Recordatorio: continúa ${subjectName} en OmniQuest`
  const text = buildStudentEmailText({ classroomName, delivery, mode, recoveryLink, subjectName, teacherName })
  const html = buildStudentEmailHtml({ classroomName, delivery, mode, recoveryLink, subjectName, teacherName })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: delivery.to, subject, text, html }),
  })

  if (!response.ok) {
    let detail = `Resend devolvió HTTP ${response.status}.`
    try {
      const payload = await response.json()
      detail = payload?.message || payload?.error || JSON.stringify(payload)
    } catch {
      detail = await response.text().catch(() => detail)
    }
    return { sent: false, to: delivery.to, mode: delivery.mode, error: detail }
  }

  return { sent: true, to: delivery.to, mode: delivery.mode }
}

function getEmailDeliveryMode(): 'real' | 'redirect' {
  return (Deno.env.get('EMAIL_DELIVERY_MODE') || 'real').trim().toLowerCase() === 'redirect'
    ? 'redirect'
    : 'real'
}

function resolveEmailDelivery(studentEmail: string) {
  const mode = getEmailDeliveryMode()
  const testTo = Deno.env.get('RESEND_TEST_TO')?.trim()
  return mode === 'redirect' && testTo
    ? { to: testTo, mode: 'redirect' as const, originalTo: studentEmail }
    : { to: studentEmail, mode: 'real' as const, originalTo: studentEmail }
}

function buildStudentEmailText({
  classroomName,
  delivery,
  mode,
  recoveryLink,
  subjectName,
  teacherName,
}: {
  classroomName: string
  delivery: { to: string; mode: 'real' | 'redirect'; originalTo: string }
  mode: ReminderMode
  recoveryLink?: string
  subjectName: string
  teacherName: string
}) {
  const demoIntro = delivery.mode === 'redirect'
    ? `[Modo demo: email original ${delivery.originalTo}; enviado a ${delivery.to}]\n\n`
    : ''

  const content = mode === 'recovery'
    ? [
        'Hola,',
        '',
        `${teacherName} ha solicitado un enlace seguro para restablecer tu contraseña de OmniQuest.`,
        '',
        'Abre este enlace para crear una contraseña nueva:',
        recoveryLink,
        '',
        'El enlace es de un solo uso y caduca en 30 minutos. Si no esperabas este mensaje, ignóralo.',
      ].join('\n')
    : [
        'Hola,',
        '',
        `${teacherName} te recuerda que puedes continuar practicando en la clase "${classroomName}" del curso "${subjectName}" en OmniQuest.`,
        '',
        'Entra con tu cuenta y continúa tu progreso cuando puedas.',
      ].join('\n')

  return `${demoIntro}${content}`
}

function buildStudentEmailHtml({
  classroomName,
  delivery,
  mode,
  recoveryLink,
  subjectName,
  teacherName,
}: {
  classroomName: string
  delivery: { to: string; mode: 'real' | 'redirect'; originalTo: string }
  mode: ReminderMode
  recoveryLink?: string
  subjectName: string
  teacherName: string
}) {
  const escapedSubject = escapeHtml(subjectName)
  const escapedClassroom = escapeHtml(classroomName)
  const escapedTeacher = escapeHtml(teacherName)
  const escapedLink = escapeHtml(recoveryLink || '')
  const recovery = mode === 'recovery'

  const actionBlock = recovery
    ? `
      <div style="margin:22px 0;border:1px solid #ddd6fe;background:#f5f3ff;border-radius:16px;padding:18px;text-align:center;">
        <p style="margin:0 0 16px;color:#4c1d95;font-size:14px;line-height:1.6;">Crea una contraseña nueva mediante un enlace de un solo uso.</p>
        <a href="${escapedLink}" style="display:inline-block;background:#6d47f6;color:#ffffff;text-decoration:none;font-weight:800;border-radius:12px;padding:13px 20px;">Restablecer contraseña</a>
        <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">El enlace caduca en 30 minutos. OmniQuest nunca enviará una contraseña por correo.</p>
      </div>
    `
    : `
      <div style="margin:22px 0;border:1px solid #dcfce7;background:#f0fdf4;border-radius:16px;padding:18px;">
        <p style="margin:0;color:#166534;font-size:15px;line-height:1.6;">Ya puedes entrar con tu cuenta y continuar tus actividades.</p>
      </div>
    `

  return `
    <!doctype html>
    <html lang="es">
      <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>OmniQuest</title></head>
      <body style="margin:0;background:#07162d;padding:28px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28);">
          <div style="padding:24px 26px 10px;">
            <div style="font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.15;"><span style="font-size:28px;vertical-align:-2px;">🚀</span> Omni<span style="color:#38bdf8;">Quest</span></div>
            <p style="margin:8px 0 0;color:#475569;font-size:15px;line-height:1.45;">Aprende practicando con retos creados por tus profesores.</p>
          </div>
          <div style="padding:12px 26px 26px;">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${recovery ? 'Restablece tu contraseña' : 'Continúa tu aprendizaje'}</h1>
            <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">
              ${recovery
                ? `${escapedTeacher} ha solicitado un enlace seguro para recuperar tu acceso a OmniQuest.`
                : `${escapedTeacher} te recuerda continuar en la clase <strong>${escapedClassroom}</strong> del curso <strong>${escapedSubject}</strong>.`}
            </p>
            ${actionBlock}
            ${delivery.mode === 'redirect' ? `<p style="color:#b45309;font-size:12px;">Modo demo: destinatario original ${escapeHtml(delivery.originalTo)}.</p>` : ''}
            <hr style="border:0;border-top:1px solid #e2e8f0;margin:26px 0;" />
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Este mensaje se ha generado automáticamente desde OmniQuest.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
