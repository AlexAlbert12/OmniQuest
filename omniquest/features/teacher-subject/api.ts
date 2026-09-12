import { supabase } from '../../lib/supabase'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'

export async function createTeacherClassroom(input: { subjectId: number; name: string; academicYear?: string | null }) {
  const { data, error } = await supabase.rpc('create_teacher_classroom', {
    p_subject_id: input.subjectId,
    p_name: input.name,
    p_academic_year: input.academicYear ?? undefined,
  })
  if (error) throw error
  const created = data as unknown as { id?: number }
  if (!created?.id) throw new Error('La base de datos no devolvió la clase creada.')
  return { id: Number(created.id) }
}

export async function createTeacherTopic(input: {
  subjectId: number
  classroomId: number
  title: string
  description: string | null
  sortOrder: number
  availableUntil: string | null
}) {
  const { data, error } = await supabase.functions.invoke('teacher-create-topic', {
    body: { ...input, icon: 'book-outline' },
  })
  if (error) throw error
  const result = (data || {}) as { error?: string; topic?: { id: number } }
  if (result.error) throw new Error(result.error)
  if (!result.topic?.id) throw new Error('No se recibió el tema creado.')
  return result.topic
}

export async function deleteTeacherQuestion(questionId: number) {
  const { data, error } = await supabase.functions.invoke('teacher-delete-question', { body: { questionId } })
  if (error) throw error
  const result = (data || {}) as { error?: string }
  if (result.error) throw new Error(result.error)
}

export async function archiveTeacherSubject(subjectId: number) {
  await setTeacherSubjectArchived(subjectId, true)
}

export async function restoreTeacherSubject(subjectId: number) {
  await setTeacherSubjectArchived(subjectId, false)
}

async function setTeacherSubjectArchived(subjectId: number, archive: boolean) {
  const fallback = archive ? 'No se pudo archivar el curso.' : 'No se pudo restaurar el curso.'
  const { data, error } = await supabase.functions.invoke('teacher-archive-subject', { body: { archive, subjectId } })
  if (error) throw new Error(await getEdgeFunctionErrorMessage(error, fallback))
  const result = (data || {}) as { error?: string }
  if (result.error) throw new Error(result.error)
}

async function getEdgeFunctionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context
  if (typeof context?.json === 'function') {
    try {
      const payload = await context.json()
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error
    } catch {
      // The response body is not always available after supabase-js handles it.
    }
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export async function duplicateTeacherSubject(subjectId: number) {
  const { data, error } = await supabase.rpc('duplicate_teacher_subject', { p_subject_id: subjectId, p_name_suffix: ' (Copia)' })
  if (error) throw new Error(error.message || 'No se pudo duplicar el curso.')
  const id = data && typeof data === 'object' && !Array.isArray(data) ? Number((data as { id?: number }).id) : 0
  if (!id) throw new Error('No se pudo obtener el curso duplicado.')
  return id
}

export async function signOutTeacherSubject() {
  const { error } = await signOutCurrentDeviceSession()
  if (error) throw error
}
