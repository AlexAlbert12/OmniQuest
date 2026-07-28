import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  corsHeaders,
  errorResponse,
  json,
  methodNotAllowedResponse,
  publicError,
  publicErrorResponse,
} from '../_shared/errors.ts'

const BUCKET = 'question-media'
const MAX_BYTES = 25 * 1024 * 1024
const MAX_AUDIO_SECONDS = 10 * 60
const MAX_VIDEO_SECONDS = 5 * 60

type MediaType = 'image' | 'audio' | 'video'
type RequestBody = {
  path?: string
  subjectId?: number
  mediaType?: MediaType
  mimeType?: string
  sizeBytes?: number
  durationSeconds?: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return methodNotAllowedResponse()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return publicErrorResponse('El procesador multimedia no está configurado.', 500, 'service_unavailable')
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return publicErrorResponse('No autorizado.', 401, 'unauthorized')

    const body = await req.json().catch(() => ({})) as RequestBody
    const path = String(body.path || '').trim()
    const subjectId = Number(body.subjectId)
    const mediaType = body.mediaType
    const declaredMimeType = String(body.mimeType || '').trim().toLowerCase()
    const declaredDuration = body.durationSeconds == null ? null : Number(body.durationSeconds)

    if (!path || !Number.isInteger(subjectId) || !['image', 'audio', 'video'].includes(String(mediaType))) {
      throw publicError('Faltan datos válidos del archivo.', 400, 'bad_request')
    }
    if (path.split('/')[0] !== userData.user.id) {
      throw publicError('La ruta no pertenece al usuario actual.', 403, 'forbidden')
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role_id, active')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!profile || profile.active === false || !['teacher', 'admin'].includes(profile.role_id)) {
      throw publicError('Acceso restringido.', 403, 'forbidden')
    }

    const { data: subject } = await admin
      .from('subjects')
      .select('id, teacher_id')
      .eq('id', subjectId)
      .maybeSingle()
    if (!subject || (profile.role_id !== 'admin' && subject.teacher_id !== userData.user.id)) {
      throw publicError('No puedes añadir archivos a este curso.', 403, 'forbidden')
    }

    const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(path)
    if (downloadError || !blob) throw publicError('No se encontró el archivo subido.', 404, 'not_found')
    if (blob.size <= 0 || blob.size > MAX_BYTES) {
      await admin.storage.from(BUCKET).remove([path])
      throw publicError('El archivo supera el límite permitido.', 400, 'bad_request')
    }

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const detectedType = detectSignatureType(bytes, declaredMimeType || blob.type)
    if (detectedType !== mediaType || containsEicar(bytes)) {
      await admin.storage.from(BUCKET).remove([path])
      await admin.from('question_media_assets').upsert({
        path,
        owner_id: userData.user.id,
        subject_id: subjectId,
        media_type: mediaType,
        mime_type: declaredMimeType || blob.type || 'application/octet-stream',
        size_bytes: blob.size,
        duration_seconds: declaredDuration,
        scan_status: 'rejected',
        processing_status: 'failed',
        processing_error: 'signature_or_malware_check_failed',
        orphaned_at: new Date().toISOString(),
      }, { onConflict: 'path' })
      throw publicError('El archivo no ha superado el escaneo básico de seguridad.', 400, 'bad_request')
    }

    validateDuration(mediaType as MediaType, declaredDuration)
    const processed = await runOptionalProcessor({
      admin,
      path,
      mediaType: mediaType as MediaType,
      mimeType: declaredMimeType || blob.type,
      durationSeconds: declaredDuration,
    })
    validateDuration(mediaType as MediaType, processed.durationSeconds)

    const assetRow = {
      path,
      owner_id: userData.user.id,
      subject_id: subjectId,
      media_type: mediaType,
      mime_type: declaredMimeType || blob.type || 'application/octet-stream',
      size_bytes: blob.size,
      duration_seconds: processed.durationSeconds,
      scan_status: 'clean',
      processing_status: processed.usedProcessor ? 'ready' : 'basic_complete',
      thumbnail_path: processed.thumbnailPath,
      processed_path: processed.processedPath,
      transcript: processed.transcript,
      subtitles_vtt: processed.subtitlesVtt,
      processing_error: null,
      processed_at: new Date().toISOString(),
      orphaned_at: new Date().toISOString(),
    }
    const { error: assetError } = await admin
      .from('question_media_assets')
      .upsert(assetRow, { onConflict: 'path' })
    if (assetError) throw assetError

    return json({
      ok: true,
      path,
      processedPath: processed.processedPath,
      thumbnailPath: processed.thumbnailPath,
      durationSeconds: processed.durationSeconds,
      processingStatus: assetRow.processing_status,
    })
  } catch (error) {
    return errorResponse(error, 'No se pudo validar el archivo multimedia.', {
      functionName: 'process-question-media',
    })
  }
})

