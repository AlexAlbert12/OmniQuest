import { createAudioPlayer } from 'expo-audio'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { invokeEdgeFunction } from './analytics'
import { supabase } from './supabase'

export type QuestionMediaType = 'image' | 'audio' | 'video'

export type PickedQuestionMedia = {
  type: QuestionMediaType
  uri: string
  fileName: string
  mimeType: string
  fileSize: number | null
  durationSeconds: number | null
  file?: { arrayBuffer: () => Promise<ArrayBuffer> }
}

export type UploadedQuestionMedia = {
  type: QuestionMediaType
  url: string
  path: string
  durationSeconds: number | null
}

export type QuestionMediaManifest = {
  questionId: number
  type: QuestionMediaType
  url: string
  path: string
  thumbnailUrl: string | null
  transcript: string | null
  subtitlesVtt: string | null
  durationSeconds: number | null
  processingStatus: string | null
}

const QUESTION_MEDIA_BUCKET = 'question-media'
export const QUESTION_MEDIA_MAX_BYTES = 25 * 1024 * 1024
export const QUESTION_MEDIA_MAX_AUDIO_SECONDS = 10 * 60
export const QUESTION_MEDIA_MAX_VIDEO_SECONDS = 5 * 60
export const QUESTION_MEDIA_SIGNED_URL_TTL_SECONDS = 15 * 60

export async function pickQuestionMedia(type: QuestionMediaType): Promise<PickedQuestionMedia | null> {
  if (type === 'audio') {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    })

    if (result.canceled || !result.assets[0]) return null
    const asset = result.assets[0]
    const durationSeconds = await readAudioDuration(asset.uri)
    validateDuration(type, durationSeconds)
    return {
      type,
      uri: asset.uri,
      fileName: asset.name || `audio-${Date.now()}.mp3`,
      mimeType: asset.mimeType || inferMimeType(asset.name, type),
      fileSize: typeof asset.size === 'number' ? asset.size : null,
      durationSeconds,
      file: asset.file,
    }
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Necesitas permitir el acceso a la biblioteca multimedia para seleccionar un archivo.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [type === 'image' ? 'images' : 'videos'],
    allowsEditing: type === 'image',
    quality: type === 'image' ? 0.82 : 1,
    selectionLimit: 1,
  })

  if (result.canceled || !result.assets[0]) return null
  const asset = result.assets[0]
  const fileName = asset.fileName || `${type}-${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`
  const durationSeconds = type === 'video' && typeof asset.duration === 'number'
    ? asset.duration / 1000
    : null
  validateDuration(type, durationSeconds)

  return {
    type,
    uri: asset.uri,
    fileName,
    mimeType: asset.mimeType || inferMimeType(fileName, type),
    fileSize: typeof asset.fileSize === 'number' ? asset.fileSize : null,
    durationSeconds,
    file: asset.file,
  }
}

export type QuestionMediaUploadStage = 'validating' | 'reading' | 'scanning' | 'uploading' | 'processing' | 'signing' | 'complete'

export type QuestionMediaUploadOptions = {
  signal?: AbortSignal
  onProgress?: (progress: number, stage: QuestionMediaUploadStage) => void
}

