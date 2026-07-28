import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'

const BUCKET = 'question-media'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    const cronSecret = Deno.env.get('QUESTION_MEDIA_CLEANUP_SECRET')?.trim()
    if (!supabaseUrl || !serviceRoleKey) {
      return publicErrorResponse('El limpiador multimedia no está configurado.', 500, 'service_unavailable')
    }

    const authorization = req.headers.get('Authorization') || ''
    const suppliedSecret = req.headers.get('x-cron-secret')?.trim()
    const authorized = authorization === `Bearer ${serviceRoleKey}`
      || Boolean(cronSecret && suppliedSecret === cronSecret)
    if (!authorized) return publicErrorResponse('No autorizado.', 401, 'unauthorized')

    const body = await req.json().catch(() => ({})) as { limit?: number; olderThanHours?: number }
    const limit = Math.max(1, Math.min(Number(body.limit) || 200, 1000))
    const olderThanHours = Math.max(1, Math.min(Number(body.olderThanHours) || 24, 168))
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString()
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: assets, error: assetError } = await admin
      .from('question_media_assets')
      .select('path, processed_path, thumbnail_path')
      .not('orphaned_at', 'is', null)
      .lt('orphaned_at', cutoff)
      .limit(limit)
    if (assetError) throw assetError

    const paths = [...new Set((assets || []).flatMap((asset) => [
      asset.path,
      asset.processed_path,
      asset.thumbnail_path,
    ]).filter((value): value is string => Boolean(value)))]
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(paths)
      if (removeError) throw removeError
      const { error: deleteError } = await admin
        .from('question_media_assets')
        .delete()
        .in('path', (assets || []).map((asset) => asset.path))
      if (deleteError) throw deleteError
    }

    const referenced = new Set<string>([
      ...((await admin.from('questions').select('media_path').not('media_path', 'is', null)).data || [])
        .map((row) => row.media_path as string),
      ...((await admin.from('question_media_assets').select('path, processed_path, thumbnail_path')).data || [])
        .flatMap((row) => [row.path, row.processed_path, row.thumbnail_path] as Array<string | null>)
        .filter((value): value is string => Boolean(value)),
    ])
    const untracked = await findUntrackedFiles(admin, '', cutoff, referenced, limit)
    if (untracked.length > 0) {
      const { error } = await admin.storage.from(BUCKET).remove(untracked)
      if (error) throw error
    }

    return json({ ok: true, removedAssets: assets?.length || 0, removedUntracked: untracked.length })
  } catch (error) {
    return errorResponse(error, 'No se pudo limpiar el contenido multimedia huérfano.', {
      functionName: 'cleanup-question-media',
    })
  }
})

async function findUntrackedFiles(
  admin: ReturnType<typeof createClient>,
  prefix: string,
  cutoff: string,
  referenced: Set<string>,
  remaining: number,
  depth = 0,
): Promise<string[]> {
  if (remaining <= 0 || depth > 4) return []
  const found: string[] = []

  for (let offset = 0; found.length < remaining; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    if (!data || data.length === 0) break

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (!item.id) {
        found.push(...await findUntrackedFiles(admin, path, cutoff, referenced, remaining - found.length, depth + 1))
      } else if (!referenced.has(path) && item.created_at && item.created_at < cutoff) {
        found.push(path)
      }
      if (found.length >= remaining) break
    }
    if (data.length < 1000) break
  }

  return found
}
