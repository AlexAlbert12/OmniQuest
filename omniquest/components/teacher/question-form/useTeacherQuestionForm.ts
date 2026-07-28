import { useEffect, useMemo, useState } from 'react'
import { Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import type { Json } from '../../../types/database.types'
import { normalizeDifficulty, type DifficultyLevel } from '../../../lib/difficulty'
import { getQuestionMediaManifest, removeQuestionMedia, uploadQuestionMedia } from '../../../lib/questionMedia'
import { supabase } from '../../../lib/supabase'
import type { TeacherQuestionMediaValue } from '../TeacherQuestionMediaEditor'
import { useFormAnalytics } from '../../../hooks/useFormAnalytics'
import { measureRpc } from '../../../lib/analytics'
import {
  QUESTION_POINTS_MAX,
  QUESTION_POINTS_MIN,
  QUESTION_TIME_LIMIT_MAX,
  QUESTION_TIME_LIMIT_MIN,
  questionTypes,
  type AnswerItem,
  type QuestionTypeId,
  type QuestionWizardStep,
  type TeacherQuestionFormOptions,
  type TopicOption,
} from './types'
import {
  buildAnswersForType,
  decodePairAnswer,
  ensureBooleanAnswers,
  fromDatabaseQuestionType,
  getFirstInvalidStep,
  getIntegerRangeError,
  getQuestionValidationIssues,
  getValidTopicId,
  isNumericId,
  issuesForStep,
  parseIntegerField,
  parseLines,
  parsePairLines,
  sanitizeIntegerInput,
  toDatabaseQuestionType,
} from './utils'

const EMPTY_MEDIA: TeacherQuestionMediaValue = {
  type: null,
  url: null,
  path: null,
  durationSeconds: null,
  altText: '',
  caption: '',
  transcript: '',
  subtitlesVtt: '',
  pendingAsset: null,
  removeExisting: false,
}

export function useTeacherQuestionForm({
  mode,
  subjectId,
  questionId,
  initialTopicId = null,
  initialClassroomId = null,
  initialDifficulty = null,
}: TeacherQuestionFormOptions) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  const normalizedSubjectId = normalizeParam(subjectId)
  const normalizedQuestionId = normalizeParam(questionId)
  const normalizedInitialTopicId = normalizeParam(initialTopicId)
  const normalizedInitialClassroomId = normalizeParam(initialClassroomId)
  const normalizedInitialDifficulty = normalizeDifficulty(normalizeParam(initialDifficulty)) || 1

  const [initializing, setInitializing] = useState(isEdit)
  const [activeStep, setActiveStep] = useState<QuestionWizardStep>(1)
  const [selectedType, setSelectedType] = useState<QuestionTypeId>('multiple')
  const [questionText, setQuestionText] = useState('')
  const [timeLimit, setTimeLimit] = useState('30')
  const [points, setPoints] = useState('10')
  const [optionsCount, setOptionsCount] = useState(4)
  const [explanation, setExplanation] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(normalizedInitialDifficulty)
  const [topics, setTopics] = useState<TopicOption[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() =>
    isNumericId(normalizedInitialTopicId) ? normalizedInitialTopicId : null
  )
  const [saving, setSaving] = useState(false)
  const [answers, setAnswers] = useState<AnswerItem[]>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ])
  const [openExpectedAnswer, setOpenExpectedAnswer] = useState('')
  const [fillAnswersText, setFillAnswersText] = useState('')
  const [orderItemsText, setOrderItemsText] = useState('')
  const [matchPairsText, setMatchPairsText] = useState('')
  const [dragdropPairsText, setDragdropPairsText] = useState('')
  const [media, setMedia] = useState<TeacherQuestionMediaValue>(EMPTY_MEDIA)
  const [originalMediaPath, setOriginalMediaPath] = useState<string | null>(null)
  const formAnalytics = useFormAnalytics('teacher_question', {
    mode,
    subject_id: normalizedSubjectId,
  })

  useEffect(() => {
    formAnalytics.updateContext({
      step: activeStep,
      question_type: selectedType,
    })
  }, [activeStep, formAnalytics, selectedType])

  const isMultipleType = selectedType === 'multiple'
  const isBooleanType = selectedType === 'boolean'
  const isChoiceType = isMultipleType || isBooleanType
  const visibleAnswers = isBooleanType ? answers.slice(0, 2) : answers.slice(0, optionsCount)
  const selectedTypeCard = questionTypes.find((item) => item.id === selectedType) || questionTypes[0]
  const parsedTimeLimit = parseIntegerField(timeLimit)
  const parsedPoints = parseIntegerField(points)
  const timeLimitError = getIntegerRangeError('El tiempo', parsedTimeLimit, QUESTION_TIME_LIMIT_MIN, QUESTION_TIME_LIMIT_MAX, 'segundos')
  const pointsError = getIntegerRangeError('Los puntos', parsedPoints, QUESTION_POINTS_MIN, QUESTION_POINTS_MAX, 'puntos')
  const correctIndex = useMemo(() => {
    const index = visibleAnswers.findIndex((answer) => answer.isCorrect)
    return index >= 0 ? index : 0
  }, [visibleAnswers])

  const validationIssues = useMemo(() => getQuestionValidationIssues({
    selectedType,
    questionText,
    timeLimit,
    points,
    mediaType: media.type,
    mediaAltText: media.altText,
    mediaTranscript: media.transcript,
    mediaSubtitlesVtt: media.subtitlesVtt,
    visibleAnswers,
    openExpectedAnswer,
    fillAnswersText,
    orderItemsText,
    matchPairsText,
    dragdropPairsText,
  }), [
    dragdropPairsText,
    fillAnswersText,
    matchPairsText,
    media.altText,
    media.subtitlesVtt,
    media.transcript,
    media.type,
    openExpectedAnswer,
    orderItemsText,
    points,
    questionText,
    selectedType,
    timeLimit,
    visibleAnswers,
  ])

  useEffect(() => {
    let mounted = true
    const loadFormData = async () => {
      if (!normalizedSubjectId) {
        showAlert('Error', 'No se encontró el curso para crear la pregunta.')
        router.back()
        return
      }

      setInitializing(isEdit)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const teacherId = sessionData.session?.user.id
        if (!teacherId) throw new Error('No se encontró una sesión activa.')

        const subjectResult = await supabase
          .from('subjects')
          .select('id')
          .eq('id', Number(normalizedSubjectId))
          .eq('teacher_id', teacherId)
          .single()
        if (subjectResult.error) throw subjectResult.error

        const [topicsResult, questionResult] = await Promise.all([
          supabase
            .from('subject_topics')
            .select('id, title')
            .eq('subject_id', Number(normalizedSubjectId))
            .match(isNumericId(normalizedInitialClassroomId) ? { classroom_id: Number(normalizedInitialClassroomId) } : {})
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          isEdit && normalizedQuestionId
            ? supabase
                .from('questions')
                .select('id, text, type, difficulty, points_base, time_limit_seconds, topic_id, classroom_id, explanation, media_type, media_url, media_path, media_alt_text, media_caption, answers(text, is_correct, sort_order)')
                .eq('id', Number(normalizedQuestionId))
                .eq('subject_id', Number(normalizedSubjectId))
                .single()
            : Promise.resolve({ data: null, error: null }),
        ])

        if (topicsResult.error) throw topicsResult.error
        if (questionResult.error) throw questionResult.error
        if (!mounted) return

        const fetchedTopics = (topicsResult.data || []) as TopicOption[]
        setTopics(fetchedTopics)
        let nextSelectedTopicId = isNumericId(normalizedInitialTopicId) ? normalizedInitialTopicId : null

        if (isEdit && questionResult.data) {
          const questionData = questionResult.data as any
          const mediaManifest = questionData.media_path && normalizedQuestionId
            ? await getQuestionMediaManifest(Number(normalizedQuestionId)).catch(() => null)
            : null
          if (!mounted) return
          const parsedQuestionType = fromDatabaseQuestionType(questionData.type)
          setSelectedType(parsedQuestionType)
          setQuestionText(questionData.text || '')
          setTimeLimit(String(questionData.time_limit_seconds || 30))
          setPoints(String(questionData.points_base || 10))
          setExplanation(questionData.explanation || '')
          setMedia({
            type: questionData.media_type || null,
            url: mediaManifest?.url || null,
            path: questionData.media_path || null,
            durationSeconds: mediaManifest?.durationSeconds || null,
            altText: questionData.media_alt_text || '',
            caption: questionData.media_caption || '',
            transcript: mediaManifest?.transcript || '',
            subtitlesVtt: mediaManifest?.subtitlesVtt || '',
            pendingAsset: null,
            removeExisting: false,
          })
          setOriginalMediaPath(questionData.media_path || null)
          setSelectedDifficulty(normalizeDifficulty(questionData.difficulty) || 1)
          nextSelectedTopicId = questionData.topic_id ? String(questionData.topic_id) : null

          const fetchedAnswers = Array.isArray(questionData.answers)
            ? [...questionData.answers].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            : []
          const parsedAnswers: AnswerItem[] = fetchedAnswers.map((answer: any) => ({
            text: answer.text || '',
            isCorrect: Boolean(answer.is_correct),
          }))

          if (parsedQuestionType === 'boolean') {
            setAnswers(ensureBooleanAnswers(parsedAnswers))
            setOptionsCount(2)
          } else {
            const safeCount = Math.max(2, Math.min(6, parsedAnswers.length || 4))
            const paddedAnswers = [
              ...parsedAnswers,
              ...Array.from({ length: Math.max(0, Math.max(4, safeCount) - parsedAnswers.length) }, (_, index) => ({
                text: '',
                isCorrect: parsedAnswers.length === 0 && index === 0,
              })),
            ]
            if (!paddedAnswers.some((answer) => answer.isCorrect)) paddedAnswers[0].isCorrect = true
            setAnswers(paddedAnswers)
            setOptionsCount(safeCount)
          }

          if (parsedQuestionType === 'open') {
            setOpenExpectedAnswer(parsedAnswers.find((answer) => answer.isCorrect)?.text || parsedAnswers[0]?.text || '')
          }
          if (parsedQuestionType === 'fill') setFillAnswersText(parsedAnswers.map((answer) => answer.text).filter(Boolean).join('\n'))
          if (parsedQuestionType === 'order') setOrderItemsText(fetchedAnswers.map((answer: any) => answer.text || '').filter(Boolean).join('\n'))
          if (parsedQuestionType === 'match' || parsedQuestionType === 'dragdrop') {
            const pairLines = parsedAnswers
              .map((answer) => decodePairAnswer(answer.text))
              .filter(Boolean)
              .map((pair) => `${pair!.left} | ${pair!.right}`)
              .join('\n')
            if (parsedQuestionType === 'match') setMatchPairsText(pairLines)
            else setDragdropPairsText(pairLines)
          }
        }

        if (nextSelectedTopicId && !fetchedTopics.some((topic) => String(topic.id) === nextSelectedTopicId)) {
          nextSelectedTopicId = fetchedTopics[0] ? String(fetchedTopics[0].id) : null
        }
        if (!nextSelectedTopicId && fetchedTopics[0]) nextSelectedTopicId = String(fetchedTopics[0].id)
        setSelectedTopicId(nextSelectedTopicId)
      } catch (error: any) {
        showAlert('Error', error.message || 'No se pudo cargar la información del formulario.')
        router.back()
      } finally {
        if (mounted) setInitializing(false)
      }
    }

    void loadFormData()
    return () => {
      mounted = false
    }
  }, [isEdit, normalizedInitialClassroomId, normalizedInitialTopicId, normalizedQuestionId, normalizedSubjectId, router])

  const updateAnswerText = (text: string, index: number) => {
    setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? { ...answer, text } : answer))
  }

  const markAsCorrect = (indexToMark: number) => {
    setAnswers((current) => current.map((answer, index) => ({ ...answer, isCorrect: index === indexToMark })))
  }

  const handleOptionsCountChange = (nextCount: number) => {
    if (!isMultipleType) return
    const clampedCount = Math.max(2, Math.min(6, nextCount))
    setAnswers((current) => {
      const expanded = current.length >= clampedCount
        ? [...current]
        : [...current, ...Array.from({ length: clampedCount - current.length }, () => ({ text: '', isCorrect: false }))]
      if (!expanded.slice(0, clampedCount).some((answer) => answer.isCorrect)) {
        return expanded.map((answer, index) => ({ ...answer, isCorrect: index === 0 }))
      }
      return expanded
    })
    setOptionsCount(clampedCount)
  }

  const handleTypeSelection = (typeId: QuestionTypeId, supported = true) => {
    formAnalytics.markStarted({ question_type: typeId })
    if (!supported) {
      showAlert('Tipo no disponible', 'Este tipo de pregunta no está activo en este momento.')
      return
    }
    if (typeId === 'boolean') {
      setAnswers((current) => ensureBooleanAnswers(current))
      setOptionsCount(2)
    } else if (selectedType === 'boolean' && typeId === 'multiple') {
      setAnswers([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ])
      setOptionsCount(4)
    }
    setSelectedType(typeId)
  }

  const goToStep = (nextStep: QuestionWizardStep) => {
    formAnalytics.markStarted({ step: nextStep })
    if (nextStep > activeStep) {
      const blockingIssue = validationIssues.find((issue) => issue.step >= activeStep && issue.step < nextStep)
      if (blockingIssue) {
        showAlert(blockingIssue.field, blockingIssue.message)
        setActiveStep(blockingIssue.step)
        return
      }
    }
    setActiveStep(nextStep)
  }

  const handleNextStep = () => {
    formAnalytics.markStarted({ step: activeStep })
    const issue = issuesForStep(validationIssues, activeStep)[0]
    if (issue) {
      showAlert(issue.field, issue.message)
      return
    }
    setActiveStep((current) => Math.min(5, current + 1) as QuestionWizardStep)
  }

  const handlePreviousStep = () => setActiveStep((current) => Math.max(1, current - 1) as QuestionWizardStep)

  const handleSave = async () => {
    if (!normalizedSubjectId) {
      showAlert('Error', 'No se encontró el curso para guardar la pregunta.')
      return
    }
    if (isEdit && !normalizedQuestionId) {
      showAlert('Error', 'No se encontró la pregunta a editar.')
      return
    }

    const firstInvalidStep = getFirstInvalidStep(validationIssues)
    if (firstInvalidStep) {
      const issue = validationIssues.find((item) => item.step === firstInvalidStep)
      setActiveStep(firstInvalidStep)
      if (issue) showAlert(issue.field, issue.message)
      return
    }

    const answersToSave = buildAnswersForType({
      selectedType,
      questionId: isEdit && normalizedQuestionId ? Number(normalizedQuestionId) : 0,
      visibleAnswers,
      openExpectedAnswer,
      fillLines: parseLines(fillAnswersText),
      orderLines: parseLines(orderItemsText),
      matchPairs: parsePairLines(matchPairsText),
      dragdropPairs: parsePairLines(dragdropPairsText),
    })

    setSaving(true)
    let uploadedPath: string | null = null
    try {
      let mediaType = media.type
      let mediaPath = media.path
      let mediaDurationSeconds = media.durationSeconds
      if (media.pendingAsset) {
        const uploaded = await uploadQuestionMedia(media.pendingAsset, Number(normalizedSubjectId))
        mediaType = uploaded.type
        mediaPath = uploaded.path
        mediaDurationSeconds = uploaded.durationSeconds
        uploadedPath = uploaded.path
      }

      const { error } = await measureRpc(
        'save_teacher_question',
        async () => supabase.rpc('save_teacher_question', {
          p_subject_id: Number(normalizedSubjectId),
          p_question_id: isEdit ? Number(normalizedQuestionId) : null,
          p_classroom_id: isNumericId(normalizedInitialClassroomId) ? Number(normalizedInitialClassroomId) : null,
          p_topic_id: getValidTopicId(selectedTopicId, topics),
          p_type: toDatabaseQuestionType(selectedType),
          p_text: questionText.trim(),
          p_points_base: parsedPoints as number,
          p_time_limit_seconds: parsedTimeLimit as number,
          p_difficulty: selectedDifficulty,
          p_explanation: explanation.trim() || null,
          p_answers: answersToSave as unknown as Json,
          p_media_type: mediaType,
          p_media_url: null,
          p_media_path: mediaPath,
          p_media_alt_text: mediaType === 'image' ? media.altText.trim() || null : null,
          p_media_caption: media.caption.trim() || null,
          p_media_duration_seconds: mediaDurationSeconds,
          p_media_transcript: mediaType === 'audio' ? media.transcript.trim() || null : null,
          p_media_subtitles_vtt: mediaType === 'video' ? media.subtitlesVtt.trim() || null : null,
        } as any),
        { subjectId: Number(normalizedSubjectId), properties: { question_type: selectedType } },
      )
      if (error) throw error

      formAnalytics.markCompleted()

      if (originalMediaPath && originalMediaPath !== mediaPath && (media.removeExisting || media.pendingAsset)) {
        try {
          await removeQuestionMedia(originalMediaPath)
        } catch (cleanupError) {
          console.warn('No se pudo eliminar el archivo multimedia anterior:', cleanupError)
        }
      }

      showAlert(isEdit ? 'Pregunta actualizada' : 'Pregunta creada', isEdit ? 'Los cambios se guardaron correctamente.' : 'La pregunta se guardó correctamente.')
      router.back()
    } catch (error: any) {
      if (uploadedPath) {
        try {
          await removeQuestionMedia(uploadedPath)
        } catch {
          // The main save error is more relevant than a failed cleanup.
        }
      }
      showAlert('Error', error.message || 'No se pudo guardar la pregunta.')
    } finally {
      setSaving(false)
    }
  }

  return {
    router,
    isEdit,
    initializing,
    saving,
    activeStep,
    selectedType,
    selectedTypeCard,
    questionText,
    timeLimit,
    points,
    optionsCount,
    explanation,
    selectedDifficulty,
    topics,
    selectedTopicId,
    answers,
    visibleAnswers,
    isMultipleType,
    isBooleanType,
    isChoiceType,
    correctIndex,
    openExpectedAnswer,
    fillAnswersText,
    orderItemsText,
    matchPairsText,
    dragdropPairsText,
    media,
    parsedTimeLimit,
    parsedPoints,
    timeLimitError,
    pointsError,
    validationIssues,
    setQuestionText: (value: string) => {
      formAnalytics.markStarted()
      setQuestionText(value)
    },
    setTimeLimit: (value: string) => setTimeLimit(sanitizeIntegerInput(value)),
    setPoints: (value: string) => setPoints(sanitizeIntegerInput(value)),
    setExplanation,
    setSelectedDifficulty,
    setSelectedTopicId,
    setOpenExpectedAnswer,
    setFillAnswersText,
    setOrderItemsText,
    setMatchPairsText,
    setDragdropPairsText,
    setMedia,
    handleTypeSelection,
    handleOptionsCountChange,
    updateAnswerText,
    markAsCorrect,
    goToStep,
    handleNextStep,
    handlePreviousStep,
    handleSave,
  }
}

function normalizeParam(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`)
    return
  }
  Alert.alert(title, message)
}
