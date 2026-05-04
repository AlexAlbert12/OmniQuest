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

type QuestionTypeId = 'multiple' | 'boolean' | 'dragdrop' | 'match' | 'fill' | 'order' | 'open';

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
};

const questionTypes: QuestionTypeCard[] = [
  { id: 'multiple', title: 'Opción múltiple', detail: 'Una pregunta con varias opciones de respuesta.', icon: 'list', accent: '#8B5CF6', supported: true },
  { id: 'boolean', title: 'Verdadero / Falso', detail: 'Los alumnos eligen entre verdadero o falso.', icon: 'checkmark-done', accent: '#43D991', supported: false },
  { id: 'dragdrop', title: 'Arrastrar y soltar', detail: 'Arrastra elementos a la posición correcta.', icon: 'move', accent: '#A78BFA', supported: false },
  { id: 'match', title: 'Unir con flechas', detail: 'Conecta elementos de ambas columnas.', icon: 'git-compare', accent: '#F6A64A', supported: false },
  { id: 'fill', title: 'Rellenar espacios', detail: 'Completa los espacios en blanco.', icon: 'grid', accent: '#60A5FA', supported: false },
  { id: 'order', title: 'Ordenar elementos', detail: 'Ordena los elementos en el orden correcto.', icon: 'reorder-three', accent: '#EC4899', supported: false },
  { id: 'open', title: 'Respuesta abierta', detail: 'El alumno escribe su propia respuesta.', icon: 'chatbox-ellipses', accent: '#38BDF8', supported: false },
];

