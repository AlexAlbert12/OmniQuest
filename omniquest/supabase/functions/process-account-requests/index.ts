import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, json, methodNotAllowedResponse, publicErrorResponse } from '../_shared/errors.ts'

type ExportRequest = { id: string; user_id: string }
type DeletionRequest = { id: string; user_id: string }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return methodNotAllowedResponse()

  const expectedSecret = Deno.env.get('ACCOUNT_REQUESTS_CRON_SECRET')
  const receivedSecret = request.headers.get('x-account-requests-secret')
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return publicErrorResponse('No autorizado.', 401, 'unauthorized')
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return publicErrorResponse('El servicio no está configurado.', 500, 'service_unavailable')
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const exportsProcessed = await processExports(admin)
    const deletionsProcessed = await processDeletions(admin)
    return json({ exportsProcessed, deletionsProcessed })
  } catch (error) {
    return errorResponse(error, 'No se pudieron procesar las solicitudes.', {
      functionName: 'process-account-requests',
    })
  }
})

async function processExports(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('data_export_requests')
    .select('id, user_id')
    .eq('status', 'queued')
    .order('requested_at', { ascending: true })
    .limit(5)
  if (error) throw error

  let processed = 0
  for (const request of (data || []) as ExportRequest[]) {
    const claimed = await admin
      .from('data_export_requests')
      .update({ status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle()
    if (claimed.error) throw claimed.error
    if (!claimed.data) continue

    try {
      const payload = await buildAccountExport(admin, request.user_id)
      const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2))
      const objectPath = `${request.user_id}/${request.id}.json`
      const upload = await admin.storage.from('account-exports').upload(objectPath, bytes, {
        contentType: 'application/json',
        cacheControl: 'private, max-age=0',
        upsert: true,
      })
      if (upload.error) throw upload.error

      const completedAt = new Date()
      const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
      const update = await admin.from('data_export_requests').update({
        status: 'ready',
        object_path: objectPath,
        file_size_bytes: bytes.byteLength,
        completed_at: completedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        error_message: null,
        updated_at: completedAt.toISOString(),
      }).eq('id', request.id)
      if (update.error) throw update.error

      await notifyAccountRequest(admin, request.user_id, {
        title: 'Tu exportación está lista',
        description: 'Puedes descargarla desde Configuración durante las próximas 24 horas.',
        icon: 'download-outline',
        color: '#34D399',
        relatedTable: 'data_export_requests',
        relatedId: request.id,
        fingerprint: `data-export-ready:${request.id}`,
      })
      processed += 1
    } catch (requestError) {
      const message = safeErrorMessage(requestError)
      await admin.from('data_export_requests').update({
        status: 'failed',
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', request.id)
      await notifyAccountRequest(admin, request.user_id, {
        title: 'No se pudo preparar la exportación',
        description: 'Vuelve a solicitarla desde Configuración.',
        icon: 'alert-circle-outline',
        color: '#F87171',
        relatedTable: 'data_export_requests',
        relatedId: request.id,
        fingerprint: `data-export-failed:${request.id}`,
      })
    }
  }
  return processed
}

async function processDeletions(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('account_deletion_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(5)
  if (error) throw error

  let processed = 0
  for (const request of (data || []) as DeletionRequest[]) {
    const claimed = await admin
      .from('account_deletion_requests')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (claimed.error) throw claimed.error
    if (!claimed.data) continue

    try {
      const { data: attachments } = await admin
        .from('support_ticket_attachments')
        .select('storage_path')
        .eq('uploaded_by', request.user_id)
      const attachmentPaths = (attachments || []).map((row) => row.storage_path).filter(Boolean)
      if (attachmentPaths.length > 0) await admin.storage.from('support-attachments').remove(attachmentPaths)

      const { data: exports } = await admin
        .from('data_export_requests')
        .select('object_path')
        .eq('user_id', request.user_id)
        .not('object_path', 'is', null)
      const exportPaths = (exports || []).map((row) => row.object_path).filter(Boolean) as string[]
      if (exportPaths.length > 0) await admin.storage.from('account-exports').remove(exportPaths)

      const relationalDelete = await admin.rpc('delete_user_relational_data', { p_user_id: request.user_id })
      if (relationalDelete.error) throw relationalDelete.error
      await admin.storage.from('avatars').remove([
        `${request.user_id}.jpg`, `${request.user_id}.jpeg`, `${request.user_id}.png`, `${request.user_id}.webp`,
      ])
      const authDelete = await admin.auth.admin.deleteUser(request.user_id)
      if (authDelete.error) throw authDelete.error
      processed += 1
    } catch (requestError) {
      const message = safeErrorMessage(requestError)
      await admin.from('account_deletion_requests').update({
        status: 'failed',
        error_message: message,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', request.id)
    }
  }
  return processed
}

async function buildAccountExport(admin: SupabaseClient, userId: string) {
  const profileResult = await admin.from('profiles').select('*').eq('id', userId).single()
  if (profileResult.error) throw profileResult.error
  const role = profileResult.data.role_id === 'teacher' ? 'teacher' : 'student'

  const common = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    role,
    profile: profileResult.data,
    preferences: await selectRows(admin, 'user_preferences', 'user_id', userId),
    notificationPreferences: await selectRows(admin, 'user_notification_preferences', 'user_id', userId),
    notifications: await selectRows(admin, 'notifications', 'user_id', userId),
    supportTickets: await selectRows(admin, 'user_support_tickets', 'user_id', userId),
    supportMessages: await selectSupportMessages(admin, userId),
    sessions: await selectRows(admin, 'user_sessions', 'user_id', userId),
  }

  if (role === 'teacher') {
    const subjects = await selectRows(admin, 'subjects', 'teacher_id', userId)
    const subjectIds = subjects.map((row) => row.id).filter((id) => typeof id === 'number') as number[]
    const questions = await selectRowsIn(admin, 'questions', 'subject_id', subjectIds)
    const questionIds = questions.map((row) => row.id).filter((id) => typeof id === 'number') as number[]
    return {
      ...common,
      subjects,
      classrooms: await selectRowsIn(admin, 'classrooms', 'subject_id', subjectIds),
      topics: await selectRowsIn(admin, 'subject_topics', 'subject_id', subjectIds),
      questions,
      answers: await selectRowsIn(admin, 'answers', 'question_id', questionIds),
      enrollments: await selectRowsIn(admin, 'enrollments', 'subject_id', subjectIds),
      subjectScores: await selectRowsIn(admin, 'subject_scores', 'subject_id', subjectIds),
      attempts: await selectRowsIn(admin, 'attempt_history', 'question_id', questionIds),
    }
  }

  return {
    ...common,
    enrollments: await selectRows(admin, 'enrollments', 'student_id', userId),
    subjectScores: await selectRows(admin, 'subject_scores', 'student_id', userId),
    topicScores: await selectRows(admin, 'topic_scores', 'student_id', userId),
    attempts: await selectRows(admin, 'attempt_history', 'student_id', userId),
    badges: await selectRows(admin, 'student_badges', 'student_id', userId),
  }
}

async function selectRows(admin: SupabaseClient, table: string, column: string, value: string) {
  const result = await admin.from(table).select('*').eq(column, value)
  if (result.error) throw result.error
  return (result.data || []) as Record<string, unknown>[]
}

async function selectRowsIn(admin: SupabaseClient, table: string, column: string, values: number[]) {
  if (values.length === 0) return []
  const result = await admin.from(table).select('*').in(column, values)
  if (result.error) throw result.error
  return (result.data || []) as Record<string, unknown>[]
}

async function selectSupportMessages(admin: SupabaseClient, userId: string) {
  const tickets = await selectRows(admin, 'user_support_tickets', 'user_id', userId)
  const ticketIds = tickets.map((row) => row.id).filter((id) => typeof id === 'number') as number[]
  return selectRowsIn(admin, 'support_ticket_messages', 'ticket_id', ticketIds)
}

async function notifyAccountRequest(
  admin: SupabaseClient,
  userId: string,
  notification: {
    title: string
    description: string
    icon: string
    color: string
    relatedTable: string
    relatedId: string
    fingerprint: string
  },
) {
  const profile = await admin.from('profiles').select('role_id').eq('id', userId).maybeSingle()
  const audience = profile.data?.role_id === 'teacher' ? 'teacher' : 'student'
  const actionUrl = audience === 'teacher' ? '/(teacher)/settings?section=data' : '/(student)/settings?section=data'
  const result = await admin.rpc('create_notification', {
    p_user_id: userId,
    p_audience: audience,
    p_type: 'announcement',
    p_title: notification.title,
    p_description: notification.description,
    p_icon: notification.icon,
    p_color: notification.color,
    p_action_url: actionUrl,
    p_related_table: notification.relatedTable,
    p_related_id: notification.relatedId,
    p_metadata: { preference_category: 'system' },
    p_fingerprint: notification.fingerprint,
  })
  if (result.error) console.warn('[process-account-requests] notification failed', result.error.message)
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected processing error'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}
