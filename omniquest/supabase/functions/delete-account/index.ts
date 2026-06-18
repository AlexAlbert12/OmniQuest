import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { data: deletionData, error: deletionError } = await adminClient.rpc(
      'delete_user_relational_data',
      { p_user_id: userId },
    )

    if (deletionError) {
      throw new Error(`[delete_user_relational_data] ${deletionError.message}`)
    }

    const avatar =
      deletionData && typeof deletionData === 'object' && !Array.isArray(deletionData)
        ? (deletionData as { avatar?: string | null }).avatar
        : null
    const avatarPaths = getAvatarStoragePaths(userId, avatar)
    const { error: avatarError } = await adminClient.storage.from('avatars').remove(avatarPaths)
    if (avatarError) {
      console.warn('[delete-account] avatar cleanup failed', avatarError.message)
    }

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