export default function TeacherQuestionForm({
  mode,
  subjectId,
  questionId,
  initialTopicId = null,
}: TeacherQuestionFormProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isEdit = mode === 'edit';

  const normalizedSubjectId = Array.isArray(subjectId) ? subjectId[0] : subjectId;
  const normalizedQuestionId = Array.isArray(questionId) ? questionId[0] : questionId;
  const normalizedInitialTopicId = Array.isArray(initialTopicId) ? initialTopicId[0] : initialTopicId;

  const [initializing, setInitializing] = useState(isEdit);
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

  const isDesktop = width >= 1080;
  const isWide = width >= 900;
  const typeColumns = width >= 1320 ? 3 : width >= 720 ? 2 : 1;
  const selectedTypeCard = questionTypes.find((item) => item.id === selectedType) || questionTypes[0];
  const visibleAnswers = answers.slice(0, optionsCount);

  useEffect(() => {
    const loadFormData = async () => {
      if (!normalizedSubjectId) {
        showAlert('Error', 'No se encontró la clase para crear la pregunta.');
        router.back();
        return;
      }

      setInitializing(isEdit);
      try {
        const [topicsResult, questionResult] = await Promise.all([
          supabase
            .from('subject_topics')
            .select('id, title')
            .eq('subject_id', normalizedSubjectId)
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          isEdit && normalizedQuestionId
            ? supabase
                .from('questions')
                .select('id, text, points_base, time_limit_seconds, topic_id, answers(text, is_correct, sort_order)')
                .eq('id', normalizedQuestionId)
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
          setQuestionText(questionData.text || '');
          setTimeLimit(String(questionData.time_limit_seconds || 30));
          setPoints(String(questionData.points_base || 10));
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
          setAnswers(paddedAnswers);
          setOptionsCount(safeCount);
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
    setSelectedType(typeId);
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

    if (!questionText.trim()) {
      showAlert('Error', 'La pregunta no puede estar vacía.');
      return;
    }

    if (visibleAnswers.some((answer) => !answer.text.trim())) {
      showAlert('Error', `Rellena las ${optionsCount} opciones de respuesta.`);
      return;
    }

    const parsedPoints = Number.parseInt(points, 10) || 10;
    const parsedTimeLimit = Number.parseInt(timeLimit, 10) || 30;
    const validTopicId = getValidTopicId(selectedTopicId, topics);

    setSaving(true);
    try {
      let targetQuestionId: number | null = null;

      if (isEdit) {
        const { error: updateQuestionError } = await supabase
          .from('questions')
          .update({
            subject_id: normalizedSubjectId,
            topic_id: validTopicId,
            type: 'multiple_choice',
            text: questionText.trim(),
            points_base: parsedPoints,
            time_limit_seconds: parsedTimeLimit,
          })
          .eq('id', normalizedQuestionId);

        if (updateQuestionError) throw updateQuestionError;
        targetQuestionId = Number(normalizedQuestionId);

        const { error: deleteAnswersError } = await supabase
          .from('answers')
          .delete()
          .eq('question_id', targetQuestionId);
        if (deleteAnswersError) throw deleteAnswersError;
      } else {
        const { data: newQuestion, error: createQuestionError } = await supabase
          .from('questions')
          .insert([
            {
              subject_id: normalizedSubjectId,
              topic_id: validTopicId,
              type: 'multiple_choice',
              text: questionText.trim(),
              points_base: parsedPoints,
              time_limit_seconds: parsedTimeLimit,
            },
          ])
          .select('id')
          .single();

        if (createQuestionError) throw createQuestionError;
        targetQuestionId = newQuestion.id;
      }

      const answersToInsert = visibleAnswers.map((answer, index) => ({
        question_id: targetQuestionId,
        text: answer.text.trim(),
        is_correct: answer.isCorrect,
        sort_order: index + 1,
      }));

      const { error: upsertAnswersError } = await supabase.from('answers').insert(answersToInsert);
      if (upsertAnswersError) throw upsertAnswersError;

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
              <StepBadge number={1} active label="Tipo de pregunta" />
              <StepLine />
              <StepBadge number={2} label="Contenido" />
              <StepLine />
              <StepBadge number={3} label="Opciones" />
              <StepLine />
              <StepBadge number={4} label="Revisión" />
            </View>

            <View className={`mt-6 gap-4 ${isWide ? 'flex-row' : ''}`}>
              <View className={`${isWide ? 'w-[38%]' : ''}`}>
                <View className="rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <Text className="text-[30px] font-black text-white">1. Selecciona el tipo de pregunta</Text>
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

                <View className="mt-3 rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <RowHeader title="2. Configuración" />
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
                      className="min-h-[96px] rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-[16px] text-white"
                      placeholder="¿Cuál es la capital de Francia?"
                      placeholderTextColor="#7F95B7"
                      multiline
                      value={questionText}
                      onChangeText={setQuestionText}
                    />
                  </View>
                </View>

                <View className="mt-3 rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <RowHeader title="3. Puntuación y tiempo" />
                  <View className="mt-4 gap-4">
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <FieldLabel label="Tiempo (segundos)" />
                        <TextInput
                          className="rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-center text-[16px] font-bold text-white"
                          keyboardType="number-pad"
                          value={timeLimit}
                          onChangeText={setTimeLimit}
                        />
                      </View>
                      <View className="flex-1">
                        <FieldLabel label="Puntos base" />
                        <TextInput
                          className="rounded-xl border border-[#2A456A] bg-[#0A2042] px-4 py-3 text-center text-[16px] font-bold text-white"
                          keyboardType="number-pad"
                          value={points}
                          onChangeText={setPoints}
                        />
                      </View>
                    </View>

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
                  </View>
                </View>
              </View>

              <View className={`${isWide ? 'flex-1' : ''}`}>
                <View className="h-full rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="eye" size={18} color="#8B5CF6" />
                    <Text className="text-[20px] font-black text-white">Vista previa</Text>
                  </View>

                  <View className="mt-4 rounded-2xl border border-[#1C3962] bg-[#0A2042] p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="rounded-full border border-[#4C2FA6] bg-[#1A1550] px-3 py-1">
                        <Text className="font-bold text-[#A78BFA]">{selectedTypeCard.title}</Text>
                      </View>
                      <View className="flex-row items-center gap-5">
                        <MetricPill icon="time-outline" value={`${Number.parseInt(timeLimit, 10) || 30}s`} />
                        <MetricPill icon="star-outline" value={`${Number.parseInt(points, 10) || 10} pts`} highlight />
                      </View>
                    </View>

                    <Text className="mt-5 text-[42px] font-black text-white">
                      {questionText.trim() || '¿Cuál es la capital de Francia?'}
                    </Text>

                    <View className="mt-5 gap-3">
                      {visibleAnswers.map((answer, index) => (
                        <PreviewAnswerRow
                          key={index}
                          index={index}
                          text={answer.text}
                          correct={index === correctIndex}
                          onMarkCorrect={() => markAsCorrect(index)}
                          onChangeText={(text) => updateAnswerText(text, index)}
                        />
                      ))}
                    </View>

                    <View className="mt-5 rounded-xl border border-[#2A456A] bg-[#0A2042] p-4">
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
              </View>
            </View>

            <View className={`mt-4 rounded-2xl border border-[#1A3155] bg-[#071B3D] p-4 ${isDesktop ? 'flex-row items-center justify-between' : 'gap-3'}`}>
              <Pressable onPress={() => router.back()} className="rounded-xl border border-[#2A456A] bg-[#091A39] px-6 py-3">
                <Text className="text-[15px] font-bold text-[#DDE7F4]">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] px-10 py-3"
                style={({ pressed }) => ({ opacity: saving ? 0.7 : pressed ? 0.86 : 1 })}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text className="text-[16px] font-black text-white">{saving ? 'Guardando...' : isEdit ? 'Actualizar pregunta' : 'Continuar'}</Text>
                {!saving ? <Ionicons name="arrow-forward" size={16} color="#FFFFFF" /> : null}
              </Pressable>
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
}: {
  number: number;
  label: string;
  active?: boolean;
}) {
  return (
    <View className="flex-row items-center">
      <View className={`h-9 w-9 items-center justify-center rounded-full border ${active ? 'border-[#A78BFA] bg-[#8B5CF6]' : 'border-[#35567D] bg-[#0A2042]'}`}>
        <Text className={`font-black ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{number}</Text>
      </View>
      <Text className={`ml-3 mr-2 text-[22px] font-semibold ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{label}</Text>
    </View>
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
}: {
  index: number;
  text: string;
  correct: boolean;
  onMarkCorrect: () => void;
  onChangeText: (text: string) => void;
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
          onChangeText={onChangeText}
        />

        {correct ? <Ionicons name="checkmark-circle" size={24} color="#43D991" /> : null}
      </View>
    </View>
  );
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
