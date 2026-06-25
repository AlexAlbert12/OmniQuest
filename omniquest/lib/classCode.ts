import { supabase } from './supabase';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INVITE_CODE_LENGTH = 6;

export function generateInviteCode() {
  let result = '';
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    result += INVITE_CODE_CHARS.charAt(Math.floor(Math.random() * INVITE_CODE_CHARS.length));
  }
  return result;
}

export function normalizeInviteCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, INVITE_CODE_LENGTH).toUpperCase();
}

export function isValidInviteCode(value: string) {
  return /^[A-Z0-9]{6}$/.test(value.toUpperCase());
}

export async function isClassCodeAvailable(
  code: string,
  excludeSubjectId?: number | string | null,
  excludeClassroomId?: number | string | null
) {
  const normalizedCode = normalizeInviteCode(code);

  if (!isValidInviteCode(normalizedCode)) {
    return false;
  }

  let subjectQuery = supabase
    .from('subjects')
    .select('id')
    .eq('code', normalizedCode);

  if (excludeSubjectId) {
    subjectQuery = subjectQuery.neq('id', Number(excludeSubjectId));
  }

  const { data: subjectData, error: subjectError } = await subjectQuery.maybeSingle();
  if (subjectError) throw subjectError;
  if (subjectData) return false;

  let classroomQuery = supabase
    .from('classrooms')
    .select('id')
    .eq('code', normalizedCode);

  if (excludeClassroomId) {
    classroomQuery = classroomQuery.neq('id', Number(excludeClassroomId));
  }

  const { data: classroomData, error: classroomError } = await classroomQuery.maybeSingle();
  if (classroomError) throw classroomError;

  return !classroomData;
}

export async function generateUniqueClassCode(
  excludeSubjectId?: number | string | null,
  excludeClassroomId?: number | string | null
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateInviteCode();
    if (await isClassCodeAvailable(candidate, excludeSubjectId, excludeClassroomId)) {
      return candidate;
    }
  }

  throw new Error('No se pudo generar un código único. Inténtalo de nuevo.');
}
