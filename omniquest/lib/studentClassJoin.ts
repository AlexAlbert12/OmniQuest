import { isValidInviteCode, normalizeInviteCode } from './classCode'
import { supabase } from './supabase'

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

  const { data: subject, error: joinError } = await supabase.rpc('join_subject_by_code', {
    p_code: normalizedCode,
  })

  if (joinError) throw joinError

  const subjectName =
    subject && typeof subject === 'object' && !Array.isArray(subject)
      ? String((subject as { name?: string }).name || 'la clase')
      : 'la clase'

  return {
    code: normalizedCode,
    subjectName,
  }
}
