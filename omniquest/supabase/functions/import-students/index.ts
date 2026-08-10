import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, getPublicErrorMessage, logInternalError, methodNotAllowedResponse, publicError, publicErrorResponse } from '../_shared/errors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ImportRequest = {
  subjectId?: number | string
  classroomId?: number | string
  emails?: string[]
}

type ImportRow = {
  email: string
  status: 'created' | 'existing'
  studentId: string
  temporaryPassword?: string
  enrolled: boolean
  alreadyEnrolled: boolean
  emailSent: boolean
  emailError?: string
}

type EmailDeliveryResult = {
  sent: boolean
  to?: string
  mode: 'real' | 'redirect'
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

    const body = await req.json() as ImportRequest
    const subjectId = Number(body.subjectId)
    const requestedClassroomId = body.classroomId === undefined || body.classroomId === null ? null : Number(body.classroomId)
    const inputEmails = Array.isArray(body.emails) ? body.emails : []
    const emails = normalizeEmailList(inputEmails)

    if (!Number.isFinite(subjectId)) {
      return publicErrorResponse('El curso seleccionado no es válido.', 400, 'bad_request')
    }

    if (requestedClassroomId !== null && !Number.isFinite(requestedClassroomId)) {
      return publicErrorResponse('La clase seleccionada no es válida.', 400, 'bad_request')
    }

    if (emails.valid.length === 0) {
      return publicErrorResponse('Añade al menos un correo válido.', 400, 'bad_request', { invalid: emails.invalid })
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

    const { data: subject, error: subjectError } = await adminClient
      .from('subjects')
      .select('id, name, teacher_id, is_archived, active')
      .eq('id', subjectId)
      .eq('teacher_id', teacherId)
      .single()

    if (subjectError || !subject) {
      return publicErrorResponse('Curso no encontrado o no pertenece a este profesor.', 404, 'not_found')
    }

    if (subject.is_archived || subject.active === false) {
      return publicErrorResponse('No se pueden importar alumnos en un curso archivado o inactivo.', 400, 'bad_request')
    }

    const classroom = await resolveClassroom(adminClient, subjectId, requestedClassroomId)

    const { data: teacherProfile } = await adminClient
      .from('profiles')
      .select('alias')
      .eq('id', teacherId)
      .single()

    const teacherName = teacherProfile?.alias || userData.user.email || 'Tu profesor'
    const authUsersByEmail = await listAuthUsersByEmail(adminClient, emails.valid)
    const rows: ImportRow[] = []
    const failed: { email: string; reason: string }[] = []
    let created = 0
    let existing = 0
    let enrolled = 0
    let alreadyEnrolled = 0
    let emailsSent = 0
    let emailsSkipped = 0

    for (const email of emails.valid) {
      try {
        const currentUser = authUsersByEmail.get(email)
        let studentId = currentUser?.id
        let password: string | undefined
        let status: ImportRow['status'] = 'existing'

        if (!studentId) {
          password = generateTemporaryPassword()
          const alias = aliasFromEmail(email)
          const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              alias,
              role_id: 'student',
            },
          })

          if (createError || !createdUser.user) {
            throw new Error(createError?.message || 'Could not create auth user.')
          }

          studentId = createdUser.user.id
          status = 'created'
          created += 1
        } else {
          existing += 1
        }

        const alias = aliasFromEmail(email)
        const { data: profile, error: profileError } = await adminClient
          .from('profiles')
          .select('id, role_id')
          .eq('id', studentId)
          .maybeSingle()

        if (profileError) throw profileError

        if (!profile) {
          if (status === 'existing') {
            throw publicError('Ese correo pertenece a una cuenta existente sin un perfil de alumno válido.', 409, 'conflict')
          }
          const { error: profileInsertError } = await adminClient
            .from('profiles')
            .insert({ id: studentId, alias, role_id: 'student', points: 0, active: true, visibility: 'public' })
          if (profileInsertError) throw profileInsertError
        } else if (profile.role_id === 'student') {
          // Existing student accounts are safe to enrol without changing their role.
        } else if (profile.role_id === 'guest') {
          const { error: profileUpdateError } = await adminClient
            .from('profiles')
            .update({ role_id: 'student', active: true, visibility: 'public' })
            .eq('id', studentId)
          if (profileUpdateError) throw profileUpdateError
          const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(studentId, {
            user_metadata: { ...(currentUser?.user_metadata || {}), role_id: 'student' },
          })
          if (authUpdateError) throw authUpdateError
        } else if (profile.role_id === 'teacher' || profile.role_id === 'admin') {
          throw publicError('Ese correo pertenece a una cuenta de personal y no puede importarse como alumno.', 409, 'conflict')
        } else {
          throw publicError('La cuenta existente tiene un rol incompatible con la importación de alumnos.', 409, 'conflict')
        }

        const { data: existingEnrollment, error: enrollmentReadError } = await adminClient
          .from('enrollments')
          .select('id')
          .eq('student_id', studentId)
          .eq('classroom_id', classroom.id)
          .maybeSingle()

        if (enrollmentReadError) throw enrollmentReadError

        if (existingEnrollment) {
          alreadyEnrolled += 1
        } else {
          const { error: enrollmentError } = await adminClient
            .from('enrollments')
            .insert({ student_id: studentId, subject_id: subjectId, classroom_id: classroom.id })
          if (enrollmentError) throw enrollmentError
          enrolled += 1
        }

        const emailDelivery = await sendStudentEmail({
          email,
          password,
          classroomName: classroom.name,
          subjectName: subject.name,
          teacherName,
          alreadyEnrolled: Boolean(existingEnrollment),
        })
        if (emailDelivery.sent) emailsSent += 1
        else emailsSkipped += 1

        rows.push({
          email,
          status,
          studentId,
          temporaryPassword: password,
          enrolled: !existingEnrollment,
          alreadyEnrolled: Boolean(existingEnrollment),
          emailSent: emailDelivery.sent,
          emailError: emailDelivery.sent ? undefined : emailDelivery.error,
        })
      } catch (error) {
        const reason = getPublicErrorMessage(error, 'No se pudo procesar este alumno.')
        if (!(error instanceof Error && error.name === 'PublicFunctionError')) {
          logInternalError(error, { functionName: 'import-students', metadata: { email } })
        }
        failed.push({ email, reason })
      }
    }

    return json({
      total: emails.valid.length,
      enrolled,
      created,
      existing,
      alreadyEnrolled,
      invalid: emails.invalid,
      failed,
      emailsSent,
      emailsSkipped,
      students: rows,
    })
  } catch (error) {
    return errorResponse(error, 'No se pudo completar la importación.', { functionName: 'import-students' })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEmailList(input: string[]) {
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []

  input.forEach((value) => {
    const email = String(value || '').trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid.push(email)
      return
    }
    if (!seen.has(email)) {
      seen.add(email)
      valid.push(email)
    }
  })

  return { valid, invalid }
}

