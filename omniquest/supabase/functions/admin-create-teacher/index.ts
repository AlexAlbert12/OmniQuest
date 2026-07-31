import { errorResponse, methodNotAllowedResponse, corsHeaders, getAdminContext, isResponse, json, readJsonBody, writeAdminAudit, writeAdminUserHistory } from '../_shared/admin.ts'

type CreateTeacherRequest = {
  alias?: string
  email?: string
  password?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const context = await getAdminContext(req, 'users.manage')
    if (isResponse(context)) return context

    const body = await readJsonBody<CreateTeacherRequest>(req)
    const email = normalizeEmail(body.email)
    const alias = String(body.alias || '').trim() || aliasFromEmail(email)
    const password = String(body.password || '').trim() || generateTemporaryPassword()

    if (!isValidEmail(email)) {
      return json({ error: 'Correo electrónico no válido.' }, 400)
    }

    if (password.length < 6) {
      return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    }

    const existingUser = await findAuthUserByEmail(context.adminClient, email)
    if (existingUser) {
      const { error: updateError } = await context.adminClient.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          alias,
          role_id: 'teacher',
        },
      })

      if (updateError) throw updateError

      const { error: profileError } = await context.adminClient
        .from('profiles')
        .upsert({
          id: existingUser.id,
          email,
          alias,
          role_id: 'teacher',
          active: true,
          visibility: 'private',
        })

      if (profileError) throw profileError

      await writeAdminUserHistory(context.adminClient, {
        action: 'admin.teacher.update_existing', adminUserId: context.adminUserId, profileId: existingUser.id,
        reason: 'Alta o actualización docente', before: { role_id: 'teacher' }, after: { role_id: 'teacher', active: true, alias },
      })

      await writeAdminAudit(context.adminClient, {
        action: 'admin.teacher.update_existing',
        adminUserId: context.adminUserId,
        targetTable: 'profiles',
        targetId: existingUser.id,
        metadata: {
          alias,
          email,
          role_id: 'teacher',
          source: 'admin-create-teacher',
        },
      })

      return json({
        status: 'existing',
        teacher: {
          id: existingUser.id,
          alias,
          email,
        },
      })
    }

    const { data: createdUser, error: createError } = await context.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        alias,
        role_id: 'teacher',
      },
    })

    if (createError || !createdUser.user) {
      throw createError || new Error('No se pudo crear el usuario docente.')
    }

    const { error: profileError } = await context.adminClient
      .from('profiles')
      .upsert({
        id: createdUser.user.id,
        email,
        alias,
        role_id: 'teacher',
        points: 0,
        active: true,
        visibility: 'private',
      })

    if (profileError) throw profileError

    await writeAdminUserHistory(context.adminClient, {
      action: 'admin.teacher.create', adminUserId: context.adminUserId, profileId: createdUser.user.id,
      reason: 'Creación de cuenta docente', before: {}, after: { role_id: 'teacher', active: true, alias },
    })

    await writeAdminAudit(context.adminClient, {
      action: 'admin.teacher.create',
      adminUserId: context.adminUserId,
      targetTable: 'profiles',
      targetId: createdUser.user.id,
      metadata: {
        alias,
        email,
        role_id: 'teacher',
        source: 'admin-create-teacher',
      },
    })

    return json({
      status: 'created',
      teacher: {
        id: createdUser.user.id,
        alias,
        email,
      },
      temporaryPassword: password,
    })
  } catch (error) {
    return errorResponse(error, 'No se pudo crear el profesor.', { functionName: 'admin-create-teacher' })
  }
})

async function findAuthUserByEmail(adminClient: any, email: string) {
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const found = (data?.users || []).find((user: { email?: string }) => normalizeEmail(user.email) === email)
    if (found) return found
    if (!data?.users || data.users.length < perPage) return null
    page += 1
  }
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function aliasFromEmail(email: string) {
  return email.split('@')[0]?.trim() || 'profesor'
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  const password = Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('')
  return `${password}1!`
}
