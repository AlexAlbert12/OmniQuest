import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CreateTeacherRequest = {
  alias?: string
  email?: string
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: 'Missing Supabase environment variables.' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header.' }, 401)
    }

    const body = await req.json() as CreateTeacherRequest
    const email = normalizeEmail(body.email)
    const alias = String(body.alias || '').trim() || aliasFromEmail(email)
    const password = String(body.password || '').trim() || generateTemporaryPassword()

    if (!isValidEmail(email)) {
      return json({ error: 'Correo electrónico no válido.' }, 400)
    }

    if (password.length < 6) {
      return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'Sesión no válida o caducada.' }, 401)
    }

    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from('profiles')
      .select('role_id, active')
      .eq('id', userData.user.id)
      .single()

    if (adminProfileError || adminProfile?.role_id !== 'admin' || adminProfile.active === false) {
      return json({ error: 'No tienes permisos de administrador.' }, 403)
    }

    const existingUser = await findAuthUserByEmail(adminClient, email)
    if (existingUser) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          alias,
          role_id: 'teacher',
        },
      })

      if (updateError) throw updateError

      const { error: profileError } = await adminClient
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

      return json({
        status: 'existing',
        teacher: {
          id: existingUser.id,
          alias,
          email,
        },
      })
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
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

    const { error: profileError } = await adminClient
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
    const message = error instanceof Error ? error.message : 'No se pudo crear el profesor.'
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

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