export async function uploadQuestionMedia(
  asset: PickedQuestionMedia,
  subjectId: number,
  options: QuestionMediaUploadOptions = {},
): Promise<UploadedQuestionMedia> {
  const report = (progress: number, stage: QuestionMediaUploadStage) => options.onProgress?.(progress, stage)
  const assertNotCancelled = () => {
    if (options.signal?.aborted) throw createUploadCancelledError()
  }

  report(4, 'validating')
  assertNotCancelled()
  if (asset.fileSize && asset.fileSize > QUESTION_MEDIA_MAX_BYTES) {
    throw new Error('El archivo supera el límite de 25 MB.')
  }
  validateDuration(asset.type, asset.durationSeconds)

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('No hay una sesión activa.')
  assertNotCancelled()

  const extension = getExtension(asset.fileName, asset.mimeType, asset.type)
  const safeName = sanitizeFileName(asset.fileName.replace(/\.[^.]+$/, '')) || asset.type
  const path = `${userId}/${subjectId}/${Date.now()}-${randomToken()}-${safeName}.${extension}`

  report(12, 'reading')
  const body = asset.file ? await asset.file.arrayBuffer() : await fetch(asset.uri, { signal: options.signal }).then((response) => {
    if (!response.ok) throw new Error('No se pudo leer el archivo seleccionado.')
    return response.arrayBuffer()
  })
  assertNotCancelled()

  if (body.byteLength > QUESTION_MEDIA_MAX_BYTES) {
    throw new Error('El archivo supera el límite de 25 MB.')
  }
  report(28, 'scanning')
  validateQuestionMediaBytes(body, asset.type, asset.mimeType)
  assertNotCancelled()

  report(42, 'uploading')
  await uploadQuestionMediaObject({
    path,
    body,
    mimeType: asset.mimeType,
    signal: options.signal,
    onProgress: (progress) => report(progress, 'uploading'),
  })

  try {
    assertNotCancelled()
    report(76, 'processing')
    const processed = await processUploadedQuestionMedia({
      path,
      subjectId,
      type: asset.type,
      mimeType: asset.mimeType,
      sizeBytes: body.byteLength,
      durationSeconds: asset.durationSeconds,
    })
    assertNotCancelled()
    report(94, 'signing')
    const url = await createQuestionMediaSignedUrl(processed.path || path, asset.type)
    assertNotCancelled()
    report(100, 'complete')
    return {
      type: asset.type,
      url,
      path,
      durationSeconds: processed.durationSeconds ?? asset.durationSeconds,
    }
  } catch (processingError) {
    await supabase.storage.from(QUESTION_MEDIA_BUCKET).remove([path]).catch(() => undefined)
    throw processingError
  }
}

