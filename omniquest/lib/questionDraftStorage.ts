import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TeacherQuestionFormState } from '../components/teacher/question-form/types'

const PREFIX = 'omniquest:teacher-question-draft:v2'
const LEGACY_PREFIX = 'omniquest:teacher-question-draft:v1:'
export const TEACHER_QUESTION_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000

export type StoredTeacherQuestionDraft = {
  version: 2
  savedAt: string
  expiresAt: string
  state: Omit<TeacherQuestionFormState, 'topics'>
}

export function getTeacherQuestionDraftKey({ mode, userId, subjectId, classroomId, questionId, sourceQuestionId }: { mode: 'create' | 'edit'; userId: string | null; subjectId: string | null; classroomId: number | null; questionId: string | null; sourceQuestionId?: string | null }) {
  return `${PREFIX}:${userId || 'anonymous'}:${mode}:${subjectId || 'unknown'}:${classroomId || 'unknown'}:${questionId || sourceQuestionId || 'new'}`
}

export async function saveTeacherQuestionDraft(key: string, state: Omit<TeacherQuestionFormState, 'topics'>) {
  const savedAt = new Date()
  const payload: StoredTeacherQuestionDraft = {
    version: 2,
    savedAt: savedAt.toISOString(),
    expiresAt: new Date(savedAt.getTime() + TEACHER_QUESTION_DRAFT_TTL_MS).toISOString(),
    state: {
      ...state,
      media: {
        ...state.media,
        pendingAsset: state.media.pendingAsset ? { ...state.media.pendingAsset, file: undefined } : null,
      },
    },
  }
  await AsyncStorage.setItem(key, JSON.stringify(payload))
  return payload.savedAt
}

export async function readTeacherQuestionDraft(key: string): Promise<StoredTeacherQuestionDraft | null> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTeacherQuestionDraft>
    const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : 0
    if (parsed.version !== 2 || !parsed.savedAt || !parsed.state || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await AsyncStorage.removeItem(key)
      return null
    }
    return parsed as StoredTeacherQuestionDraft
  } catch {
    await AsyncStorage.removeItem(key)
    return null
  }
}

export async function removeTeacherQuestionDraft(key: string) {
  await AsyncStorage.removeItem(key)
}

export async function removeTeacherQuestionDraftsForUser(userId: string | null | undefined) {
  const keys = await AsyncStorage.getAllKeys()
  const userMarker = userId ? `:${userId}:` : null
  const removable = keys.filter((key) => key.startsWith(LEGACY_PREFIX) || (key.startsWith(`${PREFIX}:`) && Boolean(userMarker && key.includes(userMarker))))
  if (removable.length) await AsyncStorage.multiRemove(removable)
}
