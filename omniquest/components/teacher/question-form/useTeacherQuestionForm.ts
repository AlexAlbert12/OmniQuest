import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import type { Json } from '../../../types/database.types'
import { normalizeDifficulty, type DifficultyLevel } from '../../../lib/difficulty'
import {
  cloneQuestionMedia,
  getQuestionMediaManifest,
  isQuestionMediaUploadCancelled,
  removeQuestionMedia,
  uploadQuestionMedia,
  type QuestionMediaUploadStage,
} from '../../../lib/questionMedia'
import {
  getTeacherQuestionDraftKey,
  readTeacherQuestionDraft,
  removeTeacherQuestionDraft,
  saveTeacherQuestionDraft,
} from '../../../lib/questionDraftStorage'
import { teacherQuestionSchema } from '../../../lib/questionFormSchema.js'
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
  type ClassroomOption,
  type QuestionTypeId,
  type QuestionValidationIssue,
  type QuestionWizardStep,
  type TeacherQuestionFormOptions,
  type TeacherQuestionFormState,
  type TopicOption,
} from './types'
import {
  buildAnswersForType,
  decodePairAnswer,
  ensureBooleanAnswers,
  fromDatabaseQuestionType,
  getFirstInvalidStep,
  getIntegerRangeError,
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

const AUTOSAVE_DELAY_MS = 900

type QuestionSeedRow = {
  id: number
  text: string | null
  type: string
  difficulty: number | null
  points_base: number | null
  time_limit_seconds: number | null
  topic_id: number | null
  classroom_id: number | null
  explanation: string | null
  hint: string | null
  media_type: 'image' | 'audio' | 'video' | null
  media_path: string | null
  media_alt_text: string | null
  media_caption: string | null
  answers: { text: string | null; is_correct: boolean | null; sort_order: number | null }[] | null
}

export function useTeacherQuestionForm({
  mode,
  subjectId,
  questionId,
  sourceQuestionId = null,
  initialTopicId = null,
  initialClassroomId = null,
  initialDifficulty = null,
}: TeacherQuestionFormOptions) {
  const router = useRouter()
  const navigation = useNavigation()
  const isEdit = mode === 'edit'
  const normalizedSubjectId = normalizeParam(subjectId)
  const normalizedQuestionId = normalizeParam(questionId)
  const normalizedSourceQuestionId = normalizeParam(sourceQuestionId)
  const normalizedInitialTopicId = normalizeParam(initialTopicId)
  const normalizedInitialClassroomId = normalizeParam(initialClassroomId)
  const normalizedInitialDifficulty = normalizeDifficulty(normalizeParam(initialDifficulty)) || 1

  const [initializing, setInitializing] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [subjectName, setSubjectName] = useState('')
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null)
  const [changingClassroom, setChangingClassroom] = useState(false)
  const [activeStep, setActiveStep] = useState<QuestionWizardStep>(1)
  const [selectedType, setSelectedType] = useState<QuestionTypeId>('multiple')
  const [questionText, setQuestionText] = useState('')
  const [timeLimit, setTimeLimit] = useState('30')
  const [points, setPoints] = useState('10')
  const [optionsCount, setOptionsCount] = useState(4)
  const [explanation, setExplanation] = useState('')
  const [hint, setHint] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(normalizedInitialDifficulty)
  const [topics, setTopics] = useState<TopicOption[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
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
  const [sourceMediaPath, setSourceMediaPath] = useState<string | null>(null)
  const [sourceQuestionPrefilled, setSourceQuestionPrefilled] = useState(false)
  const [sourceMediaUnavailable, setSourceMediaUnavailable] = useState(false)
  const [draftMediaNeedsReattach, setDraftMediaNeedsReattach] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [validationAttemptedSteps, setValidationAttemptedSteps] = useState<QuestionWizardStep[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0)
  const [mediaUploadStage, setMediaUploadStage] = useState<QuestionMediaUploadStage | null>(null)

  const leaveApprovedRef = useRef(false)
  const baselineFingerprintRef = useRef('')
  const lastSavedFingerprintRef = useRef('')
  const currentDraftFingerprintRef = useRef('')
  const loadedDraftKeyRef = useRef<string | null>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)

  const formAnalytics = useFormAnalytics('teacher_question', { mode, subject_id: normalizedSubjectId })

  useEffect(() => {
    formAnalytics.updateContext({ step: activeStep, question_type: selectedType, classroom_id: selectedClassroomId })
  }, [activeStep, formAnalytics, selectedClassroomId, selectedType])

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
  const selectedClassroom = useMemo(() => classrooms.find((classroom) => classroom.id === selectedClassroomId) || null, [classrooms, selectedClassroomId])
  const selectedTopic = useMemo(() => topics.find((topic) => String(topic.id) === selectedTopicId) || null, [selectedTopicId, topics])
  const contextLabel = useMemo(() => [subjectName, selectedClassroom?.name, selectedTopic?.title].filter(Boolean).join(' · '), [selectedClassroom?.name, selectedTopic?.title, subjectName])

  const validationIssues = useMemo<QuestionValidationIssue[]>(() => {
    const result = teacherQuestionSchema.safeParse({
      selectedType,
      questionText,
      timeLimit,
      points,
      explanation,
      hint,
      mediaType: media.type,
      mediaAltText: media.altText,
      mediaCaption: media.caption,
      mediaTranscript: media.transcript,
      mediaSubtitlesVtt: media.subtitlesVtt,
      visibleAnswers,
      openExpectedAnswer,
      fillAnswersText,
      orderItemsText,
      matchPairsText,
      dragdropPairsText,
    })
    if (result.success) return []
    return result.error.issues.map((issue) => ({ step: issue.step, field: issue.field, message: issue.message }))
  }, [dragdropPairsText, explanation, fillAnswersText, hint, matchPairsText, media.altText, media.caption, media.subtitlesVtt, media.transcript, media.type, openExpectedAnswer, orderItemsText, points, questionText, selectedType, timeLimit, visibleAnswers])

  const visibleValidationIssues = useMemo(() => validationIssues.filter((issue) => validationAttemptedSteps.includes(issue.step)), [validationAttemptedSteps, validationIssues])

  const draftState = useMemo<Omit<TeacherQuestionFormState, 'topics'>>(() => ({
    activeStep,
    selectedType,
    questionText,
    timeLimit,
    points,
    optionsCount,
    explanation,
    hint,
    selectedDifficulty,
    selectedClassroomId,
    selectedTopicId,
    answers,
    openExpectedAnswer,
    fillAnswersText,
    orderItemsText,
    matchPairsText,
    dragdropPairsText,
    media,
  }), [activeStep, answers, dragdropPairsText, explanation, fillAnswersText, hint, matchPairsText, media, openExpectedAnswer, optionsCount, orderItemsText, points, questionText, selectedClassroomId, selectedDifficulty, selectedTopicId, selectedType, timeLimit])
  const draftFingerprint = useMemo(() => fingerprintDraft(draftState), [draftState])

  useEffect(() => { currentDraftFingerprintRef.current = draftFingerprint }, [draftFingerprint])

  const draftKey = useMemo(() => currentUserId && normalizedSubjectId && selectedClassroomId
    ? getTeacherQuestionDraftKey({
        mode,
        userId: currentUserId,
        subjectId: normalizedSubjectId,
        classroomId: selectedClassroomId,
        questionId: normalizedQuestionId,
        sourceQuestionId: normalizedSourceQuestionId,
      })
    : null,
  [currentUserId, mode, normalizedQuestionId, normalizedSourceQuestionId, normalizedSubjectId, selectedClassroomId])

  const applySeed = useCallback(async (questionData: QuestionSeedRow, asSource: boolean) => {
    const parsedQuestionType = fromDatabaseQuestionType(questionData.type)
    setSelectedType(parsedQuestionType)
    setQuestionText(questionData.text || '')
    setTimeLimit(String(questionData.time_limit_seconds || 30))
    setPoints(String(questionData.points_base || 10))
    setExplanation(questionData.explanation || '')
    setHint(questionData.hint || '')
    setSelectedDifficulty(normalizeDifficulty(questionData.difficulty) || 1)

    let manifest = null
    if (questionData.media_path) manifest = await getQuestionMediaManifest(questionData.id).catch(() => null)
    if (questionData.media_type && questionData.media_path && !manifest) setSourceMediaUnavailable(asSource)
    setMedia(questionData.media_type && manifest ? {
      type: questionData.media_type,
      url: manifest.url,
      path: asSource ? null : questionData.media_path,
      durationSeconds: manifest.durationSeconds,
      altText: questionData.media_alt_text || '',
      caption: questionData.media_caption || '',
      transcript: manifest.transcript || '',
      subtitlesVtt: manifest.subtitlesVtt || '',
      pendingAsset: null,
      removeExisting: false,
    } : EMPTY_MEDIA)
    setOriginalMediaPath(asSource ? null : questionData.media_path || null)
    setSourceMediaPath(asSource ? questionData.media_path || null : null)

    const fetchedAnswers = Array.isArray(questionData.answers)
      ? [...questionData.answers].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      : []
    const parsedAnswers: AnswerItem[] = fetchedAnswers.map((answer) => ({ text: answer.text || '', isCorrect: Boolean(answer.is_correct) }))

    if (parsedQuestionType === 'boolean') {
      setAnswers(ensureBooleanAnswers(parsedAnswers))
      setOptionsCount(2)
    } else {
      const safeCount = Math.max(2, Math.min(6, parsedAnswers.length || 4))
      const paddedAnswers = [...parsedAnswers, ...Array.from({ length: Math.max(0, Math.max(4, safeCount) - parsedAnswers.length) }, (_, index) => ({ text: '', isCorrect: parsedAnswers.length === 0 && index === 0 }))]
      if (!paddedAnswers.some((answer) => answer.isCorrect)) paddedAnswers[0].isCorrect = true
      setAnswers(paddedAnswers)
      setOptionsCount(safeCount)
    }
    setOpenExpectedAnswer(parsedQuestionType === 'open' ? parsedAnswers.find((answer) => answer.isCorrect)?.text || parsedAnswers[0]?.text || '' : '')
    setFillAnswersText(parsedQuestionType === 'fill' ? parsedAnswers.map((answer) => answer.text).filter(Boolean).join('\n') : '')
    setOrderItemsText(parsedQuestionType === 'order' ? fetchedAnswers.map((answer) => answer.text || '').filter(Boolean).join('\n') : '')
    const pairLines = parsedQuestionType === 'match' || parsedQuestionType === 'dragdrop'
      ? parsedAnswers.map((answer) => decodePairAnswer(answer.text)).filter(Boolean).map((pair) => `${pair!.left} | ${pair!.right}`).join('\n')
      : ''
    setMatchPairsText(parsedQuestionType === 'match' ? pairLines : '')
    setDragdropPairsText(parsedQuestionType === 'dragdrop' ? pairLines : '')
  }, [])

  const applyDraftState = useCallback((state: Omit<TeacherQuestionFormState, 'topics'>) => {
    setActiveStep(clampStep(state.activeStep))
    setSelectedType(state.selectedType)
    setQuestionText(state.questionText || '')
    setTimeLimit(state.timeLimit || '30')
    setPoints(state.points || '10')
    setOptionsCount(Math.max(2, Math.min(6, state.optionsCount || 4)))
    setExplanation(state.explanation || '')
    setHint(state.hint || '')
    setSelectedDifficulty(normalizeDifficulty(state.selectedDifficulty) || 1)
    setSelectedTopicId(state.selectedTopicId || null)
    setAnswers(Array.isArray(state.answers) && state.answers.length ? state.answers : [{ text: '', isCorrect: true }, { text: '', isCorrect: false }])
    setOpenExpectedAnswer(state.openExpectedAnswer || '')
    setFillAnswersText(state.fillAnswersText || '')
    setOrderItemsText(state.orderItemsText || '')
    setMatchPairsText(state.matchPairsText || '')
    setDragdropPairsText(state.dragdropPairsText || '')
    setMedia({ ...EMPTY_MEDIA, ...(state.media || {}), pendingAsset: state.media?.pendingAsset || null })
  }, [])

  useEffect(() => {
    let mounted = true
    const loadFormData = async () => {
      if (!normalizedSubjectId || !isNumericId(normalizedSubjectId)) {
        showAlert('Error', 'No se encontró el curso para crear la pregunta.')
        router.back()
        return
      }

      setInitializing(true)
      setDraftReady(false)
      try {
        const subjectNumericId = Number(normalizedSubjectId)
        const { data: sessionData } = await supabase.auth.getSession()
        const teacherId = sessionData.session?.user.id
        if (!teacherId) throw new Error('No se encontró una sesión activa.')

        const seedId = isEdit ? normalizedQuestionId : normalizedSourceQuestionId
        const [subjectResult, classroomsResult, seedResult] = await Promise.all([
          supabase.from('subjects').select('id, name').eq('id', subjectNumericId).eq('teacher_id', teacherId).single(),
          supabase.from('classrooms').select('id, name, code, academic_year, created_at').eq('subject_id', subjectNumericId).eq('active', true).order('created_at', { ascending: true }),
          seedId && isNumericId(seedId)
            ? supabase.from('questions').select('id, text, type, difficulty, points_base, time_limit_seconds, topic_id, classroom_id, explanation, hint, media_type, media_path, media_alt_text, media_caption, answers(text, is_correct, sort_order)').eq('id', Number(seedId)).eq('subject_id', subjectNumericId).single()
            : Promise.resolve({ data: null, error: null }),
        ])
        if (subjectResult.error) throw subjectResult.error
        if (classroomsResult.error) throw classroomsResult.error
        if (seedResult.error) throw seedResult.error
        if (!mounted) return

        let fetchedClassrooms = (classroomsResult.data || []).map((row) => ({ id: row.id, name: row.name, code: row.code, academicYear: row.academic_year })) as ClassroomOption[]
        if (!fetchedClassrooms.length) {
          const { data: defaultClassroomId, error: defaultError } = await supabase.rpc('ensure_default_classroom', { p_subject_id: subjectNumericId } as any)
          if (defaultError) throw defaultError
          const { data: defaultRows, error: reloadError } = await supabase.from('classrooms').select('id, name, code, academic_year, created_at').eq('subject_id', subjectNumericId).eq('active', true).order('created_at', { ascending: true })
          if (reloadError) throw reloadError
          fetchedClassrooms = (defaultRows || []).map((row) => ({ id: row.id, name: row.name, code: row.code, academicYear: row.academic_year })) as ClassroomOption[]
          if (!fetchedClassrooms.length && typeof defaultClassroomId === 'number') throw new Error('No se pudo cargar la clase principal del curso.')
        }
        if (!fetchedClassrooms.length) throw new Error('El curso necesita una clase activa antes de crear preguntas.')

        const seed = seedResult.data as QuestionSeedRow | null
        const seedClassroomId = seed?.classroom_id || null
        const initialClassroomNumeric = isNumericId(normalizedInitialClassroomId) ? Number(normalizedInitialClassroomId) : null
        const desiredClassroomId = seedClassroomId && fetchedClassrooms.some((item) => item.id === seedClassroomId)
          ? seedClassroomId
          : initialClassroomNumeric && fetchedClassrooms.some((item) => item.id === initialClassroomNumeric)
            ? initialClassroomNumeric
            : fetchedClassrooms[0].id
        const fetchedTopics = await fetchTopicsForClassroom(subjectNumericId, desiredClassroomId)
        if (!mounted) return

        setCurrentUserId(teacherId)
        setSubjectName(subjectResult.data.name || 'Curso')
        setClassrooms(fetchedClassrooms)
        setSelectedClassroomId(desiredClassroomId)
        setTopics(fetchedTopics)

        let nextTopicId = seed?.topic_id ? String(seed.topic_id) : isNumericId(normalizedInitialTopicId) ? normalizedInitialTopicId : null
        if (seed) {
          await applySeed(seed, !isEdit)
          if (!mounted) return
          setSourceQuestionPrefilled(!isEdit && Boolean(normalizedSourceQuestionId))
        }
        if (nextTopicId && !fetchedTopics.some((topic) => String(topic.id) === nextTopicId)) nextTopicId = null
        if (!nextTopicId && fetchedTopics[0]) nextTopicId = String(fetchedTopics[0].id)
        setSelectedTopicId(nextTopicId)
      } catch (error: unknown) {
        showAlert('Error', error instanceof Error ? error.message : 'No se pudo cargar la información del formulario.')
        leaveApprovedRef.current = true
        router.back()
      } finally {
        if (mounted) setInitializing(false)
      }
    }

    void loadFormData()
    return () => { mounted = false }
  }, [applySeed, isEdit, normalizedInitialClassroomId, normalizedInitialTopicId, normalizedQuestionId, normalizedSourceQuestionId, normalizedSubjectId, router])

  useEffect(() => {
    if (initializing || !draftKey || loadedDraftKeyRef.current === draftKey) return
    let mounted = true
    loadedDraftKeyRef.current = draftKey
    setDraftReady(false)
    setDraftRestored(false)
    setDraftMediaNeedsReattach(false)
    baselineFingerprintRef.current = currentDraftFingerprintRef.current
    lastSavedFingerprintRef.current = currentDraftFingerprintRef.current

    void readTeacherQuestionDraft(draftKey)
      .then(async (draft) => {
        if (!mounted || !draft || draft.state.selectedClassroomId !== selectedClassroomId) return
        const restoredState = { ...draft.state }
        if (restoredState.selectedTopicId && !topics.some((topic) => String(topic.id) === restoredState.selectedTopicId)) restoredState.selectedTopicId = topics[0] ? String(topics[0].id) : null
        if (restoredState.media?.pendingAsset && !(await canAccessPendingAsset(restoredState.media.pendingAsset))) {
          restoredState.media = { ...restoredState.media, type: null, url: null, path: null, pendingAsset: null, durationSeconds: null }
          setDraftMediaNeedsReattach(true)
        }
        applyDraftState(restoredState)
        setDraftRestored(true)
        setDraftSavedAt(draft.savedAt)
        setDraftStatus('saved')
        const restoredFingerprint = fingerprintDraft(restoredState)
        baselineFingerprintRef.current = restoredFingerprint
        lastSavedFingerprintRef.current = restoredFingerprint
      })
      .finally(() => { if (mounted) setDraftReady(true) })

    return () => { mounted = false }
  }, [applyDraftState, draftKey, initializing, selectedClassroomId, topics])

  useEffect(() => {
    if (!draftReady || !draftKey || saving) return
    const changed = draftFingerprint !== baselineFingerprintRef.current
    setHasUnsavedChanges(changed)
    if (!changed || draftFingerprint === lastSavedFingerprintRef.current) return

    setDraftStatus('pending')
    const timer = setTimeout(() => {
      setDraftStatus('saving')
      void saveTeacherQuestionDraft(draftKey, draftState)
        .then((savedAt) => {
          lastSavedFingerprintRef.current = draftFingerprint
          setDraftSavedAt(savedAt)
          setDraftStatus('saved')
        })
        .catch(() => setDraftStatus('error'))
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draftFingerprint, draftKey, draftReady, draftState, saving])



  const saveCurrentDraftNow = useCallback(async () => {
    if (!draftKey) return
    setDraftStatus('saving')
    const savedAt = await saveTeacherQuestionDraft(draftKey, draftState)
    const fingerprint = fingerprintDraft(draftState)
    lastSavedFingerprintRef.current = fingerprint
    setDraftSavedAt(savedAt)
    setDraftStatus('saved')
  }, [draftKey, draftState])

  const confirmLeave = useCallback((onLeave: () => void) => {
    if (!hasUnsavedChanges || leaveApprovedRef.current) {
      onLeave()
      return
    }
    Alert.alert('Hay cambios sin publicar', 'Los cambios se conservarán localmente para que puedas continuar más tarde.', [
      { text: 'Seguir editando', style: 'cancel' },
      {
        text: 'Salir y conservar borrador',
        style: 'default',
        onPress: async () => {
          try {
            await saveCurrentDraftNow()
            leaveApprovedRef.current = true
            onLeave()
          } catch {
            showAlert('No se pudo guardar el borrador', 'Inténtalo de nuevo antes de salir para no perder los cambios.')
          }
        },
      },
    ])
  }, [hasUnsavedChanges, saveCurrentDraftNow])

  const requestClose = useCallback(() => confirmLeave(() => router.back()), [confirmLeave, router])

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.('beforeRemove', (event: any) => {
      if (!hasUnsavedChanges || leaveApprovedRef.current || saving) return
      event.preventDefault()
      confirmLeave(() => (navigation as any).dispatch(event.data.action))
    })
    return unsubscribe
  }, [confirmLeave, hasUnsavedChanges, navigation, saving])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || leaveApprovedRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  const updateAnswerText = (text: string, index: number) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? { ...answer, text } : answer))
  const markAsCorrect = (indexToMark: number) => setAnswers((current) => current.map((answer, index) => ({ ...answer, isCorrect: index === indexToMark })))

  const handleOptionsCountChange = (nextCount: number) => {
    if (!isMultipleType) return
    const clampedCount = Math.max(2, Math.min(6, nextCount))
    setAnswers((current) => {
      const expanded = current.length >= clampedCount ? [...current] : [...current, ...Array.from({ length: clampedCount - current.length }, () => ({ text: '', isCorrect: false }))]
      if (!expanded.slice(0, clampedCount).some((answer) => answer.isCorrect)) return expanded.map((answer, index) => ({ ...answer, isCorrect: index === 0 }))
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
      setAnswers([{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }])
      setOptionsCount(4)
    }
    setSelectedType(typeId)
  }

  const revealStepValidation = useCallback((step: QuestionWizardStep) => setValidationAttemptedSteps((current) => current.includes(step) ? current : [...current, step]), [])

  const goToStep = (nextStep: QuestionWizardStep) => {
    formAnalytics.markStarted({ step: nextStep })
    if (nextStep > activeStep) {
      const blockingIssue = validationIssues.find((issue) => issue.step >= activeStep && issue.step < nextStep)
      if (blockingIssue) {
        revealStepValidation(blockingIssue.step)
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
      revealStepValidation(activeStep)
      showAlert(issue.field, issue.message)
      return
    }
    setActiveStep((current) => Math.min(5, current + 1) as QuestionWizardStep)
  }

  const handlePreviousStep = () => setActiveStep((current) => Math.max(1, current - 1) as QuestionWizardStep)
  const cancelMediaUpload = useCallback(() => uploadControllerRef.current?.abort(), [])

  const handleClassroomChange = useCallback(async (nextClassroomId: number) => {
    if (!normalizedSubjectId || nextClassroomId === selectedClassroomId || changingClassroom) return
    if (!classrooms.some((classroom) => classroom.id === nextClassroomId)) return
    setChangingClassroom(true)
    try {
      if (hasUnsavedChanges && draftKey) await saveTeacherQuestionDraft(draftKey, draftState)
      const nextTopics = await fetchTopicsForClassroom(Number(normalizedSubjectId), nextClassroomId)
      setSelectedClassroomId(nextClassroomId)
      setTopics(nextTopics)
      setSelectedTopicId(nextTopics[0] ? String(nextTopics[0].id) : null)
      setDraftReady(false)
      setDraftRestored(false)
      loadedDraftKeyRef.current = null
    } catch (error: unknown) {
      showAlert('No se pudo cambiar de clase', error instanceof Error ? error.message : 'Inténtalo de nuevo.')
    } finally {
      setChangingClassroom(false)
    }
  }, [changingClassroom, classrooms, draftKey, draftState, hasUnsavedChanges, normalizedSubjectId, selectedClassroomId])

  const handleSave = async () => {
    if (!normalizedSubjectId || !isNumericId(normalizedSubjectId)) {
      showAlert('Error', 'No se encontró el curso para guardar la pregunta.')
      return
    }
    if (!selectedClassroomId) {
      showAlert('Clase', 'Selecciona una clase antes de guardar la pregunta.')
      return
    }
    if (isEdit && !normalizedQuestionId) {
      showAlert('Error', 'No se encontró la pregunta a editar.')
      return
    }

    const firstInvalidStep = getFirstInvalidStep(validationIssues)
    if (firstInvalidStep) {
      setValidationAttemptedSteps([1, 2, 3, 4, 5])
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
        const controller = new AbortController()
        uploadControllerRef.current = controller
        setUploadingMedia(true)
        setMediaUploadProgress(0)
        const uploaded = await uploadQuestionMedia(media.pendingAsset, Number(normalizedSubjectId), {
          signal: controller.signal,
          onProgress: (progress, stage) => {
            setMediaUploadProgress(progress)
            setMediaUploadStage(stage)
          },
        })
        mediaType = uploaded.type
        mediaPath = uploaded.path
        mediaDurationSeconds = uploaded.durationSeconds
        uploadedPath = uploaded.path
      } else if (!isEdit && sourceMediaPath && media.type && media.url && !media.path) {
        setUploadingMedia(true)
        setMediaUploadStage('uploading')
        setMediaUploadProgress(35)
        const cloned = await cloneQuestionMedia({ type: media.type, url: media.url, sourcePath: sourceMediaPath, subjectId: Number(normalizedSubjectId), durationSeconds: media.durationSeconds })
        mediaType = cloned.type
        mediaPath = cloned.path
        mediaDurationSeconds = cloned.durationSeconds
        uploadedPath = cloned.path
        setMediaUploadProgress(100)
        setMediaUploadStage('complete')
      }

      const { error } = await measureRpc('save_teacher_question', async () => supabase.rpc('save_teacher_question_v2', {
        p_subject_id: Number(normalizedSubjectId),
        p_question_id: isEdit ? Number(normalizedQuestionId) : null,
        p_classroom_id: selectedClassroomId,
        p_topic_id: getValidTopicId(selectedTopicId, topics),
        p_type: toDatabaseQuestionType(selectedType),
        p_text: questionText.trim(),
        p_points_base: parsedPoints as number,
        p_time_limit_seconds: parsedTimeLimit as number,
        p_difficulty: selectedDifficulty,
        p_explanation: explanation.trim() || null,
        p_hint: hint.trim() || null,
        p_answers: answersToSave as unknown as Json,
        p_media_type: mediaType,
        p_media_url: null,
        p_media_path: mediaPath,
        p_media_alt_text: mediaType === 'image' ? media.altText.trim() || null : null,
        p_media_caption: media.caption.trim() || null,
        p_media_duration_seconds: mediaDurationSeconds,
        p_media_transcript: mediaType === 'audio' ? media.transcript.trim() || null : null,
        p_media_subtitles_vtt: mediaType === 'video' ? media.subtitlesVtt.trim() || null : null,
      } as any), { subjectId: Number(normalizedSubjectId), properties: { question_type: selectedType, classroom_id: selectedClassroomId } })
      if (error) throw error

      formAnalytics.markCompleted()
      if (originalMediaPath && originalMediaPath !== mediaPath && (media.removeExisting || media.pendingAsset)) {
        try { await removeQuestionMedia(originalMediaPath) } catch (cleanupError) { console.warn('No se pudo eliminar el archivo multimedia anterior:', cleanupError) }
      }

      if (draftKey) await removeTeacherQuestionDraft(draftKey).catch(() => undefined)
      leaveApprovedRef.current = true
      baselineFingerprintRef.current = draftFingerprint
      lastSavedFingerprintRef.current = draftFingerprint
      setHasUnsavedChanges(false)
      showAlert(isEdit ? 'Pregunta actualizada' : 'Pregunta creada', isEdit ? 'Los cambios se guardaron correctamente.' : 'La pregunta se guardó correctamente.')
      router.back()
    } catch (error: unknown) {
      if (uploadedPath) {
        try { await removeQuestionMedia(uploadedPath) } catch { /* best effort */ }
      }
      if (isQuestionMediaUploadCancelled(error)) showAlert('Subida cancelada', 'El archivo no se ha publicado. El resto del borrador sigue guardado.')
      else showAlert('Error', error instanceof Error ? error.message : 'No se pudo guardar la pregunta.')
    } finally {
      uploadControllerRef.current = null
      setUploadingMedia(false)
      setMediaUploadStage(null)
      setSaving(false)
    }
  }

  return {
    router,
    isEdit,
    initializing,
    saving,
    currentUserId,
    subjectName,
    classrooms,
    selectedClassroomId,
    selectedClassroom,
    changingClassroom,
    contextLabel,
    activeStep,
    selectedType,
    selectedTypeCard,
    questionText,
    timeLimit,
    points,
    optionsCount,
    explanation,
    hint,
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
    visibleValidationIssues,
    draftRestored,
    draftStatus,
    draftSavedAt,
    hasUnsavedChanges,
    draftMediaNeedsReattach,
    sourceQuestionPrefilled,
    sourceMediaUnavailable,
    uploadingMedia,
    mediaUploadProgress,
    mediaUploadStage,
    setQuestionText: (value: string) => { formAnalytics.markStarted(); setQuestionText(value) },
    setTimeLimit: (value: string) => setTimeLimit(sanitizeIntegerInput(value)),
    setPoints: (value: string) => setPoints(sanitizeIntegerInput(value)),
    setExplanation,
    setHint,
    setSelectedDifficulty,
    setSelectedTopicId,
    setOpenExpectedAnswer,
    setFillAnswersText,
    setOrderItemsText,
    setMatchPairsText,
    setDragdropPairsText,
    setMedia: (value: TeacherQuestionMediaValue) => {
      setMedia(value)
      if (value.pendingAsset || !value.type) {
        setDraftMediaNeedsReattach(false)
        setSourceMediaUnavailable(false)
        if (value.pendingAsset) setSourceMediaPath(null)
      }
    },
    handleTypeSelection,
    handleOptionsCountChange,
    updateAnswerText,
    markAsCorrect,
    goToStep,
    handleNextStep,
    handlePreviousStep,
    handleClassroomChange,
    handleSave,
    requestClose,
    cancelMediaUpload,
  }
}