export async function cloneQuestionMedia({
  type,
  url,
  sourcePath,
  subjectId,
  durationSeconds = null,
}: {
  type: QuestionMediaType
  url: string
  sourcePath?: string | null
  subjectId: number
  durationSeconds?: number | null
}): Promise<UploadedQuestionMedia> {
  const downloaded = sourcePath
    ? await supabase.storage.from(QUESTION_MEDIA_BUCKET).download(sourcePath)
    : null
  if (downloaded?.error) throw downloaded.error

  const response = downloaded?.data
    ? null
    : await fetch(url)
  if (response && !response.ok) throw new Error('No se pudo copiar el contenido multimedia de la pregunta.')
  const body = downloaded?.data
    ? await downloaded.data.arrayBuffer()
    : await response!.arrayBuffer()

  if (body.byteLength > QUESTION_MEDIA_MAX_BYTES) {
    throw new Error('El contenido multimedia original supera el límite de 25 MB.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('No hay una sesión activa.')

  const contentType = downloaded?.data?.type
    || response?.headers.get('content-type')?.split(';')[0]?.trim()
    || inferMimeType(sourcePath || url, type)
  validateQuestionMediaBytes(body, type, contentType)
  validateDuration(type, durationSeconds)

  const extension = getExtension(stripQuery(sourcePath || url), contentType, type)
  const path = `${userId}/${subjectId}/${Date.now()}-${randomToken()}-copia.${extension}`
  const { error } = await supabase.storage
    .from(QUESTION_MEDIA_BUCKET)
    .upload(path, body, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  try {
    const processed = await processUploadedQuestionMedia({
      path,
      subjectId,
      type,
      mimeType: contentType,
      sizeBytes: body.byteLength,
      durationSeconds,
    })
    const signedUrl = await createQuestionMediaSignedUrl(processed.path || path, type)
    return {
      type,
      url: signedUrl,
      path,
      durationSeconds: processed.durationSeconds ?? durationSeconds,
    }
  } catch (processingError) {
    await supabase.storage.from(QUESTION_MEDIA_BUCKET).remove([path]).catch(() => undefined)
    throw processingError
  }
}

export async function createQuestionMediaSignedUrl(path: string, type: QuestionMediaType) {
  const options = type === 'image'
    ? { transform: { width: 1600, quality: 82, resize: 'contain' as const } }
    : undefined
  const { data, error } = await supabase.storage
    .from(QUESTION_MEDIA_BUCKET)
    .createSignedUrl(path, QUESTION_MEDIA_SIGNED_URL_TTL_SECONDS, options)
  if (error) throw error
  if (!data.signedUrl) throw new Error('No se pudo crear la URL temporal del archivo.')
  return data.signedUrl
}

export async function getQuestionMediaManifest(questionId: number): Promise<QuestionMediaManifest | null> {
  const { data, error } = await supabase.rpc('get_question_media_manifest', {
    p_question_ids: [questionId],
  })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
  if (!row) return null
  const path = typeof row?.media_path === 'string' ? row.media_path : null
  const type = row?.media_type === 'image' || row?.media_type === 'audio' || row?.media_type === 'video'
    ? row.media_type
    : null
  if (!path || !type) return null

  const thumbnailPath = typeof row.thumbnail_path === 'string' ? row.thumbnail_path : null
  const [url, thumbnailUrl] = await Promise.all([
    createQuestionMediaSignedUrl(path, type),
    thumbnailPath ? createQuestionMediaSignedUrl(thumbnailPath, 'image') : Promise.resolve(null),
  ])

  return {
    questionId,
    type,
    url,
    path,
    thumbnailUrl,
    transcript: typeof row.transcript === 'string' ? row.transcript : null,
    subtitlesVtt: typeof row.subtitles_vtt === 'string' ? row.subtitles_vtt : null,
    durationSeconds: typeof row.duration_seconds === 'number' ? row.duration_seconds : null,
    processingStatus: typeof row.processing_status === 'string' ? row.processing_status : null,
  }
}

export async function removeQuestionMedia(path: string | null | undefined) {
  if (!path) return
  const { error } = await supabase.storage.from(QUESTION_MEDIA_BUCKET).remove([path])
  if (error) throw error
}

function validateQuestionMediaBytes(body: ArrayBuffer, type: QuestionMediaType, mimeType: string) {
  const bytes = new Uint8Array(body)
  if (bytes.length < 12) throw new Error('El archivo multimedia está vacío o incompleto.')

  const eicarProbe = new TextDecoder('ascii').decode(bytes)
  if (eicarProbe.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    throw new Error('El archivo no ha superado el escaneo básico de seguridad.')
  }

  const signatureType = detectSignatureType(bytes, mimeType)
  if (signatureType !== type) {
    throw new Error('El contenido real del archivo no coincide con el tipo multimedia seleccionado.')
  }
}

function detectSignatureType(bytes: Uint8Array, mimeType: string): QuestionMediaType | null {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length))
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes[0] === 0x89 && ascii(1, 3) === 'PNG'
  const isGif = ascii(0, 3) === 'GIF'
  const isWebp = ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
  if (isJpeg || isPng || isGif || isWebp) return 'image'

  const isMp3 = ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  const isWav = ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE'
  const isOgg = ascii(0, 4) === 'OggS'
  const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  const isIsoMedia = ascii(4, 4) === 'ftyp'

  if (isMp3 || isWav || isOgg) return 'audio'
  if (isWebm) return mimeType.startsWith('audio/') ? 'audio' : 'video'
  if (isIsoMedia) return mimeType.startsWith('audio/') ? 'audio' : 'video'
  return null
}

function validateDuration(type: QuestionMediaType, durationSeconds: number | null) {
  if (type === 'image') return
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`No se pudo verificar la duración del ${type === 'audio' ? 'audio' : 'vídeo'}.`)
  }
  if (type === 'audio' && durationSeconds > QUESTION_MEDIA_MAX_AUDIO_SECONDS) {
    throw new Error('El audio supera el límite de 10 minutos.')
  }
  if (type === 'video' && durationSeconds > QUESTION_MEDIA_MAX_VIDEO_SECONDS) {
    throw new Error('El vídeo supera el límite de 5 minutos.')
  }
}

