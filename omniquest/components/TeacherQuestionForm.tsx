import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';

type QuestionTypeId = 'multiple' | 'boolean' | 'dragdrop' | 'match' | 'fill' | 'order' | 'open';
type WizardStep = 1 | 2 | 3 | 4;

type QuestionTypeCard = {
  id: QuestionTypeId;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  supported: boolean;
};

type AnswerItem = {
  text: string;
  isCorrect: boolean;
};

type TeacherQuestionFormProps = {
  mode: 'create' | 'edit';
  subjectId?: string;
  questionId?: string;
  initialTopicId?: string | null;
  initialClassroomId?: string | null;
};

const questionTypes: QuestionTypeCard[] = [
  { id: 'multiple', title: 'Opción múltiple', detail: 'Una pregunta con varias opciones de respuesta.', icon: 'list', accent: '#8B5CF6', supported: true },
  { id: 'boolean', title: 'Verdadero / Falso', detail: 'Los alumnos eligen entre verdadero o falso.', icon: 'checkmark-done', accent: '#43D991', supported: true },
  { id: 'dragdrop', title: 'Asignar destinos', detail: 'Relaciona elementos con destinos mediante selección clara.', icon: 'move', accent: '#A78BFA', supported: true },
  { id: 'match', title: 'Unir parejas', detail: 'Conecta cada origen con su pareja correspondiente.', icon: 'git-compare', accent: '#F6A64A', supported: true },
  { id: 'fill', title: 'Rellenar huecos', detail: 'Completa uno o varios huecos del enunciado.', icon: 'grid', accent: '#60A5FA', supported: true },
  { id: 'order', title: 'Ordenar elementos', detail: 'Ordena los elementos en el orden correcto.', icon: 'reorder-three', accent: '#EC4899', supported: true },
  { id: 'open', title: 'Respuesta abierta', detail: 'El alumno escribe su propia respuesta.', icon: 'chatbox-ellipses', accent: '#38BDF8', supported: true },
];

const wizardSteps: { number: WizardStep; label: string }[] = [
  { number: 1, label: 'Tipo de pregunta' },
  { number: 2, label: 'Contenido' },
  { number: 3, label: 'Opciones' },
  { number: 4, label: 'Revisión' },
];

const TIME_LIMIT_MIN = 5;
const TIME_LIMIT_MAX = 300;
const POINTS_MIN = 1;
const POINTS_MAX = 100;