async function listAuthUsersByEmail(adminClient: any, emails: string[]) {
  const targets = new Set(emails)
  const users = new Map<string, { id: string; email?: string; user_metadata?: Record<string, unknown> }>()
  let page = 1
  const perPage = 1000

  while (targets.size > 0) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const pageUsers = data?.users || []
    pageUsers.forEach((user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      const email = user.email?.toLowerCase()
      if (email && targets.has(email)) {
        users.set(email, user)
        targets.delete(email)
      }
    })

    if (pageUsers.length < perPage) break
    page += 1
  }

  return users
}

function aliasFromEmail(email: string) {
  return email.split('@')[0]?.trim() || 'alumno'
}

async function resolveClassroom(adminClient: any, subjectId: number, requestedClassroomId: number | null) {
  if (requestedClassroomId !== null) {
    const { data, error } = await adminClient
      .from('classrooms')
      .select('id, name, subject_id, active')
      .eq('id', requestedClassroomId)
      .eq('subject_id', subjectId)
      .single()

    if (error || !data) {
      throw publicError('La clase seleccionada no pertenece a este curso.', 404, 'not_found')
    }

    if (data.active === false) {
      throw publicError('No se pueden importar alumnos en una clase inactiva.', 400, 'bad_request')
    }

    return data as { id: number; name: string; subject_id: number; active: boolean | null }
  }

  const { data: existingClassroom, error: existingError } = await adminClient
    .from('classrooms')
    .select('id, name, subject_id, active')
    .eq('subject_id', subjectId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError
  if (existingClassroom) {
    return existingClassroom as { id: number; name: string; subject_id: number; active: boolean | null }
  }

  const { data: generatedCode, error: codeError } = await adminClient.rpc('generate_unique_subject_code')
  if (codeError) throw codeError

  const { data: createdClassroom, error: createError } = await adminClient
    .from('classrooms')
    .insert({ subject_id: subjectId, name: 'Clase principal', code: generatedCode, active: true })
    .select('id, name, subject_id, active')
    .single()

  if (createError || !createdClassroom) {
    throw new Error(createError?.message || 'No se pudo crear la clase principal del curso.')
  }

  return createdClassroom as { id: number; name: string; subject_id: number; active: boolean | null }
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  const password = Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('')
  return `${password}1!`
}

async function sendStudentEmail({
  alreadyEnrolled,
  classroomName,
  email,
  password,
  subjectName,
  teacherName,
}: {
  alreadyEnrolled: boolean
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
  const hasNewAccount = Boolean(password)
  const baseSubject = hasNewAccount
    ? `Tu cuenta de OmniQuest para ${subjectName}`
    : `Te han inscrito en ${subjectName}`
  const subject = delivery.mode === 'redirect'
    ? `${baseSubject}`
    : baseSubject

  const text = buildStudentEmailText({
    alreadyEnrolled,
    classroomName,
    delivery,
    email,
    password,
    subjectName,
    teacherName,
  })

  const html = buildStudentEmailHtml({
    alreadyEnrolled,
    classroomName,
    delivery,
    email,
    password,
    subjectName,
    teacherName,
  })

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

  return {
    sent: true,
    to: delivery.to,
    mode: delivery.mode,
  }
}


function getEmailDeliveryMode(): 'real' | 'redirect' {
  const mode = (Deno.env.get('EMAIL_DELIVERY_MODE') || 'redirect').trim().toLowerCase()
  return mode === 'redirect' ? 'redirect' : 'real'
}

function resolveEmailDelivery(studentEmail: string): { to: string; mode: 'real' | 'redirect'; originalTo: string } {
  const mode = getEmailDeliveryMode()
  const testTo = Deno.env.get('RESEND_TEST_TO')?.trim()

  if (mode === 'redirect' && testTo) {
    return {
      to: testTo,
      mode: 'redirect',
      originalTo: studentEmail,
    }
  }

  return {
    to: studentEmail,
    mode: 'real',
    originalTo: studentEmail,
  }
}

function buildStudentEmailText({
  alreadyEnrolled,
  classroomName,
  delivery,
  email,
  password,
  subjectName,
  teacherName,
}: {
  alreadyEnrolled: boolean
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
  const hasNewAccount = Boolean(password)
  const content = hasNewAccount
    ? [
        `Hola,`,
        ``,
        `${teacherName} te ha inscrito en la clase "${classroomName}" del curso "${subjectName}" en OmniQuest.`,
        ``,
        `Se ha creado una cuenta para ti con estas credenciales:`,
        `Correo: ${email}`,
        `Contraseña temporal: ${password}`,
        ``,
        `Inicia sesion y cambia la contraseña desde Configuracion cuando puedas.`,
      ].join('\n')
    : [
        `Hola,`,
        ``,
        `${teacherName} te ha inscrito en la clase "${classroomName}" del curso "${subjectName}" en OmniQuest.`,
        ``,
        alreadyEnrolled
          ? `Ya estabas inscrito, asi que no se han creado cambios adicionales.`
          : `Puedes entrar con tu cuenta habitual para empezar a practicar.`,
      ].join('\n')

  return `${demoIntro}${content}`
}

function buildStudentEmailHtml({
  alreadyEnrolled,
  classroomName,
  delivery,
  email,
  password,
  subjectName,
  teacherName,
}: {
  alreadyEnrolled: boolean
  classroomName: string
  delivery: { to: string; mode: 'real' | 'redirect'; originalTo: string }
  email: string
  password?: string
  subjectName: string
  teacherName: string
}) {
  const hasNewAccount = Boolean(password)
  const escapedSubject = escapeHtml(subjectName)
  const escapedClassroom = escapeHtml(classroomName)
  const escapedTeacher = escapeHtml(teacherName)
  const escapedEmail = escapeHtml(email)
  const escapedPassword = escapeHtml(password || '')

  const credentialsBlock = hasNewAccount
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
          ${alreadyEnrolled
            ? 'Ya estabas inscrito, asi que no se han creado cambios adicionales.'
            : 'Puedes entrar con tu cuenta habitual para empezar a practicar.'}
        </p>
      </div>
    `

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
            <h1 style="margin:0 0 12px;color:#0f172a;font-size:24px;line-height:1.25;">Te han inscrito en ${escapedClassroom}</h1>
            <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">
              Hola, ${escapedTeacher} te ha inscrito en la clase <strong>${escapedClassroom}</strong> del curso <strong>${escapedSubject}</strong> en OmniQuest.
            </p>
            ${credentialsBlock}
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">
              ${hasNewAccount
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
