import { isValidInviteCode, normalizeInviteCode } from './classCode'
import { supabase } from './supabase'
import { measureRpc } from './analytics'

export async function joinClassByInviteCode(inviteCode: string) {
  const normalizedCode = normalizeInviteCode(inviteCode)

  if (!isValidInviteCode(normalizedCode)) {
    throw new Error('El código debe tener 6 caracteres alfanuméricos.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) {
    throw new Error('No hay sesión activa.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError
  if (profile?.role_id && !['student', 'guest'].includes(profile.role_id)) {
    throw new Error('Solo los alumnos pueden unirse a clases.')
  }

  const { data: subject, error: joinError } = await measureRpc(
    'join_subject_by_code',
    async () => supabase.rpc('join_subject_by_code', { p_code: normalizedCode }),
  )

  if (joinError) throw joinError

  const payload = subject && typeof subject === 'object' && !Array.isArray(subject)
    ? subject as { id?: number; name?: string; classroomName?: string; classroomId?: number }
    : null

  const subjectId = Number(payload?.id)
  if (!Number.isFinite(subjectId) || subjectId <= 0) {
    throw new Error('La partida no devolvió un curso válido.')
  }
  const subjectName = String(payload?.name || 'el curso')
  const classroomName = payload?.classroomName ? String(payload.classroomName) : null
  const classroomId = typeof payload?.classroomId === 'number' ? payload.classroomId : null

  return {
    code: normalizedCode,
    subjectId,
    subjectName,
    classroomName,
    classroomId,
  }
}