async function fetchTopicsForClassroom(subjectId: number, classroomId: number): Promise<TopicOption[]> {
  const { data, error } = await supabase.from('subject_topics').select('id, title').eq('subject_id', subjectId).eq('classroom_id', classroomId).eq('active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as TopicOption[]
}

async function canAccessPendingAsset(asset: NonNullable<TeacherQuestionMediaValue['pendingAsset']>) {
  if (asset.file) return true
  if (!asset.uri) return false
  try {
    const response = await fetch(asset.uri, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

function normalizeParam(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null
}

function clampStep(value: unknown): QuestionWizardStep {
  const numeric = Number(value)
  return Math.max(1, Math.min(5, Number.isFinite(numeric) ? numeric : 1)) as QuestionWizardStep
}

function fingerprintDraft(state: Omit<TeacherQuestionFormState, 'topics'>) {
  return JSON.stringify({
    ...state,
    media: {
      ...state.media,
      pendingAsset: state.media.pendingAsset ? {
        type: state.media.pendingAsset.type,
        uri: state.media.pendingAsset.uri,
        fileName: state.media.pendingAsset.fileName,
        mimeType: state.media.pendingAsset.mimeType,
        fileSize: state.media.pendingAsset.fileSize,
        durationSeconds: state.media.pendingAsset.durationSeconds,
      } : null,
    },
  })
}

function showAlert(title: string, message: string) {
  Alert.alert(title, message)
}
