import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SupabaseLikeClient = ReturnType<typeof createClient>

async function safeDeleteEq(
  client: SupabaseLikeClient,
  table: string,
  column: string,
  value: string | number
) {
  const { error } = await client.from(table).delete().eq(column, value)
  if (error && error.code !== '42P01') {
    throw new Error(`[${table}] ${error.message}`)
  }
}

async function safeDeleteIn(
  client: SupabaseLikeClient,
  table: string,
  column: string,
  values: Array<string | number>
) {
  if (values.length === 0) return
  const { error } = await client.from(table).delete().in(column, values)
  if (error && error.code !== '42P01') {
    throw new Error(`[${table}] ${error.message}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase environment variables.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = userData.user.id

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: subjectsData, error: subjectsError } = await adminClient
      .from('subjects')
      .select('id')
      .eq('teacher_id', userId)

    if (subjectsError && subjectsError.code !== '42P01') {
      throw new Error(`[subjects] ${subjectsError.message}`)
    }

    const subjectIds = (subjectsData || []).map((subject) => subject.id as number)

    const { data: profileData } = await adminClient
      .from('profiles')
      .select('avatar')
      .eq('id', userId)
      .maybeSingle()

    let questionIds: number[] = []
    if (subjectIds.length > 0) {
      const { data: questionsData, error: questionsError } = await adminClient
        .from('questions')
        .select('id')
        .in('subject_id', subjectIds)

      if (questionsError && questionsError.code !== '42P01') {
        throw new Error(`[questions] ${questionsError.message}`)
      }

      questionIds = (questionsData || []).map((question) => question.id as number)
    }

    await safeDeleteIn(adminClient, 'attempt_history', 'question_id', questionIds)
    await safeDeleteIn(adminClient, 'answers', 'question_id', questionIds)
    await safeDeleteIn(adminClient, 'topic_scores', 'subject_id', subjectIds)
    await safeDeleteIn(adminClient, 'subject_scores', 'subject_id', subjectIds)
    await safeDeleteIn(adminClient, 'enrollments', 'subject_id', subjectIds)
    await safeDeleteIn(adminClient, 'questions', 'id', questionIds)
    await safeDeleteIn(adminClient, 'subject_topics', 'subject_id', subjectIds)
    await safeDeleteIn(adminClient, 'subjects', 'id', subjectIds)

    await safeDeleteEq(adminClient, 'attempt_history', 'student_id', userId)
    await safeDeleteEq(adminClient, 'topic_scores', 'student_id', userId)
    await safeDeleteEq(adminClient, 'subject_scores', 'student_id', userId)
    await safeDeleteEq(adminClient, 'enrollments', 'student_id', userId)
    await safeDeleteEq(adminClient, 'notification_state', 'user_id', userId)
    await safeDeleteEq(adminClient, 'user_preferences', 'user_id', userId)
    await safeDeleteEq(adminClient, 'user_notification_preferences', 'user_id', userId)

    const avatarPaths = getAvatarStoragePaths(userId, profileData?.avatar as string | null | undefined)
    await adminClient.storage.from('avatars').remove(avatarPaths)

    await safeDeleteEq(adminClient, 'profiles', 'id', userId)

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      throw new Error(`[auth.users] ${deleteAuthError.message}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error while deleting account.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function getAvatarStoragePaths(userId: string, avatar?: string | null) {
  const fallbackPaths = [`${userId}.jpg`, `${userId}.jpeg`, `${userId}.png`, `${userId}.webp`]
  if (!avatar) return fallbackPaths

  const decodedAvatar = decodeURIComponent(avatar)
  const storageMarker = '/avatars/'
  const markerIndex = decodedAvatar.indexOf(storageMarker)
  const avatarPath = markerIndex >= 0
    ? decodedAvatar.slice(markerIndex + storageMarker.length).split('?')[0]
    : decodedAvatar.split('?')[0]

  return Array.from(new Set([avatarPath, ...fallbackPaths].filter(Boolean)))
}