async function readAudioDuration(uri: string) {
  const player = createAudioPlayer(uri, { downloadFirst: true, updateInterval: 100 })
  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (player.isLoaded && Number.isFinite(player.duration) && player.duration > 0) {
        return player.duration
      }
      await delay(100)
    }
    return null
  } finally {
    player.release()
  }
}

async function processUploadedQuestionMedia(input: {
  path: string
  subjectId: number
  type: QuestionMediaType
  mimeType: string
  sizeBytes: number
  durationSeconds: number | null
}) {
  const { data, error } = await invokeEdgeFunction('process-question-media', {
    body: {
      path: input.path,
      subjectId: input.subjectId,
      mediaType: input.type,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      durationSeconds: input.durationSeconds,
    },
  })
  if (error) throw error
  if (data?.error) throw new Error(String(data.error))
  return {
    path: typeof data?.processedPath === 'string' ? data.processedPath : input.path,
    durationSeconds: typeof data?.durationSeconds === 'number' ? data.durationSeconds : input.durationSeconds,
  }
}

async function uploadQuestionMediaObject({
  path,
  body,
  mimeType,
  signal,
  onProgress,
}: {
  path: string
  body: ArrayBuffer
  mimeType: string
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}) {
  if (signal?.aborted) throw createUploadCancelledError()

  const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const accessToken = sessionData.session?.access_token
  if (!projectUrl || !publicKey || !accessToken) {
    throw new Error('No se pudo autorizar la subida multimedia.')
  }

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const uploadUrl = `${projectUrl}/storage/v1/object/${QUESTION_MEDIA_BUCKET}/${encodedPath}`

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', handleAbort)
      callback()
    }
    const handleAbort = () => request.abort()

    request.open('POST', uploadUrl)
    request.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    request.setRequestHeader('apikey', publicKey)
    request.setRequestHeader('Content-Type', mimeType)
    request.setRequestHeader('Cache-Control', '3600')
    request.setRequestHeader('x-upsert', 'false')
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      const fraction = Math.min(1, Math.max(0, event.loaded / event.total))
      onProgress?.(42 + Math.round(fraction * 32))
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        finish(resolve)
        return
      }

      let message = `No se pudo subir el archivo multimedia (${request.status}).`
      try {
        const payload = JSON.parse(request.responseText || '{}') as { message?: string; error?: string }
        message = payload.message || payload.error || message
      } catch {

      }
      finish(() => reject(new Error(message)))
    }
    request.onerror = () => finish(() => reject(new Error('No se pudo conectar con Storage para subir el archivo.')))
    request.onabort = () => finish(() => reject(createUploadCancelledError()))
    signal?.addEventListener('abort', handleAbort, { once: true })
    request.send(body)
  })
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10)
}

function getExtension(fileName: string, mimeType: string, type: QuestionMediaType) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{2,5})$/)
  if (match) return match[1]
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  if (mimeType.includes('quicktime')) return 'mov'
  if (type === 'audio') return 'mp3'
  if (type === 'video') return 'mp4'
  return 'jpg'
}

function stripQuery(value: string) {
  return value.split('?')[0].split('#')[0]
}

function inferMimeType(fileName: string, type: QuestionMediaType) {
  const extension = getExtension(fileName, '', type)
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    webm: type === 'video' ? 'video/webm' : 'audio/webm',
    mp4: type === 'audio' ? 'audio/mp4' : 'video/mp4',
    mov: 'video/quicktime',
  }
  return map[extension] || `${type}/${extension}`
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function createUploadCancelledError() {
  const error = new Error('Subida multimedia cancelada.')
  error.name = 'AbortError'
  return error
}

export function isQuestionMediaUploadCancelled(error: unknown) {
  return error instanceof Error && (error.name === 'AbortError' || error.message === 'Subida multimedia cancelada.')
}
