import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, getPublicErrorMessage, logInternalError, methodNotAllowedResponse, publicError, publicErrorResponse } from '../_shared/errors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ReminderMode = 'reminder' | 'credentials'

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
  mode: ReminderMode
  temporaryPassword?: string
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return methodNotAllowedResponse()
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

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
    const reminderMode: ReminderMode = body.mode === 'credentials' ? 'credentials' : 'reminder'

    if (studentIds.length === 0) {
      return publicErrorResponse('Selecciona al menos un alumno.', 400, 'bad_request')
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
      .select('alias')
      .eq('id', teacherId)
      .single()

    const teacherName = teacherProfile?.alias || userData.user.email || 'Tu profesor'

    let subjectsQuery = adminClient
      .from('subjects')
      .select('id, name')
      .eq('teacher_id', teacherId)
      .neq('is_archived', true)

    if (requestedSubjectIds.length > 0) {
      subjectsQuery = subjectsQuery.in('id', requestedSubjectIds)
    }

    const { data: teacherSubjects, error: subjectsError } = await subjectsQuery
    if (subjectsError) throw subjectsError

    const subjectIds = (teacherSubjects || [])
      .map((subject: { id: number | null }) => subject.id)
      .filter((id: number | null): id is number => typeof id === 'number')

    if (subjectIds.length === 0) {
      return publicErrorResponse('No tienes cursos activos para esta acción.', 403, 'forbidden')
    }

    const subjectMap = new Map((teacherSubjects || []).map((subject: { id: number; name: string }) => [subject.id, subject.name]))
    const results: ReminderResult[] = []

    for (const studentId of studentIds) {
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
        let temporaryPassword: string | undefined

        if (reminderMode === 'credentials') {
          temporaryPassword = generateTemporaryPassword()
          const { error: passwordError } = await adminClient.auth.admin.updateUserById(studentId, {
            password: temporaryPassword,
          })
          if (passwordError) throw passwordError
        }

        const delivery = await sendStudentReminderEmail({
          classroomName,
          email,
          password: temporaryPassword,
          subjectName,
          teacherName,
        })

        results.push({
          studentId,
          email,
          sent: delivery.sent,
          mode: reminderMode,
          temporaryPassword,
          error: delivery.sent ? undefined : delivery.error,
        })
      } catch (error) {
        const message = getPublicErrorMessage(error, 'No se pudo procesar este alumno.')
        if (!(error instanceof Error && error.name === 'PublicFunctionError')) {
          logInternalError(error, { functionName: 'teacher-student-reminder', metadata: { studentId } })
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

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  const password = Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('')
  return `${password}1!`
}

async function sendStudentReminderEmail({
  classroomName,
  email,
  password,
  subjectName,
  teacherName,
}: {
  classroomName: string
  email: string
  password?: string
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

  const delivery = resolveEmailDelivery(email)
  const hasPassword = Boolean(password)
  const subject = hasPassword
    ? `Nuevas credenciales de OmniQuest para ${subjectName}`
    : `Recordatorio: empieza ${subjectName} en OmniQuest`

  const text = buildStudentReminderEmailText({ classroomName, delivery, email, password, subjectName, teacherName })
  const html = buildStudentReminderEmailHtml({ classroomName, delivery, email, password, subjectName, teacherName })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: delivery.to,
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    let detail = `Resend devolvio HTTP ${response.status}.`
    try {
      const payload = await response.json()
      detail = payload?.message || payload?.error || JSON.stringify(payload)
    } catch (_error) {
      try {
        detail = await response.text()
      } catch (_ignored) {
        // Keep default detail.
      }
    }

    return {
      sent: false,
      to: delivery.to,
      mode: delivery.mode,
      error: detail,
    }
  }

  return { sent: true, to: delivery.to, mode: delivery.mode }
}


function getEmailDeliveryMode(): 'real' | 'redirect' {
  const mode = (Deno.env.get('EMAIL_DELIVERY_MODE') || 'real').trim().toLowerCase()
  return mode === 'redirect' ? 'redirect' : 'real'
}

function resolveEmailDelivery(studentEmail: string): { to: string; mode: 'real' | 'redirect'; originalTo: string } {
  const mode = getEmailDeliveryMode()
  const testTo = Deno.env.get('RESEND_TEST_TO')?.trim()

  if (mode === 'redirect' && testTo) {
    return { to: testTo, mode: 'redirect', originalTo: studentEmail }
  }

  return { to: studentEmail, mode: 'real', originalTo: studentEmail }
}

function buildStudentReminderEmailText({
  classroomName,
  delivery,
  email,
  password,
  subjectName,
  teacherName,
}: {
  classroomName: string
  delivery: { to: string; mode: 'real' | 'redirect'; originalTo: string }
  email: string
  password?: string
  subjectName: string
  teacherName: string
}) {
  const demoIntro = delivery.mode === 'redirect'
    ? `[Modo demo: email original ${delivery.originalTo}; enviado a ${delivery.to}]\n\n`
    : ''
  const hasPassword = Boolean(password)

  const content = hasPassword
    ? [
        `Hola,`,
        ``,
        `${teacherName} ha reenviado tus credenciales para la clase "${classroomName}" del curso "${subjectName}" en OmniQuest.`,
        ``,
        `Correo: ${email}`,
        `Contraseña temporal: ${password}`,
        ``,
        `Inicia sesion y cambia la contraseña desde Configuracion cuando puedas.`,
      ].join('\n')
    : [
        `Hola,`,
        ``,
        `${teacherName} te recuerda que ya puedes empezar a practicar en la clase "${classroomName}" del curso "${subjectName}" en OmniQuest.`,
        ``,
        `Entra con tu cuenta y completa tus primeras preguntas cuando puedas.`,
      ].join('\n')

  return `${demoIntro}${content}`
}

function buildStudentReminderEmailHtml({
  classroomName,
  delivery,
  email,
  password,
  subjectName,
  teacherName,
}: {
  classroomName: string
  delivery: { to: string; mode: 'real' | 'redirect'; originalTo: string }
  email: string
  password?: string
  subjectName: string
  teacherName: string
}) {
  const escapedSubject = escapeHtml(subjectName)
  const escapedClassroom = escapeHtml(classroomName)
  const escapedTeacher = escapeHtml(teacherName)
  const escapedEmail = escapeHtml(email)
  const escapedPassword = escapeHtml(password || '')
  const hasPassword = Boolean(password)

  const credentialsBlock = hasPassword
    ? `
      <div style="margin:22px 0;border:1px solid #dbeafe;background:#eff6ff;border-radius:16px;padding:18px;">
        <p style="margin:0 0 10px;color:#1e3a8a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">Credenciales de acceso</p>
        <p style="margin:0 0 8px;color:#0f172a;font-size:15px;"><strong>Correo:</strong> ${escapedEmail}</p>
        <p style="margin:0;color:#0f172a;font-size:15px;"><strong>Contraseña temporal:</strong> <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:#dbeafe;border-radius:8px;padding:4px 8px;">${escapedPassword}</span></p>
      </div>
    `
    : `
      <div style="margin:22px 0;border:1px solid #dcfce7;background:#f0fdf4;border-radius:16px;padding:18px;">
        <p style="margin:0;color:#166534;font-size:15px;line-height:1.6;">
          Ya puedes entrar con tu cuenta y completar tus primeras preguntas.
        </p>
      </div>
    `

  const title = hasPassword ? 'Tus nuevas credenciales de OmniQuest' : 'Recordatorio para empezar en OmniQuest'

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>OmniQuest</title>
      </head>
      <body style="margin:0;background:#07162d;padding:28px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28);">
          <div style="background:#ffffff;padding:24px 26px 10px;color:#0f172a;">
            <div style="font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#0f172a;">
              <span style="font-size:28px;vertical-align:-2px;">🚀</span>
              <span style="color:#0f172a;">Omni</span><span style="color:#38bdf8;">Quest</span>
            </div>
            <p style="margin:8px 0 0;color:#475569;font-size:15px;line-height:1.45;">Aprende practicando con retos creados por tus profesores.</p>
          </div>
          <div style="padding:12px 26px 26px;">
            <h1 style="margin:0 0 12px;color:#0f172a;font-size:24px;line-height:1.25;">${title}</h1>
            <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">
              Hola, ${escapedTeacher} te ha escrito sobre la clase <strong>${escapedClassroom}</strong> del curso <strong>${escapedSubject}</strong> en OmniQuest.
            </p>
            ${credentialsBlock}
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">
              ${hasPassword
                ? 'Inicia sesion y cambia la contraseña desde Configuracion cuando puedas.'
                : 'Entra en OmniQuest con tu cuenta y empieza a practicar cuando quieras.'}
            </p>
            <hr style="border:0;border-top:1px solid #e2e8f0;margin:26px 0;" />
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
              Este mensaje se ha generado automaticamente desde OmniQuest.
            </p>
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