async function runOptionalProcessor({
  admin,
  path,
  mediaType,
  mimeType,
  durationSeconds,
}: {
  admin: ReturnType<typeof createClient>
  path: string
  mediaType: MediaType
  mimeType: string
  durationSeconds: number | null
}) {
  const processorUrl = Deno.env.get('MEDIA_PROCESSOR_URL')?.trim()
  const processorToken = Deno.env.get('MEDIA_PROCESSOR_TOKEN')?.trim()
  if (!processorUrl) {
    return {
      usedProcessor: false,
      durationSeconds,
      processedPath: null,
      thumbnailPath: null,
      transcript: null,
      subtitlesVtt: null,
    }
  }

  const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 5 * 60)
  if (error || !signed.signedUrl) throw error || new Error('Could not sign processor source')

  const response = await fetch(processorUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(processorToken ? { Authorization: `Bearer ${processorToken}` } : {}),
    },
    body: JSON.stringify({
      sourceUrl: signed.signedUrl,
      mediaType,
      mimeType,
      targets: {
        transcode: mediaType !== 'image',
        thumbnail: mediaType === 'video',
        transcript: mediaType === 'audio',
        subtitles: mediaType === 'video',
      },
    }),
  })
  if (!response.ok) throw new Error(`Media processor failed with ${response.status}`)

  const result = await response.json() as {
    durationSeconds?: number
    processedUrl?: string
    processedMimeType?: string
    thumbnailUrl?: string
    transcript?: string
    subtitlesVtt?: string
  }
  const base = path.replace(/\.[^.]+$/, '')
  const processedPath = result.processedUrl ? `${base}-processed.${mediaType === 'audio' ? 'm4a' : 'mp4'}` : null
  const thumbnailPath = result.thumbnailUrl ? `${base}-thumbnail.jpg` : null

  if (result.processedUrl && processedPath) {
    await copyRemoteOutput(admin, result.processedUrl, processedPath, result.processedMimeType || (mediaType === 'audio' ? 'audio/mp4' : 'video/mp4'), MAX_BYTES)
  }
  if (result.thumbnailUrl && thumbnailPath) {
    await copyRemoteOutput(admin, result.thumbnailUrl, thumbnailPath, 'image/jpeg', 2 * 1024 * 1024)
  }

  return {
    usedProcessor: true,
    durationSeconds: Number(result.durationSeconds || durationSeconds),
    processedPath,
    thumbnailPath,
    transcript: cleanText(result.transcript, 20000),
    subtitlesVtt: cleanText(result.subtitlesVtt, 40000),
  }
}

async function copyRemoteOutput(
  admin: ReturnType<typeof createClient>,
  url: string,
  path: string,
  contentType: string,
  maxBytes: number,
) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download processor output: ${response.status}`)
  const body = await response.arrayBuffer()
  if (body.byteLength <= 0 || body.byteLength > maxBytes) throw new Error('Processor output has invalid size')
  const { error } = await admin.storage.from(BUCKET).upload(path, body, {
    contentType,
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error
}

function validateDuration(type: MediaType, duration: number | null) {
  if (type === 'image') return
  if (!duration || !Number.isFinite(duration) || duration <= 0) {
    throw publicError('No se pudo verificar la duración del archivo.', 400, 'bad_request')
  }
  if (type === 'audio' && duration > MAX_AUDIO_SECONDS) {
    throw publicError('El audio supera el límite de 10 minutos.', 400, 'bad_request')
  }
  if (type === 'video' && duration > MAX_VIDEO_SECONDS) {
    throw publicError('El vídeo supera el límite de 5 minutos.', 400, 'bad_request')
  }
}

function detectSignatureType(bytes: Uint8Array, mimeType: string): MediaType | null {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length))
  if (
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (bytes[0] === 0x89 && ascii(1, 3) === 'PNG')
    || ascii(0, 3) === 'GIF'
    || (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP')
  ) return 'image'
  if (
    ascii(0, 3) === 'ID3'
    || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    || (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE')
    || ascii(0, 4) === 'OggS'
  ) return 'audio'
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return mimeType.startsWith('audio/') ? 'audio' : 'video'
  }
  if (ascii(4, 4) === 'ftyp') return mimeType.startsWith('audio/') ? 'audio' : 'video'
  return null
}

function containsEicar(bytes: Uint8Array) {
  return new TextDecoder('ascii').decode(bytes).includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) || null : null
}
