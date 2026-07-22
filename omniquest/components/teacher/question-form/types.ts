import { Ionicons } from '@expo/vector-icons'
import type { TeacherQuestionMediaValue } from '../TeacherQuestionMediaEditor'
import type { DifficultyLevel } from '../../../lib/difficulty'

export type QuestionTypeId = 'multiple' | 'boolean' | 'dragdrop' | 'match' | 'fill' | 'order' | 'open'
export type QuestionWizardStep = 1 | 2 | 3 | 4 | 5

export type QuestionTypeCard = {
  id: QuestionTypeId
  title: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
  accent: string
  supported: boolean
}

export type AnswerItem = {
  text: string
  isCorrect: boolean
}

export type TopicOption = {
  id: number
  title: string
}

export type QuestionValidationIssue = {
  step: QuestionWizardStep
  field: string
  message: string
}

export type TeacherQuestionFormOptions = {
  mode: 'create' | 'edit'
  subjectId?: string
  questionId?: string
  initialTopicId?: string | null
  initialClassroomId?: string | null
  initialDifficulty?: string | null
}

export type TeacherQuestionFormState = {
  activeStep: QuestionWizardStep
  selectedType: QuestionTypeId
  questionText: string
  timeLimit: string
  points: string
  optionsCount: number
  explanation: string
  selectedDifficulty: DifficultyLevel
  topics: TopicOption[]
  selectedTopicId: string | null
  answers: AnswerItem[]
  openExpectedAnswer: string
  fillAnswersText: string
  orderItemsText: string
  matchPairsText: string
  dragdropPairsText: string
  media: TeacherQuestionMediaValue
}

export const QUESTION_TIME_LIMIT_MIN = 5
export const QUESTION_TIME_LIMIT_MAX = 300
export const QUESTION_POINTS_MIN = 1
export const QUESTION_POINTS_MAX = 100

export const questionTypes: QuestionTypeCard[] = [
  { id: 'multiple', title: 'Opción múltiple', detail: 'Una pregunta con varias opciones y una respuesta correcta.', icon: 'list', accent: '#8B5CF6', supported: true },
  { id: 'boolean', title: 'Verdadero / Falso', detail: 'El alumnado decide si la afirmación es verdadera o falsa.', icon: 'checkmark-done', accent: '#43D991', supported: true },
  { id: 'dragdrop', title: 'Asignar destinos', detail: 'Relaciona elementos con destinos mediante una interacción guiada.', icon: 'move', accent: '#A78BFA', supported: true },
  { id: 'match', title: 'Unir parejas', detail: 'Conecta cada concepto con su pareja correspondiente.', icon: 'git-compare', accent: '#F6A64A', supported: true },
  { id: 'fill', title: 'Rellenar huecos', detail: 'Completa uno o varios huecos dentro del enunciado.', icon: 'grid', accent: '#60A5FA', supported: true },
  { id: 'order', title: 'Ordenar elementos', detail: 'Coloca los elementos en el orden correcto.', icon: 'reorder-three', accent: '#EC4899', supported: true },
  { id: 'open', title: 'Respuesta abierta', detail: 'El alumno escribe una respuesta que puede requerir revisión.', icon: 'chatbox-ellipses', accent: '#38BDF8', supported: true },
]

export const questionWizardSteps: { number: QuestionWizardStep; label: string; shortLabel: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { number: 1, label: 'Tipo de pregunta', shortLabel: 'Tipo', icon: 'apps-outline' },
  { number: 2, label: 'Enunciado', shortLabel: 'Enunciado', icon: 'create-outline' },
  { number: 3, label: 'Respuestas', shortLabel: 'Respuestas', icon: 'list-outline' },
  { number: 4, label: 'Configuración', shortLabel: 'Ajustes', icon: 'options-outline' },
  { number: 5, label: 'Vista previa', shortLabel: 'Vista previa', icon: 'eye-outline' },
]
