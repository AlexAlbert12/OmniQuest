import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TeacherQuestionFormState } from '../components/teacher/question-form/types'

const PREFIX = 'omniquest:teacher-question-draft:v1'

export type StoredTeacherQuestionDraft = {
  version: 1
  savedAt: string
  state: Omit<TeacherQuestionFormState, 'topics'>
}

export function getTeacherQuestionDraftKey({
  mode,
  subjectId,
  questionId,
}: {
  mode: 'create' | 'edit'
  subjectId: string | null
  questionId: string | null
}) {
  return `${PREFIX}:${mode}:${subjectId || 'unknown'}:${questionId || 'new'}`
}

export async function saveTeacherQuestionDraft(key: string, state: Omit<TeacherQuestionFormState, 'topics'>) {
  const payload: StoredTeacherQuestionDraft = {
    version: 1,
    savedAt: new Date().toISOString(),
    state: {
      ...state,
      media: {
        ...state.media,
        pendingAsset: state.media.pendingAsset
          ? {
              ...state.media.pendingAsset,
              file: undefined,
            }
          : null,
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
    if (parsed.version !== 1 || !parsed.savedAt || !parsed.state) return null
    return parsed as StoredTeacherQuestionDraft
  } catch {
    await AsyncStorage.removeItem(key)
    return null
  }
}

export async function removeTeacherQuestionDraft(key: string) {
  await AsyncStorage.removeItem(key)
}
