import * as DocumentPicker from 'expo-document-picker'
import { Linking } from 'react-native'
import { supabase } from './supabase'

export type SupportRole = 'student' | 'teacher' | 'admin' | 'system'
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type SupportTicketPriority = 'low' | 'medium' | 'high'
export type SupportTicketCategory = 'plataforma' | 'cursos' | 'preguntas' | 'cuenta' | 'otro'

export type SupportTicket = {
  id: number
  user_id: string
  role: 'student' | 'teacher'
  subject: string
  message: string
  category: SupportTicketCategory
  status: SupportTicketStatus
  priority: SupportTicketPriority
  created_at: string
  updated_at: string
  resolved_at: string | null
  last_response_at: string | null
  first_response_due_at: string | null
  resolution_due_at: string | null
  first_responded_at: string | null
}

export type SupportMessage = {
  id: number
  ticket_id: number
  author_id: string | null
  author_role: SupportRole
  body: string
  created_at: string
}

export type SupportAttachment = {
  id: string
  ticket_id: number
  message_id: number | null
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
  signedUrl: string | null
}

export type PickedSupportAttachment = {
  uri: string
  fileName: string
  mimeType: string
  sizeBytes: number
  file?: { arrayBuffer: () => Promise<ArrayBuffer> }
}

export type SupportThread = {
  messages: SupportMessage[]
  attachments: SupportAttachment[]
}

const SUPPORT_ATTACHMENT_BUCKET = 'support-attachments'
const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
const SUPPORT_ATTACHMENT_TTL_SECONDS = 10 * 60
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'])

const TICKET_SELECT = 'id, user_id, role, subject, message, category, status, priority, created_at, updated_at, resolved_at, last_response_at, first_response_due_at, resolution_due_at, first_responded_at'

export async function fetchOwnSupportTickets(limit = 30) {
  const { data, error } = await supabase
    .from('user_support_tickets')
    .select(TICKET_SELECT)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as SupportTicket[]
}

export async function fetchSupportThread(ticketId: number): Promise<SupportThread> {
  const [messagesResult, attachmentsResult] = await Promise.all([
    supabase
      .from('support_ticket_messages')
      .select('id, ticket_id, author_id, author_role, body, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('support_ticket_attachments')
      .select('id, ticket_id, message_id, storage_path, file_name, mime_type, size_bytes, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
  ])
  if (messagesResult.error) throw messagesResult.error
  if (attachmentsResult.error) throw attachmentsResult.error

  const attachments = await Promise.all(((attachmentsResult.data || []) as Omit<SupportAttachment, 'signedUrl'>[]).map(async (attachment) => {
    const { data } = await supabase.storage
      .from(SUPPORT_ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.storage_path, SUPPORT_ATTACHMENT_TTL_SECONDS)
    return { ...attachment, signedUrl: data?.signedUrl || null }
  }))

  return {
    messages: (messagesResult.data || []) as SupportMessage[],
    attachments,
  }
}

export async function createSupportTicket({
  userId,
  role,
  contactEmail,
  subject,
  body,
  category,
  priority,
  attachment,
}: {
  userId: string
  role: 'student' | 'teacher'
  contactEmail: string | null
  subject: string
  body: string
  category: SupportTicketCategory
  priority: SupportTicketPriority
  attachment?: PickedSupportAttachment | null
}) {
  const { data, error } = await supabase
    .from('user_support_tickets')
    .insert({
      user_id: userId,
      role,
      contact_email: contactEmail,
      subject: subject.trim(),
      message: body.trim(),
      category,
      priority,
      status: 'open',
    })
    .select(TICKET_SELECT)
    .single()
  if (error) throw error

  let attachmentError: string | null = null
  if (attachment) {
    try {
      await uploadSupportAttachment(data.id, null, userId, attachment)
    } catch (uploadError) {
      attachmentError = uploadError instanceof Error ? uploadError.message : 'No se pudo adjuntar el archivo.'
    }
  }

  return { ticket: data as SupportTicket, attachmentError }
}

export async function addSupportReply({
  ticketId,
  userId,
  body,
  attachment,
}: {
  ticketId: number
  userId: string
  body: string
  attachment?: PickedSupportAttachment | null
}) {
  const { data, error } = await supabase.rpc('add_support_ticket_message', {
    p_ticket_id: ticketId,
    p_body: body.trim(),
  })
  if (error) throw error
  const message = data as unknown as SupportMessage

  let attachmentError: string | null = null
  if (attachment) {
    try {
      await uploadSupportAttachment(ticketId, message.id, userId, attachment)
    } catch (uploadError) {
      attachmentError = uploadError instanceof Error ? uploadError.message : 'No se pudo adjuntar el archivo.'
    }
  }
  return { message, attachmentError }
}

export async function pickSupportAttachment(): Promise<PickedSupportAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (result.canceled || !result.assets[0]) return null

  const asset = result.assets[0]
  const mimeType = asset.mimeType || inferMimeType(asset.name)
  const sizeBytes = typeof asset.size === 'number' ? asset.size : 0
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error('El formato del archivo no está permitido.')
  if (sizeBytes <= 0) throw new Error('No se pudo comprobar el tamaño del archivo.')
  if (sizeBytes > SUPPORT_ATTACHMENT_MAX_BYTES) throw new Error('El archivo supera el límite de 10 MB.')

  return {
    uri: asset.uri,
    fileName: asset.name || `adjunto-${Date.now()}`,
    mimeType,
    sizeBytes,
    file: asset.file,
  }
}

export async function openSupportAttachment(attachment: SupportAttachment) {
  if (!attachment.signedUrl) throw new Error('El enlace del adjunto ha caducado. Vuelve a abrir el ticket.')
  const supported = await Linking.canOpenURL(attachment.signedUrl)
  if (!supported) throw new Error('Este dispositivo no puede abrir el archivo.')
  await Linking.openURL(attachment.signedUrl)
}

async function uploadSupportAttachment(
  ticketId: number,
  messageId: number | null,
  userId: string,
  attachment: PickedSupportAttachment,
) {
  const bytes = attachment.file
    ? await attachment.file.arrayBuffer()
    : await fetch(attachment.uri).then((response) => {
        if (!response.ok) throw new Error('No se pudo leer el archivo seleccionado.')
        return response.arrayBuffer()
      })
  if (bytes.byteLength <= 0 || bytes.byteLength > SUPPORT_ATTACHMENT_MAX_BYTES) {
    throw new Error('El adjunto debe ocupar entre 1 byte y 10 MB.')
  }

  const safeName = sanitizeFileName(attachment.fileName)
  const path = `${ticketId}/${userId}/${Date.now()}-${randomToken()}-${safeName}`
  const upload = await supabase.storage.from(SUPPORT_ATTACHMENT_BUCKET).upload(path, bytes, {
    contentType: attachment.mimeType,
    cacheControl: 'private, max-age=0',
    upsert: false,
  })
  if (upload.error) throw upload.error

  const metadata = await supabase.from('support_ticket_attachments').insert({
    ticket_id: ticketId,
    message_id: messageId,
    uploaded_by: userId,
    storage_path: path,
    file_name: attachment.fileName.slice(0, 255),
    mime_type: attachment.mimeType,
    size_bytes: bytes.byteLength,
  })
  if (metadata.error) {
    await supabase.storage.from(SUPPORT_ATTACHMENT_BUCKET).remove([path])
    throw metadata.error
  }
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'adjunto'
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10)
}

function inferMimeType(name: string) {
  const extension = name.split('.').pop()?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'txt') return 'text/plain'
  return 'application/octet-stream'
}
