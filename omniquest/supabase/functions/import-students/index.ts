import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ImportRequest = {
  subjectId?: number | string
  emails?: string[]
}

type ImportRow = {
  email: string
  status: 'created' | 'existing'
  studentId: string
  password?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return json({ error: 'Missing Supabase environment variables.' }, 500)
    }

    if (!Deno.env.get('RESEND_API_KEY') || !(Deno.env.get('MAIL_FROM') || Deno.env.get('RESEND_FROM_EMAIL'))) {
      return json({ error: 'El envio de email no esta configurado. Define RESEND_API_KEY y MAIL_FROM antes de importar alumnos.' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header.' }, 401)
    }

    const body = await req.json() as ImportRequest
    const subjectId = Number(body.subjectId)
    const inputEmails = Array.isArray(body.emails) ? body.emails : []
    const emails = normalizeEmailList(inputEmails)

    if (!Number.isFinite(subjectId)) {
      return json({ error: 'Invalid subject id.' }, 400)
    }

    if (emails.valid.length === 0) {
      return json({ error: 'No valid emails received.', invalid: emails.invalid }, 400)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'Invalid or expired session.' }, 401)
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
      return json({ error: 'Subject not found or not owned by this teacher.' }, 404)
    }

    if (subject.is_archived || subject.active === false) {
      return json({ error: 'Cannot import students into an archived or inactive subject.' }, 400)
    }

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
        if (profile?.role_id === 'teacher') {
          throw new Error('Ese correo pertenece a una cuenta de profesor.')
        }

        if (!profile) {
          const { error: profileInsertError } = await adminClient
            .from('profiles')
            .insert({
              id: studentId,
              alias,
              role_id: 'student',
              points: 0,
              active: true,
              visibility: 'private',
            })
          if (profileInsertError) throw profileInsertError
        } else if (profile.role_id !== 'student') {
          const { error: profileUpdateError } = await adminClient
            .from('profiles')
            .update({ role_id: 'student' })
            .eq('id', studentId)
          if (profileUpdateError) throw profileUpdateError
        }

        const { data: existingEnrollment, error: enrollmentReadError } = await adminClient
          .from('enrollments')
          .select('id')
          .eq('student_id', studentId)
          .eq('subject_id', subjectId)
          .maybeSingle()

        if (enrollmentReadError) throw enrollmentReadError

        if (existingEnrollment) {
          alreadyEnrolled += 1
        } else {
          const { error: enrollmentError } = await adminClient
            .from('enrollments')
            .insert({ student_id: studentId, subject_id: subjectId })
          if (enrollmentError) throw enrollmentError
          enrolled += 1
        }

        rows.push({ email, status, studentId, password })

        const emailSent = await sendStudentEmail({
          email,
          password,
          subjectName: subject.name,
          teacherName,
          alreadyEnrolled: Boolean(existingEnrollment),
        })
        if (emailSent) emailsSent += 1
        else emailsSkipped += 1
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unexpected error.'
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
      students: rows.map(({ password: _password, ...row }) => row),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected import error.'
    return json({ error: message }, 500)
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
  const users = new Map<string, { id: string; email?: string }>()
  let page = 1
  const perPage = 1000

  while (targets.size > 0) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const pageUsers = data?.users || []
    pageUsers.forEach((user: { id: string; email?: string }) => {
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

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  const password = Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('')
  return `${password}1!`
}

async function sendStudentEmail({
  alreadyEnrolled,
  email,
  password,
  subjectName,
  teacherName,
}: {
  alreadyEnrolled: boolean
  email: string
  password?: string
  subjectName: string
  teacherName: string
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('MAIL_FROM') || Deno.env.get('RESEND_FROM_EMAIL')

  if (!resendApiKey || !from) {
    return false
  }

  const hasNewAccount = Boolean(password)
  const subject = hasNewAccount
    ? `Tu cuenta de OmniQuest para ${subjectName}`
    : `Te han inscrito en ${subjectName}`

  const text = hasNewAccount
    ? [
        `Hola,`,
        ``,
        `${teacherName} te ha inscrito en la asignatura "${subjectName}" en OmniQuest.`,
        ``,
        `Se ha creado una cuenta para ti con estas credenciales:`,
        `Correo: ${email}`,
        `Contraseña temporal: ${password}`,
        ``,
        `Inicia sesión y cambia la contraseña desde Configuración cuando puedas.`,
      ].join('\n')
    : [
        `Hola,`,
        ``,
        `${teacherName} te ha inscrito en la asignatura "${subjectName}" en OmniQuest.`,
        ``,
        alreadyEnrolled
          ? `Ya estabas inscrito, así que no se han creado cambios adicionales.`
          : `Puedes entrar con tu cuenta habitual para empezar a practicar.`,
      ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject,
      text,
    }),
  })

  return response.ok
}