export default function TeacherQuestionForm({
  mode,
  subjectId,
  questionId,
  initialTopicId = null,
  initialClassroomId = null,
}: TeacherQuestionFormProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isEdit = mode === 'edit';

  const normalizedSubjectId = Array.isArray(subjectId) ? subjectId[0] : subjectId;
  const normalizedQuestionId = Array.isArray(questionId) ? questionId[0] : questionId;
  const normalizedInitialTopicId = Array.isArray(initialTopicId) ? initialTopicId[0] : initialTopicId;
  const normalizedInitialClassroomId = Array.isArray(initialClassroomId) ? initialClassroomId[0] : initialClassroomId;

  const [initializing, setInitializing] = useState(isEdit);
  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [selectedType, setSelectedType] = useState<QuestionTypeId>('multiple');
  const [questionText, setQuestionText] = useState('');
  const [timeLimit, setTimeLimit] = useState('30');
  const [points, setPoints] = useState('10');
  const [optionsCount, setOptionsCount] = useState(4);
  const [explanation, setExplanation] = useState('');
  const [topics, setTopics] = useState<{ id: number; title: string }[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() =>
    isNumericId(normalizedInitialTopicId) ? normalizedInitialTopicId : null
  );
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<AnswerItem[]>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [openExpectedAnswer, setOpenExpectedAnswer] = useState('');
  const [fillAnswersText, setFillAnswersText] = useState('');
  const [orderItemsText, setOrderItemsText] = useState('');
  const [matchPairsText, setMatchPairsText] = useState('');
  const [dragdropPairsText, setDragdropPairsText] = useState('');

  const isDesktop = width >= 1080;
  const typeColumns = width >= 1320 ? 3 : width >= 720 ? 2 : 1;
  const selectedTypeCard = questionTypes.find((item) => item.id === selectedType) || questionTypes[0];
  const isMultipleType = selectedType === 'multiple';
  const isBooleanType = selectedType === 'boolean';
  const isChoiceType = isMultipleType || isBooleanType;
  const visibleAnswers = isBooleanType ? answers.slice(0, 2) : answers.slice(0, optionsCount);
  const parsedTimeLimit = parseIntegerField(timeLimit);
  const parsedPoints = parseIntegerField(points);
  const timeLimitError = getIntegerRangeError('El tiempo', parsedTimeLimit, TIME_LIMIT_MIN, TIME_LIMIT_MAX, 'segundos');
  const pointsError = getIntegerRangeError('Los puntos', parsedPoints, POINTS_MIN, POINTS_MAX, 'puntos');

  useEffect(() => {
    const loadFormData = async () => {
      if (!normalizedSubjectId) {
        showAlert('Error', 'No se encontró la clase para crear la pregunta.');
        router.back();
        return;
      }

      setInitializing(isEdit);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const teacherId = sessionData.session?.user.id;

        if (!teacherId) {
          throw new Error('No se encontró una sesión activa.');
        }

        const subjectResult = await supabase
          .from('subjects')
          .select('id')
          .eq('id', normalizedSubjectId)
          .eq('teacher_id', teacherId)
          .single();

        if (subjectResult.error) throw subjectResult.error;

        const [topicsResult, questionResult] = await Promise.all([
          supabase
            .from('subject_topics')
            .select('id, title')
            .eq('subject_id', normalizedSubjectId)
            .match(isNumericId(normalizedInitialClassroomId) ? { classroom_id: Number(normalizedInitialClassroomId) } : {})
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          isEdit && normalizedQuestionId
            ? supabase
                .from('questions')
                .select('id, text, type, points_base, time_limit_seconds, topic_id, classroom_id, explanation, answers(text, is_correct, sort_order)')
                .eq('id', normalizedQuestionId)
                .eq('subject_id', normalizedSubjectId)
                .single()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (topicsResult.error) throw topicsResult.error;
        if (questionResult.error) throw questionResult.error;

        const fetchedTopics = topicsResult.data || [];
        setTopics(fetchedTopics);

        let nextSelectedTopicId = selectedTopicId;

        if (isEdit && questionResult.data) {
          const questionData: any = questionResult.data;
          const parsedQuestionType = fromDatabaseType(questionData.type);
          setSelectedType(parsedQuestionType);
          setQuestionText(questionData.text || '');
          setTimeLimit(String(questionData.time_limit_seconds || 30));
          setPoints(String(questionData.points_base || 10));
          setExplanation(questionData.explanation || '');
          nextSelectedTopicId = questionData.topic_id ? String(questionData.topic_id) : null;

          const fetchedAnswers = Array.isArray(questionData.answers)
            ? [...questionData.answers].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            : [];
          const parsedAnswers: AnswerItem[] = fetchedAnswers.map((answer: any) => ({
            text: answer.text || '',
            isCorrect: Boolean(answer.is_correct),
          }));
          const safeCount = Math.max(2, Math.min(6, parsedAnswers.length || 4));
          const minArraySize = Math.max(4, safeCount);
          const paddedAnswers = [
            ...parsedAnswers,
            ...Array.from({ length: Math.max(0, minArraySize - parsedAnswers.length) }, (_, index) => ({
              text: '',
              isCorrect: parsedAnswers.length === 0 && index === 0,
            })),
          ];
          if (!paddedAnswers.some((answer) => answer.isCorrect)) {
            paddedAnswers[0].isCorrect = true;
          }

          if (parsedQuestionType === 'boolean') {
            const boolAnswers = ensureBooleanAnswers(parsedAnswers);
            setAnswers(boolAnswers);
            setOptionsCount(2);
          } else {
            setAnswers(paddedAnswers);
            setOptionsCount(safeCount);
          }

          if (parsedQuestionType === 'open') {
            const correctOpen = parsedAnswers.find((answer) => answer.isCorrect)?.text || parsedAnswers[0]?.text || '';
            setOpenExpectedAnswer(correctOpen);
          }

          if (parsedQuestionType === 'fill') {
            const fillValues = parsedAnswers.map((answer) => answer.text).filter(Boolean);
            setFillAnswersText(fillValues.join('\n'));
          }

          if (parsedQuestionType === 'order') {
            const orderValues = fetchedAnswers.map((answer: any) => answer.text || '').filter(Boolean);
            setOrderItemsText(orderValues.join('\n'));
          }

          if (parsedQuestionType === 'match') {
            const pairLines = parsedAnswers
              .map((answer) => decodePairAnswer(answer.text))
              .filter(Boolean)
              .map((pair) => `${pair!.left} | ${pair!.right}`);
            setMatchPairsText(pairLines.join('\n'));
          }

          if (parsedQuestionType === 'dragdrop') {
            const pairLines = parsedAnswers
              .map((answer) => decodePairAnswer(answer.text))
              .filter(Boolean)
              .map((pair) => `${pair!.left} | ${pair!.right}`);
            setDragdropPairsText(pairLines.join('\n'));
          }
        }

        if (nextSelectedTopicId && !fetchedTopics.some((topic) => String(topic.id) === nextSelectedTopicId)) {
          nextSelectedTopicId = fetchedTopics.length > 0 ? String(fetchedTopics[0].id) : null;
        }

        if (!nextSelectedTopicId && fetchedTopics.length > 0) {
          nextSelectedTopicId = String(fetchedTopics[0].id);
        }

        setSelectedTopicId(nextSelectedTopicId);
      } catch (error: any) {
        showAlert('Error', error.message || 'No se pudo cargar la información del formulario.');
        router.back();
      } finally {
        setInitializing(false);
      }
    };

    loadFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSubjectId, normalizedQuestionId, isEdit]);

  const correctIndex = useMemo(() => {
    const index = visibleAnswers.findIndex((answer) => answer.isCorrect);
    return index >= 0 ? index : 0;
  }, [visibleAnswers]);

  const updateAnswerText = (text: string, index: number) => {
    const nextAnswers = [...answers];
    nextAnswers[index].text = text;
    setAnswers(nextAnswers);
  };

  const markAsCorrect = (indexToMark: number) => {
    const nextAnswers = answers.map((answer, index) => ({
      ...answer,
      isCorrect: index === indexToMark,
    }));
    setAnswers(nextAnswers);
  };

  const handleOptionsCountChange = (nextCount: number) => {
    if (!isMultipleType) return;
    const clampedCount = Math.max(2, Math.min(6, nextCount));
    const expandedAnswers =
      answers.length >= clampedCount
        ? answers
        : [...answers, ...Array.from({ length: clampedCount - answers.length }, () => ({ text: '', isCorrect: false }))];
    const hasCorrectInRange = expandedAnswers.slice(0, clampedCount).some((answer) => answer.isCorrect);
    if (hasCorrectInRange) {
      setAnswers(expandedAnswers);
      setOptionsCount(clampedCount);
      return;
    }

    const nextAnswers = expandedAnswers.map((answer, index) => ({
      ...answer,
      isCorrect: index === 0,
    }));
    setAnswers(nextAnswers);
    setOptionsCount(clampedCount);
  };

  const handleTypeSelection = (typeId: QuestionTypeId, supported: boolean) => {
    if (!supported) {
      showAlert('Próximamente', 'Este tipo de pregunta estará disponible en una próxima iteración.');
      return;
    }

    if (typeId === 'boolean') {
      setAnswers(ensureBooleanAnswers(answers));
      setOptionsCount(2);
    } else if (selectedType === 'boolean' && typeId === 'multiple') {
      setAnswers([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ]);
      setOptionsCount(4);
    }

    setSelectedType(typeId);
  };

  const validateContentStep = () => {
    if (!questionText.trim()) {
      showAlert('Error', 'La pregunta no puede estar vacía.');
      return false;
    }

    if (selectedType === 'fill' && countFillBlankMarkers(questionText) === 0) {
      showAlert('Marca el hueco', 'En preguntas de rellenar huecos, escribe ____ en el enunciado donde deba responder el alumno.');
      return false;
    }

    if (timeLimitError) {
      showAlert('Error', timeLimitError);
      return false;
    }

    if (pointsError) {
      showAlert('Error', pointsError);
      return false;
    }

    return true;
  };

  const validateOptionsStep = () => {
    const fillLines = parseLines(fillAnswersText);
    const orderLines = parseLines(orderItemsText);
    const matchPairs = parsePairLines(matchPairsText);
    const dragdropPairs = parsePairLines(dragdropPairsText);

    if (isChoiceType && visibleAnswers.some((answer) => !answer.text.trim())) {
      showAlert('Error', 'Rellena todas las opciones de respuesta.');
      return false;
    }

    if (selectedType === 'open' && !openExpectedAnswer.trim()) {
      showAlert('Error', 'Añade una respuesta esperada para la pregunta abierta.');
      return false;
    }

    if (selectedType === 'fill' && fillLines.length === 0) {
      showAlert('Error', 'Añade al menos una respuesta correcta para rellenar espacios.');
      return false;
    }

    if (selectedType === 'order' && orderLines.length < 2) {
      showAlert('Error', 'Añade al menos dos elementos para ordenar.');
      return false;
    }

    if (selectedType === 'match' && matchPairs.length < 1) {
      showAlert('Error', 'Añade al menos un par para unir con flechas (formato: izquierda | derecha).');
      return false;
    }

    if (selectedType === 'dragdrop' && dragdropPairs.length < 1) {
      showAlert('Error', 'Añade al menos un par para arrastrar y soltar (formato: elemento | destino).');
      return false;
    }

    return true;
  };

  const validateStep = (step: WizardStep) => {
    if (step === 2) return validateContentStep();
    if (step === 3) return validateOptionsStep();
    return true;
  };

  const goToStep = (nextStep: WizardStep) => {
    if (nextStep > activeStep) {
      for (let step = activeStep; step < nextStep; step += 1) {
        if (!validateStep(step as WizardStep)) {
          return;
        }
      }
    }

    setActiveStep(nextStep);
  };

  const handleNextStep = () => {
    if (!validateStep(activeStep)) return;
    setActiveStep((current) => Math.min(4, current + 1) as WizardStep);
  };

  const handlePreviousStep = () => {
    setActiveStep((current) => Math.max(1, current - 1) as WizardStep);
  };

  const handleSave = async () => {
    if (!normalizedSubjectId) {
      showAlert('Error', 'No se encontró la clase para guardar la pregunta.');
      return;
    }

    if (isEdit && !normalizedQuestionId) {
      showAlert('Error', 'No se encontró la pregunta a editar.');
      return;
    }

    if (!validateContentStep()) {
      setActiveStep(2);
      return;
    }

    const fillLines = parseLines(fillAnswersText);
    const orderLines = parseLines(orderItemsText);
    const matchPairs = parsePairLines(matchPairsText);
    const dragdropPairs = parsePairLines(dragdropPairsText);

    if (!validateOptionsStep()) {
      setActiveStep(3);
      return;
    }

    const validPoints = parsedPoints as number;
    const validTimeLimit = parsedTimeLimit as number;
    const validTopicId = getValidTopicId(selectedTopicId, topics);
    const answersToSave = buildAnswersForType({
      selectedType,
      questionId: isEdit && normalizedQuestionId ? Number(normalizedQuestionId) : 0,
      visibleAnswers,
      openExpectedAnswer,
      fillLines,
      orderLines,
      matchPairs,
      dragdropPairs,
    });

    setSaving(true);
    try {
      const { error: saveQuestionError } = await supabase.rpc('save_teacher_question', {
        p_subject_id: Number(normalizedSubjectId),
        p_question_id: isEdit ? Number(normalizedQuestionId) : null,
        p_classroom_id: isNumericId(normalizedInitialClassroomId) ? Number(normalizedInitialClassroomId) : null,
        p_topic_id: validTopicId,
        p_type: toDatabaseType(selectedType),
        p_text: questionText.trim(),
        p_points_base: validPoints,
        p_time_limit_seconds: validTimeLimit,
        p_explanation: explanation.trim() || null,
        p_answers: answersToSave as unknown as Json,
      });

      if (saveQuestionError) throw saveQuestionError;

      showAlert(isEdit ? 'Pregunta actualizada' : 'Pregunta creada', isEdit ? 'Los cambios se guardaron correctamente.' : 'La pregunta se guardó correctamente.');
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo guardar la pregunta.');
    } finally {
      setSaving(false);
    }
  };

  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando pregunta...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#050E24]">
      <View className="absolute inset-0 bg-[#061126]" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pb-6 pt-5 md:px-6 lg:px-8">
          <View className="rounded-[20px] border border-[#1A3155] bg-[#061735] px-4 py-5 md:px-6">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-row items-start gap-3">
                <Pressable onPress={() => router.back()} className="h-12 w-12 items-center justify-center rounded-xl border border-[#2A4369] bg-[#0A1D3F]">
                  <Ionicons name="close" size={22} color="#DDE7F4" />
                </Pressable>
                <View className="min-w-0">
                  <Text className="text-[30px] font-black text-white">{isEdit ? 'Editar Pregunta' : 'Nueva Pregunta'}</Text>
                  <Text className="mt-1 text-[14px] text-[#9FB3D1]">Crea preguntas atractivas para tus alumnos</Text>
                </View>
              </View>
            </View>

            <View className="mt-7 flex-row items-center">
              {wizardSteps.map((step, index) => (
                <React.Fragment key={step.number}>
                  <StepBadge
                    number={step.number}
                    active={activeStep === step.number}
                    completed={activeStep > step.number}
                    label={step.label}
                    onPress={() => goToStep(step.number)}
                  />
                  {index < wizardSteps.length - 1 ? <StepLine /> : null}
                </React.Fragment>
              ))}
            </View>

            <View className="mt-6">
              {activeStep === 1 ? (
                <View className="rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <Text className="text-[30px] font-black text-white">Selecciona el tipo de pregunta</Text>
                  <View className="mt-4 h-px bg-[#1A3155]" />
                  <View className="mt-4 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                    {questionTypes.map((type) => (
                      <QuestionTypeTile
                        key={type.id}
                        type={type}
                        active={selectedType === type.id}
                        width={100 / typeColumns}
                        onPress={() => handleTypeSelection(type.id, type.supported)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {activeStep === 2 ? (
                <View className="rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <RowHeader title="Contenido y ajustes" />
                  <View className="mt-4 gap-4">
                    <FieldLabel label="Tema" />
                    {topics.length > 0 ? (
                      <View className="flex-row flex-wrap gap-2">
                        {topics.map((topic) => {
                          const active = selectedTopicId === String(topic.id);
                          return (
                            <Pressable
                              key={topic.id}
                              onPress={() => setSelectedTopicId(String(topic.id))}
                              className={`rounded-xl border px-3 py-2 ${active ? 'border-[#8B5CF6] bg-[#4C2FA6]' : 'border-[#2A456A] bg-[#0A2042]'}`}
                            >
                              <Text className={`font-semibold ${active ? 'text-white' : 'text-[#B7C4D7]'}`}>{topic.title}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <View className="rounded-xl border border-[#7A4A29] bg-[#3B2518] p-3">
                        <Text className="text-[12px] text-[#F6CFAE]">Esta clase todavía no tiene temas. La pregunta se guardará sin tema.</Text>
                      </View>
                    )}

                    <FieldLabel label="Enunciado" />
                    <TextInput
                      className="min-h-[120px] rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-[16px] text-white"
                      placeholder={selectedType === 'fill' ? 'La capital de Francia es ____.' : '¿Cuál es la capital de Francia?'}
                      placeholderTextColor="#7F95B7"
                      multiline
                      textAlignVertical="top"
                      value={questionText}
                      onChangeText={setQuestionText}
                    />

                    {selectedType === 'fill' ? (
                      <HelperTip
                        icon="text-outline"
                        title="Marca los huecos con ____"
                        detail="Escribe ____ justo donde va cada hueco. El alumno verá el espacio dentro del enunciado y un campo por cada solución."
                      />
                    ) : null}

                    {selectedType === 'match' || selectedType === 'dragdrop' ? (
                      <HelperTip
                        icon={selectedType === 'match' ? 'git-compare' : 'move'}
                        title="Crea relaciones claras"
                        detail="Escribe cada relación como izquierda | derecha. En el juego el alumno tocará un elemento y después su pareja o destino."
                      />
                    ) : null}

                    <View className={isDesktop ? 'flex-row gap-3' : 'gap-3'}>
                      <View className="flex-1">
                        <FieldLabel label={`Tiempo (${TIME_LIMIT_MIN}-${TIME_LIMIT_MAX} segundos)`} />
                        <TextInput
                          className={`mt-2 rounded-xl border bg-[#0A2042] px-4 py-3 text-center text-[16px] font-bold text-white ${
                            timeLimitError ? 'border-[#EF6A6A]' : 'border-[#2A456A]'
                          }`}
                          keyboardType="number-pad"
                          value={timeLimit}
                          onChangeText={(text) => setTimeLimit(sanitizeIntegerInput(text))}
                        />
                        {timeLimitError ? <Text className="mt-2 text-[12px] font-semibold text-[#FF9B9B]">{timeLimitError}</Text> : null}
                      </View>
                      <View className="flex-1">
                        <FieldLabel label={`Puntos base (${POINTS_MIN}-${POINTS_MAX})`} />
                        <TextInput
                          className={`mt-2 rounded-xl border bg-[#0A2042] px-4 py-3 text-center text-[16px] font-bold text-white ${
                            pointsError ? 'border-[#EF6A6A]' : 'border-[#2A456A]'
                          }`}
                          keyboardType="number-pad"
                          value={points}
                          onChangeText={(text) => setPoints(sanitizeIntegerInput(text))}
                        />
                        {pointsError ? <Text className="mt-2 text-[12px] font-semibold text-[#FF9B9B]">{pointsError}</Text> : null}
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}

              {activeStep === 3 ? (
                <View className="rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <RowHeader title="Opciones y solución" />
                  <View className="mt-4 gap-4">
                    {isMultipleType ? (
                      <View>
                        <FieldLabel label="Número de opciones" />
                        <View className="mt-2 flex-row flex-wrap gap-2">
                          {[2, 3, 4, 5, 6].map((count) => {
                            const active = optionsCount === count;
                            return (
                              <Pressable
                                key={count}
                                onPress={() => handleOptionsCountChange(count)}
                                className={`rounded-lg border px-4 py-2 ${active ? 'border-[#8B5CF6] bg-[#4C2FA6]' : 'border-[#2A456A] bg-[#0A2042]'}`}
                              >
                                <Text className={`font-bold ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{count}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {isChoiceType ? (
                      <View className="gap-3">
                        <View className="flex-row items-center gap-2 rounded-xl border border-[#2A456A] bg-[#081A37] px-3 py-2">
                          <Ionicons name="information-circle-outline" size={17} color="#A78BFA" />
                          <Text className="min-w-0 flex-1 text-[12px] font-semibold text-[#AFC2DB]">
                            Toca la letra o el check para marcar la respuesta correcta.
                          </Text>
                        </View>
                        {visibleAnswers.map((answer, index) => (
                          <PreviewAnswerRow
                            key={index}
                            index={index}
                            text={answer.text}
                            correct={index === correctIndex}
                            onMarkCorrect={() => markAsCorrect(index)}
                            onChangeText={(text) => updateAnswerText(text, index)}
                            editable={isMultipleType}
                          />
                        ))}
                      </View>
                    ) : null}

                    {selectedType === 'open' ? (
                      <View>
                        <FieldLabel label="Respuesta esperada" />
                        <TextInput
                          className="mt-2 rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-[15px] text-white"
                          placeholder="Escribe una posible respuesta correcta"
                          placeholderTextColor="#7F95B7"
                          value={openExpectedAnswer}
                          onChangeText={setOpenExpectedAnswer}
                        />
                      </View>
                    ) : null}

                    {selectedType === 'fill' ? (
                      <View>
                        <FieldLabel label="Soluciones de cada hueco (una por línea y en orden)" />
                        <TextInput
                          className="mt-2 min-h-[120px] rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-[15px] text-white"
                          placeholder={'París\nMadrid\nRoma'}
                          placeholderTextColor="#7F95B7"
                          multiline
                          textAlignVertical="top"
                          value={fillAnswersText}
                          onChangeText={setFillAnswersText}
                        />
                      </View>
                    ) : null}

                    {selectedType === 'order' ? (
                      <View>
                        <FieldLabel label="Elementos a ordenar (uno por línea, orden correcto)" />
                        <TextInput
                          className="mt-2 min-h-[120px] rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-[15px] text-white"
                          placeholder={'Paso 1\nPaso 2\nPaso 3'}
                          placeholderTextColor="#7F95B7"
                          multiline
                          textAlignVertical="top"
                          value={orderItemsText}
                          onChangeText={setOrderItemsText}
                        />
                      </View>
                    ) : null}

                    {selectedType === 'match' ? (
                      <View>
                        <FieldLabel label="Relaciones para unir (origen | pareja)" />
                        <TextInput
                          className="mt-2 min-h-[120px] rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-[15px] text-white"
                          placeholder={'Francia | París\nItalia | Roma'}
                          placeholderTextColor="#7F95B7"
                          multiline
                          textAlignVertical="top"
                          value={matchPairsText}
                          onChangeText={setMatchPairsText}
                        />
                      </View>
                    ) : null}

                    {selectedType === 'dragdrop' ? (
                      <View>
                        <FieldLabel label="Relaciones para asignar (elemento | destino)" />
                        <TextInput
                          className="mt-2 min-h-[120px] rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-[15px] text-white"
                          placeholder={'8 - 3 | 5\n2 + 2 | 4\n3 x 2 | 6'}
                          placeholderTextColor="#7F95B7"
                          multiline
                          textAlignVertical="top"
                          value={dragdropPairsText}
                          onChangeText={setDragdropPairsText}
                        />
                      </View>
                    ) : null}

                    <View className="rounded-xl border border-[#2A456A] bg-[#0A2042] p-4">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="font-bold text-[#A78BFA]">Explicación (opcional)</Text>
                        <Ionicons name="create-outline" size={16} color="#A78BFA" />
                      </View>
                      <TextInput
                        className="mt-2 min-h-[80px] rounded-lg border border-[#2A456A] bg-[#081A37] px-3 py-2 text-[15px] leading-6 text-[#DDE7F4]"
                        placeholder="París es la capital y ciudad más poblada de Francia."
                        placeholderTextColor="#8FA7C7"
                        multiline
                        textAlignVertical="top"
                        value={explanation}
                        onChangeText={setExplanation}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {activeStep === 4 ? (
                <View className="rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="eye" size={18} color="#8B5CF6" />
                    <Text className="text-[20px] font-black text-white">Revisión</Text>
                  </View>

                  <View className="mt-4 rounded-2xl border border-[#1C3962] bg-[#0A2042] p-4">
                    <View className="flex-row flex-wrap items-center justify-between gap-3">
                      <View className="rounded-full border border-[#4C2FA6] bg-[#1A1550] px-3 py-1">
                        <Text className="font-bold text-[#A78BFA]">{selectedTypeCard.title}</Text>
                      </View>
                      <View className="flex-row items-center gap-5">
                        <MetricPill icon="time-outline" value={`${parsedTimeLimit ?? TIME_LIMIT_MIN}s`} />
                        <MetricPill icon="star-outline" value={`${parsedPoints ?? POINTS_MIN} pts`} highlight />
                      </View>
                    </View>

                    <Text className="mt-5 text-[34px] font-black text-white md:text-[42px]">
                      {questionText.trim() || '¿Cuál es la capital de Francia?'}
                    </Text>

                    {isChoiceType ? (
                      <View className="mt-5 gap-3">
                        {visibleAnswers.map((answer, index) => (
                          <PreviewAnswerRow
                            key={index}
                            index={index}
                            text={answer.text}
                            correct={index === correctIndex}
                            onMarkCorrect={() => markAsCorrect(index)}
                            onChangeText={(text) => updateAnswerText(text, index)}
                            editable={isMultipleType}
                          />
                        ))}
                      </View>
                    ) : (
                      <TypePreview
                        selectedType={selectedType}
                        openExpectedAnswer={openExpectedAnswer}
                        fillAnswersText={fillAnswersText}
                        orderItemsText={orderItemsText}
                        matchPairsText={matchPairsText}
                        dragdropPairsText={dragdropPairsText}
                      />
                    )}

                    <View className="mt-5 rounded-xl border border-[#2A456A] bg-[#081A37] p-4">
                      <Text className="font-bold text-[#A78BFA]">Explicación</Text>
                      <Text className="mt-2 text-[15px] leading-6 text-[#DDE7F4]">
                        {explanation.trim() || 'Sin explicación adicional.'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>

            <View className={`mt-4 rounded-2xl border border-[#1A3155] bg-[#071B3D] p-4 ${isDesktop ? 'flex-row items-center justify-between' : 'gap-3'}`}>
              <Pressable onPress={() => router.back()} className="rounded-xl border border-[#2A456A] bg-[#091A39] px-6 py-3">
                <Text className="text-[15px] font-bold text-[#DDE7F4]">Cancelar</Text>
              </Pressable>
              <View className={isDesktop ? 'flex-row items-center gap-3' : 'gap-3'}>
                {activeStep > 1 ? (
                  <Pressable onPress={handlePreviousStep} className="flex-row items-center justify-center gap-2 rounded-xl border border-[#2A456A] bg-[#0A2042] px-6 py-3">
                    <Ionicons name="arrow-back" size={16} color="#DDE7F4" />
                    <Text className="text-[15px] font-bold text-[#DDE7F4]">Atrás</Text>
                  </Pressable>
                ) : null}

                {activeStep < 4 ? (
                  <Pressable
                    onPress={handleNextStep}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] px-10 py-3"
                    style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
                  >
                    <Text className="text-[16px] font-black text-white">Siguiente</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] px-10 py-3"
                    style={({ pressed }) => ({ opacity: saving ? 0.7 : pressed ? 0.86 : 1 })}
                  >
                    {saving ? <ActivityIndicator color="#FFFFFF" /> : null}
                    <Text className="text-[16px] font-black text-white">{saving ? 'Guardando...' : isEdit ? 'Actualizar pregunta' : 'Crear pregunta'}</Text>
                    {!saving ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StepBadge({
  number,
  label,
  active = false,
  completed = false,
  onPress,
}: {
  number: WizardStep;
  label: string;
  active?: boolean;
  completed?: boolean;
  onPress?: () => void;
}) {
  const highlighted = active || completed;

  return (
    <Pressable onPress={onPress} className="flex-row items-center" style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}>
      <View
        className={`h-9 w-9 items-center justify-center rounded-full border ${
          active ? 'border-[#A78BFA] bg-[#8B5CF6]' : completed ? 'border-[#43D991] bg-[#145B45]' : 'border-[#35567D] bg-[#0A2042]'
        }`}
      >
        {completed ? (
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        ) : (
          <Text className={`font-black ${highlighted ? 'text-white' : 'text-[#AFC2DB]'}`}>{number}</Text>
        )}
      </View>
      <Text className={`ml-3 mr-2 text-[22px] font-semibold ${highlighted ? 'text-white' : 'text-[#AFC2DB]'}`}>{label}</Text>
    </Pressable>
  );
}

function StepLine() {
  return <View className="mx-3 hidden h-px flex-1 bg-[#2A456A] md:flex" />;
}

function QuestionTypeTile({
  type,
  active,
  width,
  onPress,
}: {
  type: QuestionTypeCard;
  active: boolean;
  width: number;
  onPress: () => void;
}) {
  return (
    <View style={{ width: `${width}%` as `${number}%`, paddingHorizontal: 6, paddingBottom: 12 }}>
      <Pressable
        onPress={onPress}
        className={`min-h-[168px] rounded-xl border p-4 ${active ? 'border-[#8B5CF6] bg-[#121E54]' : 'border-[#264267] bg-[#0A2042]'}`}
      >
        {active ? (
          <View className="absolute right-3 top-3 h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6]">
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
        ) : null}
        <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${type.accent}30` }}>
          <Ionicons name={type.icon} size={23} color={type.accent} />
        </View>
        <Text className="mt-3 text-[21px] font-black text-white">{type.title}</Text>
        <Text className="mt-2 text-[14px] leading-6 text-[#AFC2DB]">{type.detail}</Text>
      </Pressable>
    </View>
  );
}

function RowHeader({ title }: { title: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[27px] font-black text-white">{title}</Text>
      <Ionicons name="chevron-down" size={18} color="#AFC2DB" />
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text className="text-[13px] font-semibold text-[#AFC2DB]">{label}</Text>;
}

function HelperTip({
  icon,
  title,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}) {
  return (
    <View className="flex-row items-start gap-3 rounded-xl border border-[#2A456A] bg-[#081A37] p-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#18275A]">
        <Ionicons name={icon} size={18} color="#A78BFA" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-black text-white">{title}</Text>
        <Text className="mt-1 text-[12px] leading-5 text-[#AFC2DB]">{detail}</Text>
      </View>
    </View>
  );
}

function MetricPill({
  icon,
  value,
  highlight = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={18} color={highlight ? '#F6C453' : '#DDE7F4'} />
      <Text className={`text-[15px] font-black ${highlight ? 'text-[#A78BFA]' : 'text-[#DDE7F4]'}`}>{value}</Text>
    </View>
  );
}

function PreviewAnswerRow({
  index,
  text,
  correct,
  onMarkCorrect,
  onChangeText,
  editable = true,
}: {
  index: number;
  text: string;
  correct: boolean;
  onMarkCorrect: () => void;
  onChangeText: (text: string) => void;
  editable?: boolean;
}) {
  const letter = String.fromCharCode(65 + index);

  return (
    <View className={`rounded-xl border px-4 py-3 ${correct ? 'border-[#43D991] bg-[#0F3B39]' : 'border-[#28456B] bg-[#0A2042]'}`}>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onMarkCorrect}
          className={`h-10 w-10 items-center justify-center rounded-full border ${correct ? 'border-[#43D991] bg-[#43D991]' : 'border-[#8B5CF6]'}`}
        >
          <Text className={`font-black ${correct ? 'text-[#052A22]' : 'text-[#A78BFA]'}`}>{letter}</Text>
        </Pressable>

        <TextInput
          className={`min-h-[38px] flex-1 text-[16px] font-semibold ${correct ? 'text-white' : 'text-[#DDE7F4]'}`}
          placeholder={`Opción ${letter}`}
          placeholderTextColor="#7F95B7"
          value={text}
          editable={editable}
          onChangeText={onChangeText}
        />

        <Pressable
          onPress={onMarkCorrect}
          accessibilityRole="button"
          accessibilityLabel={`Marcar opción ${letter} como respuesta correcta`}
          className={`h-10 w-10 items-center justify-center rounded-full border ${
            correct ? 'border-[#43D991] bg-[#43D991]' : 'border-[#35567D] bg-[#081A37]'
          }`}
        >
          <Ionicons name="checkmark" size={20} color={correct ? '#052A22' : '#8FA7C7'} />
        </Pressable>
      </View>
    </View>
  );
}

function TypePreview({
  selectedType,
  openExpectedAnswer,
  fillAnswersText,
  orderItemsText,
  matchPairsText,
  dragdropPairsText,
}: {
  selectedType: QuestionTypeId;
  openExpectedAnswer: string;
  fillAnswersText: string;
  orderItemsText: string;
  matchPairsText: string;
  dragdropPairsText: string;
}) {
  const textMap: Record<QuestionTypeId, string> = {
    multiple: '',
    boolean: '',
    open: openExpectedAnswer,
    fill: fillAnswersText,
    order: orderItemsText,
    match: matchPairsText,
    dragdrop: dragdropPairsText,
  };

  const lines = parseLines(textMap[selectedType] || '');
  const title = getTypePreviewTitle(selectedType);

  return (
    <View className="mt-5 rounded-xl border border-[#2A456A] bg-[#0A2042] p-4">
      <Text className="font-bold text-[#A78BFA]">{title}</Text>
      {lines.length > 0 ? (
        <View className="mt-2 gap-2">
          {lines.slice(0, 6).map((line, index) => (
            <Text key={`${line}-${index}`} className="text-[14px] text-[#DDE7F4]">
              {index + 1}. {line}
            </Text>
          ))}
        </View>
      ) : (
        <Text className="mt-2 text-[13px] text-[#8FA7C7]">Completa la configuración para ver la vista previa de este tipo.</Text>
      )}
    </View>
  );
}

function toDatabaseType(typeId: QuestionTypeId) {
  const map: Record<QuestionTypeId, string> = {
    multiple: 'multiple_choice',
    boolean: 'true_false',
    dragdrop: 'drag_drop',
    match: 'match_pairs',
    fill: 'fill_blank',
    order: 'ordering',
    open: 'open_answer',
  };
  return map[typeId];
}

function fromDatabaseType(typeValue: string | null | undefined): QuestionTypeId {
  const normalized = (typeValue || '').toLowerCase();
  if (normalized === 'multiple_choice') return 'multiple';
  if (normalized === 'true_false') return 'boolean';
  if (normalized === 'drag_drop') return 'dragdrop';
  if (normalized === 'match_pairs') return 'match';
  if (normalized === 'fill_blank') return 'fill';
  if (normalized === 'ordering') return 'order';
  if (normalized === 'open_answer') return 'open';
  return 'multiple';
}

function parseLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function countFillBlankMarkers(text: string) {
  return (text.match(/_{2,}|\[\[blank\]\]|\{\{blank\}\}/gi) || []).length;
}

function parsePairLines(value: string) {
  return parseLines(value)
    .map((line) => {
      const [left, ...rest] = line.split('|');
      const right = rest.join('|').trim();
      return {
        left: left?.trim() || '',
        right,
      };
    })
    .filter((pair) => pair.left.length > 0 && pair.right.length > 0);
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 3);
}

function parseIntegerField(value: string) {
  const trimmedValue = value.trim();
  if (!/^\d+$/.test(trimmedValue)) return null;
  return Number(trimmedValue);
}

function getIntegerRangeError(label: string, value: number | null, min: number, max: number, unit: string) {
  if (value === null) return `${label} debe ser un número.`;
  if (value < min) return `${label} mínimo es ${min} ${unit}.`;
  if (value > max) return `${label} máximo es ${max} ${unit}.`;
  return '';
}

function encodePairAnswer(left: string, right: string) {
  return `${left}|||${right}`;
}

function decodePairAnswer(text: string) {
  const [left, ...rest] = (text || '').split('|||');
  const right = rest.join('|||');
  if (!left?.trim() || !right?.trim()) return null;
  return {
    left: left.trim(),
    right: right.trim(),
  };
}

function buildAnswersForType({
  selectedType,
  questionId,
  visibleAnswers,
  openExpectedAnswer,
  fillLines,
  orderLines,
  matchPairs,
  dragdropPairs,
}: {
  selectedType: QuestionTypeId;
  questionId: number | null;
  visibleAnswers: AnswerItem[];
  openExpectedAnswer: string;
  fillLines: string[];
  orderLines: string[];
  matchPairs: { left: string; right: string }[];
  dragdropPairs: { left: string; right: string }[];
}) {
  if (selectedType === 'multiple' || selectedType === 'boolean') {
    return visibleAnswers.map((answer, index) => ({
      question_id: questionId,
      text: answer.text.trim(),
      is_correct: answer.isCorrect,
      sort_order: index + 1,
    }));
  }

  if (selectedType === 'open') {
    return [
      {
        question_id: questionId,
        text: openExpectedAnswer.trim(),
        is_correct: true,
        sort_order: 1,
      },
    ];
  }

  if (selectedType === 'fill') {
    return fillLines.map((line, index) => ({
      question_id: questionId,
      text: line,
      is_correct: true,
      sort_order: index + 1,
    }));
  }

  if (selectedType === 'order') {
    return orderLines.map((line, index) => ({
      question_id: questionId,
      text: line,
      is_correct: true,
      sort_order: index + 1,
    }));
  }

  if (selectedType === 'match') {
    return matchPairs.map((pair, index) => ({
      question_id: questionId,
      text: encodePairAnswer(pair.left, pair.right),
      is_correct: true,
      sort_order: index + 1,
    }));
  }

  return dragdropPairs.map((pair, index) => ({
    question_id: questionId,
    text: encodePairAnswer(pair.left, pair.right),
    is_correct: true,
    sort_order: index + 1,
  }));
}

function ensureBooleanAnswers(currentAnswers: AnswerItem[]) {
  const hasTrueCorrect = currentAnswers.find((answer) => answer.text.trim().toLowerCase() === 'verdadero' && answer.isCorrect);
  const hasFalseCorrect = currentAnswers.find((answer) => answer.text.trim().toLowerCase() === 'falso' && answer.isCorrect);
  const trueIsCorrect = Boolean(hasTrueCorrect) || (!hasTrueCorrect && !hasFalseCorrect);
  return [
    { text: 'Verdadero', isCorrect: trueIsCorrect },
    { text: 'Falso', isCorrect: !trueIsCorrect },
  ];
}

function getTypePreviewTitle(type: QuestionTypeId) {
  if (type === 'open') return 'Respuesta esperada';
  if (type === 'fill') return 'Respuestas válidas';
  if (type === 'order') return 'Orden correcto';
  if (type === 'match') return 'Pares a unir';
  if (type === 'dragdrop') return 'Relaciones arrastrar/destino';
  return 'Vista previa';
}

function isNumericId(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^\d+$/.test(value);
}

function getValidTopicId(selectedTopicId: string | null, topics: { id: number; title: string }[]) {
  if (!isNumericId(selectedTopicId)) return null;
  const topicId = Number(selectedTopicId);
  const existsInCurrentSubject = topics.some((topic) => topic.id === topicId);
  return existsInCurrentSubject ? topicId : null;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
