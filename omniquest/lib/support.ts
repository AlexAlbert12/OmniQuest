import * as DocumentPicker from 'expo-document-picker'
import { Linking } from 'react-native'
import { supabase } from './supabase'

export type SupportRole = 'student' | 'teacher' | 'admin' | 'system'
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type SupportTicketPriority = 'low' | 'medium' | 'high'
export type SupportTicketCategory = 'plataforma' | 'cursos' | 'preguntas' | 'cuenta' | 'otro'
export type SupportContactPreference = 'in_app' | 'email' | 'both'

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
  preferred_channel: SupportContactPreference
  contact_email: string | null
  message_count?: number
  attachment_count?: number
}

export type SupportTicketPage = {
  tickets: SupportTicket[]
  total: number
  hasMore: boolean
}

export type SupportContactChannel = {
  channel_key: string
  label: string
  channel_type: 'in_app' | 'email' | 'url'
  value: string | null
  description: string | null
  enabled: boolean
  sort_order: number
}

export type SupportEmailDelivery = {
  id: number
  ticket_id: number
  message_id: number | null
  subject: string
  status: 'queued' | 'processing' | 'sent' | 'retry' | 'failed' | 'cancelled'
  sent_at: string | null
  error_message: string | null
  created_at: string
}


export type SupportMessage = {
  id: number
  ticket_id: number
  author_id: string | null
  author_role: SupportRole
  body: string
  is_internal: boolean
  created_at: string
}

export type SupportHistory = {
  id: number
  ticket_id: number
  changed_by: string | null
  event_type: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  comment: string | null
  created_at: string
}

export type SupportTag = { id: number; slug: string; label: string; color: string }
export type SupportTemplate = { id: number; title: string; body: string; category: string | null }
export type SupportDirectory = { admins: Array<{ id: string; alias: string; email: string | null }>; tags: SupportTag[]; templates: SupportTemplate[] }

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
  history: SupportHistory[]
  tags: SupportTag[]
  hasMore: boolean
  nextBeforeId: number | null
}

const SUPPORT_ATTACHMENT_BUCKET = 'support-attachments'
const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
const SUPPORT_ATTACHMENT_TTL_SECONDS = 10 * 60
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'])

const TICKET_SELECT = 'id, user_id, role, subject, message, category, status, priority, preferred_channel, contact_email, created_at, updated_at, resolved_at, last_response_at, first_response_due_at, resolution_due_at, first_responded_at'

export async function fetchOwnSupportTickets(limit = 30) {
  const page = await fetchOwnSupportTicketsPage({ limit, offset: 0 })
  return page.tickets
}

export async function fetchOwnSupportTicketsPage({
  limit = 10,
  offset = 0,
}: {
  limit?: number
  offset?: number
} = {}): Promise<SupportTicketPage> {
  const { data, error } = await supabase.rpc('get_own_support_tickets_page', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  const rows = (data || []) as Array<Record<string, unknown>>
  const tickets = rows.map(mapSupportTicket)
  const total = Number(rows[0]?.total_count || 0)
  return { tickets, total, hasMore: offset + tickets.length < total }
}

export async function fetchOwnSupportTicketById(ticketId: number): Promise<SupportTicket | null> {
  const { data, error } = await supabase
    .from('user_support_tickets')
    .select(TICKET_SELECT)
    .eq('id', ticketId)
    .maybeSingle()
  if (error) throw error
  return data ? mapSupportTicket(data as unknown as Record<string, unknown>) : null
}

export async function fetchSupportThread(ticketId: number): Promise<SupportThread> {
  return fetchSupportThreadPage({ ticketId })
}

export async function fetchSupportThreadPage({
  ticketId,
  limit = 30,
  beforeId = null,
}: {
  ticketId: number
  limit?: number
  beforeId?: number | null
}): Promise<SupportThread> {
  const { data, error } = await supabase.rpc('get_support_thread_page', {
    p_ticket_id: ticketId,
    p_limit: limit,
    p_before_id: beforeId ?? undefined,
  })
  if (error) throw error
  const payload = isObject(data) ? data : {}
  const messages = Array.isArray(payload.messages) ? payload.messages.map(mapSupportMessage) : []
  const rawAttachments = Array.isArray(payload.attachments) ? payload.attachments.map(mapSupportAttachment) : []
  const attachments = await signSupportAttachments(rawAttachments)
  const history = Array.isArray(payload.history) ? payload.history.map(mapSupportHistory) : []
  const tags = Array.isArray(payload.tags) ? payload.tags.map(mapSupportTag) : []
  return {
    messages,
    attachments,
    history,
    tags,
    hasMore: payload.has_more === true,
    nextBeforeId: payload.next_before_id == null ? null : Number(payload.next_before_id),
  }
}


export async function fetchAdminSupportDirectory(): Promise<SupportDirectory> {
  const { data, error } = await supabase.rpc('get_admin_support_directory' as any)
  if (error) throw error
  const payload = isObject(data) ? data : {}
  return {
    admins: Array.isArray(payload.admins) ? payload.admins.map((item: unknown) => { const row = isObject(item) ? item : {}; return { id: String(row.id || ''), alias: String(row.alias || 'Administrador'), email: typeof row.email === 'string' ? row.email : null } }).filter((item: { id: string }) => item.id) : [],
    tags: Array.isArray(payload.tags) ? payload.tags.map(mapSupportTag) : [],
    templates: Array.isArray(payload.templates) ? payload.templates.map((item: unknown) => { const row = isObject(item) ? item : {}; return { id: Number(row.id), title: String(row.title || 'Plantilla'), body: String(row.body || ''), category: typeof row.category === 'string' ? row.category : null } }).filter((item: SupportTemplate) => Number.isFinite(item.id)) : [],
  }
}

export async function uploadAdminSupportAttachment(ticketId: number, messageId: number | null, attachment: PickedSupportAttachment) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw error || new Error('No hay una sesión válida.')
  await uploadSupportAttachment(ticketId, messageId, data.user.id, attachment)
}

