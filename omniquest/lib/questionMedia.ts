import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

export type QuestionMediaType = 'image' | 'audio' | 'video'

export type PickedQuestionMedia = {
  type: QuestionMediaType
  uri: string
  fileName: string
  mimeType: string
  fileSize: number | null
  file?: { arrayBuffer: () => Promise<ArrayBuffer> }
}

export type UploadedQuestionMedia = {
  type: QuestionMediaType
  url: string
  path: string
}

const QUESTION_MEDIA_BUCKET = 'question-media'
export const QUESTION_MEDIA_MAX_BYTES = 25 * 1024 * 1024

export async function pickQuestionMedia(type: QuestionMediaType): Promise<PickedQuestionMedia | null> {
  if (type === 'audio') {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    })

    if (result.canceled || !result.assets[0]) return null
    const asset = result.assets[0]
    return {
      type,
      uri: asset.uri,
      fileName: asset.name || `audio-${Date.now()}.mp3`,
      mimeType: asset.mimeType || inferMimeType(asset.name, type),
      fileSize: typeof asset.size === 'number' ? asset.size : null,
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
    quality: type === 'image' ? 0.88 : 1,
    selectionLimit: 1,
  })

  if (result.canceled || !result.assets[0]) return null
  const asset = result.assets[0]
  const fileName = asset.fileName || `${type}-${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`
  return {
    type,
    uri: asset.uri,
    fileName,
    mimeType: asset.mimeType || inferMimeType(fileName, type),
    fileSize: typeof asset.fileSize === 'number' ? asset.fileSize : null,
    file: asset.file,
  }
}

export async function uploadQuestionMedia(
  asset: PickedQuestionMedia,
  subjectId: number,
): Promise<UploadedQuestionMedia> {
  if (asset.fileSize && asset.fileSize > QUESTION_MEDIA_MAX_BYTES) {
    throw new Error('El archivo supera el límite de 25 MB.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('No hay una sesión activa.')

  const extension = getExtension(asset.fileName, asset.mimeType, asset.type)
  const safeName = sanitizeFileName(asset.fileName.replace(/\.[^.]+$/, '')) || asset.type
  const path = `${userId}/${subjectId}/${Date.now()}-${randomToken()}-${safeName}.${extension}`
  const body = asset.file ? await asset.file.arrayBuffer() : await fetch(asset.uri).then((response) => {
    if (!response.ok) throw new Error('No se pudo leer el archivo seleccionado.')
    return response.arrayBuffer()
  })

  if (body.byteLength > QUESTION_MEDIA_MAX_BYTES) {
    throw new Error('El archivo supera el límite de 25 MB.')
  }

  const { error } = await supabase.storage
    .from(QUESTION_MEDIA_BUCKET)
    .upload(path, body, {
      contentType: asset.mimeType,
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  const { data } = supabase.storage.from(QUESTION_MEDIA_BUCKET).getPublicUrl(path)
  if (!data.publicUrl) {
    await supabase.storage.from(QUESTION_MEDIA_BUCKET).remove([path])
    throw new Error('No se pudo obtener la URL pública del archivo.')
  }

  return { type: asset.type, url: data.publicUrl, path }
}

export async function cloneQuestionMedia({
  type,
  url,
  sourcePath,
  subjectId,
}: {
  type: QuestionMediaType
  url: string
  sourcePath?: string | null
  subjectId: number
}): Promise<UploadedQuestionMedia> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo copiar el contenido multimedia de la pregunta.')
  const body = await response.arrayBuffer()
  if (body.byteLength > QUESTION_MEDIA_MAX_BYTES) {
    throw new Error('El contenido multimedia original supera el límite de 25 MB.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('No hay una sesión activa.')

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim()
    || inferMimeType(sourcePath || url, type)
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
  const { data } = supabase.storage.from(QUESTION_MEDIA_BUCKET).getPublicUrl(path)
  if (!data.publicUrl) {
    await supabase.storage.from(QUESTION_MEDIA_BUCKET).remove([path])
    throw new Error('No se pudo obtener la URL de la copia multimedia.')
  }

  return { type, url: data.publicUrl, path }
}

export async function removeQuestionMedia(path: string | null | undefined) {
  if (!path) return
  const { error } = await supabase.storage.from(QUESTION_MEDIA_BUCKET).remove([path])
  if (error) throw error
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
