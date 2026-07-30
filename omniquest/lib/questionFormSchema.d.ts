import type { QuestionTypeId, AnswerItem, QuestionWizardStep } from '../components/teacher/question-form/types'

export type TeacherQuestionSchemaInput = {
  selectedType: QuestionTypeId
  questionText: string
  timeLimit: string
  points: string
  mediaType: string | null
  mediaAltText: string
  mediaTranscript: string
  mediaSubtitlesVtt: string
  visibleAnswers: AnswerItem[]
  openExpectedAnswer: string
  fillAnswersText: string
  orderItemsText: string
  matchPairsText: string
  dragdropPairsText: string
}

export type TeacherQuestionSchemaIssue = {
  path: string[]
  message: string
  step: QuestionWizardStep
  field: string
  code: 'custom'
}

export const teacherQuestionSchema: {
  safeParse(input: TeacherQuestionSchemaInput):
    | { success: true; data: TeacherQuestionSchemaInput }
    | { success: false; error: { issues: TeacherQuestionSchemaIssue[] } }
}