export async function fetchSupportContactChannels(): Promise<SupportContactChannel[]> {
  const { data, error } = await supabase.rpc('get_support_contact_channels')
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    channel_key: String(row.channel_key || ''),
    label: String(row.label || 'Canal de soporte'),
    channel_type: row.channel_type === 'email' || row.channel_type === 'url' ? row.channel_type : 'in_app',
    value: typeof row.value === 'string' ? row.value : null,
    description: typeof row.description === 'string' ? row.description : null,
    enabled: row.enabled !== false,
    sort_order: Number(row.sort_order || 0),
  }))
}

export async function fetchOwnSupportEmailHistory(limit = 10, offset = 0) {
  const { data, error } = await supabase.rpc('get_own_support_email_history', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  const rows = (data || []) as Array<Record<string, unknown>>
  return {
    deliveries: rows.map((row): SupportEmailDelivery => ({
      id: Number(row.id),
      ticket_id: Number(row.ticket_id),
      message_id: row.message_id == null ? null : Number(row.message_id),
      subject: String(row.subject || 'Respuesta de soporte'),
      status: normalizeDeliveryStatus(row.status),
      sent_at: typeof row.sent_at === 'string' ? row.sent_at : null,
      error_message: typeof row.error_message === 'string' ? row.error_message : null,
      created_at: String(row.created_at || new Date(0).toISOString()),
    })),
    total: Number(rows[0]?.total_count || 0),
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
  preferredChannel = 'in_app',
  attachment,
}: {
  userId: string
  role: 'student' | 'teacher'
  contactEmail: string | null
  subject: string
  body: string
  category: SupportTicketCategory
  priority: SupportTicketPriority
  preferredChannel?: SupportContactPreference
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
      preferred_channel: preferredChannel,
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

  return { ticket: mapSupportTicket(data as unknown as Record<string, unknown>), attachmentError }
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
  const message = mapSupportMessage(data)

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

export async function openSupportContactChannel(channel: SupportContactChannel) {
  if (!channel.value || channel.channel_type === 'in_app') {
    throw new Error('Este canal se utiliza directamente dentro de OmniQuest.')
  }

  const target = channel.channel_type === 'email'
    ? `mailto:${channel.value.trim()}`
    : normalizeExternalUrl(channel.value)
  const supported = await Linking.canOpenURL(target)
  if (!supported) throw new Error('Este dispositivo no puede abrir el canal de contacto.')
  await Linking.openURL(target)
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

async function signSupportAttachments(attachments: Omit<SupportAttachment, 'signedUrl'>[]) {
  return Promise.all(attachments.map(async (attachment) => {
    const { data } = await supabase.storage
      .from(SUPPORT_ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.storage_path, SUPPORT_ATTACHMENT_TTL_SECONDS)
    return { ...attachment, signedUrl: data?.signedUrl || null }
  }))
}

function mapSupportTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: Number(row.id),
    user_id: String(row.user_id || ''),
    role: row.role === 'teacher' ? 'teacher' : 'student',
    subject: String(row.subject || ''),
    message: String(row.message || ''),
    category: isSupportCategory(row.category) ? row.category : 'otro',
    status: isSupportStatus(row.status) ? row.status : 'open',
    priority: isSupportPriority(row.priority) ? row.priority : 'medium',
    preferred_channel: normalizeSupportPreference(row.preferred_channel),
    contact_email: typeof row.contact_email === 'string' ? row.contact_email : null,
    created_at: String(row.created_at || new Date(0).toISOString()),
    updated_at: String(row.updated_at || new Date(0).toISOString()),
    resolved_at: typeof row.resolved_at === 'string' ? row.resolved_at : null,
    last_response_at: typeof row.last_response_at === 'string' ? row.last_response_at : null,
    first_response_due_at: typeof row.first_response_due_at === 'string' ? row.first_response_due_at : null,
    resolution_due_at: typeof row.resolution_due_at === 'string' ? row.resolution_due_at : null,
    first_responded_at: typeof row.first_responded_at === 'string' ? row.first_responded_at : null,
    message_count: row.message_count == null ? undefined : Number(row.message_count),
    attachment_count: row.attachment_count == null ? undefined : Number(row.attachment_count),
  }
}

function mapSupportMessage(value: unknown): SupportMessage {
  const row = isObject(value) ? value : {}
  return {
    id: Number(row.id),
    ticket_id: Number(row.ticket_id),
    author_id: typeof row.author_id === 'string' ? row.author_id : null,
    author_role: isSupportRole(row.author_role) ? row.author_role : 'system',
    body: String(row.body || ''),
    is_internal: row.is_internal === true,
    created_at: String(row.created_at || new Date(0).toISOString()),
  }
}


function mapSupportHistory(value: unknown): SupportHistory {
  const row = isObject(value) ? value : {}
  return {
    id: Number(row.id),
    ticket_id: Number(row.ticket_id),
    changed_by: typeof row.changed_by === 'string' ? row.changed_by : null,
    event_type: String(row.event_type || 'ticket_updated'),
    before_state: isObject(row.before_state) ? row.before_state : null,
    after_state: isObject(row.after_state) ? row.after_state : null,
    comment: typeof row.comment === 'string' ? row.comment : null,
    created_at: String(row.created_at || new Date(0).toISOString()),
  }
}

function mapSupportTag(value: unknown): SupportTag {
  const row = isObject(value) ? value : {}
  return { id: Number(row.id), slug: String(row.slug || ''), label: String(row.label || row.slug || 'Etiqueta'), color: String(row.color || '#64748B') }
}

function mapSupportAttachment(value: unknown): Omit<SupportAttachment, 'signedUrl'> {
  const row = isObject(value) ? value : {}
  return {
    id: String(row.id || ''),
    ticket_id: Number(row.ticket_id),
    message_id: row.message_id == null ? null : Number(row.message_id),
    storage_path: String(row.storage_path || ''),
    file_name: String(row.file_name || 'adjunto'),
    mime_type: String(row.mime_type || 'application/octet-stream'),
    size_bytes: Number(row.size_bytes || 0),
    created_at: String(row.created_at || new Date(0).toISOString()),
  }
}

function normalizeSupportPreference(value: unknown): SupportContactPreference {
  return value === 'email' || value === 'both' ? value : 'in_app'
}

function normalizeDeliveryStatus(value: unknown): SupportEmailDelivery['status'] {
  return value === 'processing' || value === 'sent' || value === 'retry' || value === 'failed' || value === 'cancelled'
    ? value
    : 'queued'
}

function isSupportCategory(value: unknown): value is SupportTicketCategory {
  return value === 'plataforma' || value === 'cursos' || value === 'preguntas' || value === 'cuenta' || value === 'otro'
}

function isSupportStatus(value: unknown): value is SupportTicketStatus {
  return value === 'open' || value === 'in_progress' || value === 'resolved' || value === 'closed'
}

function isSupportPriority(value: unknown): value is SupportTicketPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}

function isSupportRole(value: unknown): value is SupportRole {
  return value === 'student' || value === 'teacher' || value === 'admin' || value === 'system'
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
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
