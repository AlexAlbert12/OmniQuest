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

type TeacherTopicFormProps = {
  topicId?: string;
};

const iconChoices = ['📘', '🧠', '🧮', '🔬', '🌍', '✍️', '🎯', '⚡'] as const;

type TopicRow = {
  id: number
  title: string
  description: string | null
  icon: string | null
  sort_order: number | null
  available_until: string | null
  subject_id: number
  subjects?: {
    id: number
    name: string
    theme_color: string | null
  } | null
}

type SubjectOwnerRow = {
  id: number
  name: string
  theme_color: string | null
}

export default function TeacherTopicForm({ topicId }: TeacherTopicFormProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const normalizedTopicId = Array.isArray(topicId) ? topicId[0] : topicId;
  const [topic, setTopic] = useState<TopicRow | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<(typeof iconChoices)[number]>('📘');
  const [sortOrder, setSortOrder] = useState('1');
  const [availableUntilInput, setAvailableUntilInput] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);

  const isWide = width >= 980;
  const titleCounter = `${title.trim().length}/60`;
  const descriptionCounter = `${description.trim().length}/160`;
  const previewTitle = useMemo(() => title.trim() || 'Nombre del tema', [title]);
  const previewDescription = useMemo(() => description.trim() || 'Descripción breve del contenido del tema.', [description]);
  const canSave = !saving && title.trim().length > 0;

  useEffect(() => {
    if (!normalizedTopicId) {
      showAlert('Error', 'No se encontró el tema a editar.');
      router.back();
      return;
    }

    const fetchTopic = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const teacherId = sessionData.session?.user.id;

        if (!teacherId) {
          throw new Error('No se encontró una sesión activa.');
        }

        const { data: topicOwnerData, error: topicOwnerError } = await supabase
          .from('subject_topics')
          .select('id, subject_id')
          .eq('id', normalizedTopicId)
          .single();

        if (topicOwnerError) throw topicOwnerError;

        const { data: subjectData, error: subjectError } = await supabase
          .from('subjects')
          .select('id, name, theme_color')
          .eq('id', topicOwnerData.subject_id)
          .eq('teacher_id', teacherId)
          .single();

        if (subjectError) throw subjectError;

        const { data, error } = await supabase
          .from('subject_topics')
          .select('id, title, description, icon, sort_order, available_until, subject_id')
          .eq('id', normalizedTopicId)
          .eq('subject_id', topicOwnerData.subject_id)
          .single();

        if (error) throw error;

        const rawTopic = data as unknown as TopicRow;
        const nextTopic: TopicRow = {
          ...rawTopic,
          subjects: subjectData as SubjectOwnerRow,
        };
        const topicIcon = nextTopic.icon && iconChoices.includes(nextTopic.icon as (typeof iconChoices)[number])
          ? (nextTopic.icon as (typeof iconChoices)[number])
          : '📘';

        setTopic(nextTopic);
        setTitle(nextTopic.title || '');
        setDescription(nextTopic.description || '');
        setIcon(topicIcon);
        setSortOrder(String(nextTopic.sort_order || 1));
        setAvailableUntilInput(formatDateTimeInput(nextTopic.available_until));
      } catch (error: any) {
        showAlert('Error', error.message || 'No se pudo cargar el tema.');
        router.back();
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchTopic();
  }, [normalizedTopicId, router]);

  const handleSave = async () => {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanAvailableUntil = availableUntilInput.trim();
    const parsedSortOrder = Number.parseInt(sortOrder, 10);
    const parsedAvailableUntil = cleanAvailableUntil ? parseDateTimeInput(cleanAvailableUntil) : null;

    if (!normalizedTopicId) {
      showAlert('Error', 'No se encontró el tema a editar.');
      return;
    }

    if (!topic) {
      showAlert('Error', 'No se pudo validar la pertenencia del tema.');
      return;
    }

    if (!cleanTitle) {
      showAlert('Error', 'El título del tema es obligatorio.');
      return;
    }

    if (cleanTitle.length > 60) {
      showAlert('Error', 'El título no puede superar 60 caracteres.');
      return;
    }

    if (cleanDescription.length > 160) {
      showAlert('Error', 'La descripción no puede superar 160 caracteres.');
      return;
    }

    if (Number.isNaN(parsedSortOrder) || parsedSortOrder < 1) {
      showAlert('Error', 'El orden debe ser un número mayor que 0.');
      return;
    }

    if (cleanAvailableUntil && !parsedAvailableUntil) {
      showAlert('Fecha inválida', 'Usa el formato AAAA-MM-DD HH:mm, por ejemplo 2026-07-01 18:30.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('subject_topics')
        .update({
          title: cleanTitle,
          description: cleanDescription || null,
          icon,
          sort_order: parsedSortOrder,
          available_until: parsedAvailableUntil ? parsedAvailableUntil.toISOString() : null,
        })
        .eq('id', normalizedTopicId)
        .eq('subject_id', topic.subject_id);

      if (error) throw error;

      showAlert('Tema actualizado', 'Los cambios se guardaron correctamente.');
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo guardar el tema.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando tema...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#040E25]">
      <View className="absolute inset-0 bg-[#061126]" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pb-5 pt-4 md:px-6 lg:px-8">
          <View className="rounded-[18px] border border-[#0E4A8B] bg-[#061735] p-4 md:p-6">
            <View className="flex-row items-start gap-3">
              <Pressable
                onPress={() => router.back()}
                className="h-12 w-12 items-center justify-center rounded-full border border-[#28456B] bg-[#0A2042]"
              >
                <Ionicons name="arrow-back" size={22} color="#DDE7F4" />
              </Pressable>
              <View className="min-w-0 flex-1">
                <Text className="text-[36px] font-black text-white">Editar Tema</Text>
                <Text className="mt-1 text-[14px] text-[#AFC2DB]">
                  Ajusta la información del tema y cómo aparece dentro de la clase.
                </Text>
              </View>
            </View>

            <View className={`mt-5 gap-4 ${isWide ? 'flex-row' : ''}`}>
              <View className={`${isWide ? 'flex-[1.65]' : ''}`}>
                <SectionCard step={1} title="Información del tema" description="Completa los datos principales que verán tus alumnos.">
                  <View className={`gap-4 ${width >= 760 ? 'flex-row' : ''}`}>
                    <View className={`${width >= 760 ? 'w-[34%]' : ''}`}>
                      <Label text="Icono" />
                      <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                        {iconChoices.map((emoji) => {
                          const active = icon === emoji;
                          return (
                            <View key={emoji} style={{ width: '25%', paddingHorizontal: 6, paddingBottom: 10 }}>
                              <Pressable
                                onPress={() => setIcon(emoji)}
                                className={`h-20 items-center justify-center rounded-xl border ${active ? 'border-[#8B5CF6] bg-[#271F67]' : 'border-[#28456B] bg-[#0A2042]'}`}
                              >
                                <Text className="text-[32px]">{emoji}</Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View className={`${width >= 760 ? 'flex-1' : ''}`}>
                      <Label text="Título del tema" />
                      <TextInput
                        className="mt-3 rounded-xl border border-[#28456B] bg-[#0A2042] px-4 py-3 text-[16px] text-white"
                        placeholder="Ej. Ecuaciones de primer grado"
                        placeholderTextColor="#7F95B7"
                        value={title}
                        onChangeText={setTitle}
                        maxLength={60}
                      />
                      <Text className="mt-2 text-right text-[12px] text-[#8FA7C7]">{titleCounter}</Text>

                      <Label text="Descripción (opcional)" className="mt-3" />
                      <TextInput
                        className="mt-3 min-h-[92px] rounded-xl border border-[#28456B] bg-[#0A2042] px-4 py-3 text-[15px] text-white"
                        placeholder="Resume qué aprenderán los alumnos en este tema..."
                        placeholderTextColor="#7F95B7"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        textAlignVertical="top"
                        maxLength={160}
                      />
                      <Text className="mt-2 text-right text-[12px] text-[#8FA7C7]">{descriptionCounter}</Text>
                    </View>
                  </View>
                </SectionCard>

                <SectionCard
                  step={2}
                  title="Organización"
                  description="Define la posición del tema dentro de la clase."
                  className="mt-4"
                >
                  <View className={`gap-3 ${width >= 760 ? 'flex-row' : ''}`}>
                    <View className="min-w-[220px] flex-1 rounded-xl border border-[#28456B] bg-[#0A2042] p-3">
                      <View className="flex-row items-center gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-lg bg-[#5A46D82A]">
                          <Ionicons name="reorder-three-outline" size={21} color="#A78BFA" />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-semibold text-[#AFC2DB]">Orden</Text>
                          <TextInput
                            className="mt-2 rounded-lg border border-[#35567D] bg-[#0B2348] px-3 py-2 text-[16px] font-bold text-white"
                            keyboardType="number-pad"
                            value={sortOrder}
                            onChangeText={(value) => setSortOrder(value.replace(/[^0-9]/g, '').slice(0, 3))}
                          />
                        </View>
                      </View>
                    </View>

                    <View className="min-w-[220px] flex-1 rounded-xl border border-[#28456B] bg-[#0A2042] p-3">
                      <View className="flex-row items-center gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-lg bg-[#34D39926]">
                          <Ionicons name="school-outline" size={20} color="#34D399" />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-semibold text-[#AFC2DB]">Clase vinculada</Text>
                          <Text className="mt-2 font-bold text-white">{topic?.subjects?.name || 'Clase'}</Text>
                        </View>
                      </View>
                    </View>

                    <View className="min-w-[260px] flex-1 rounded-xl border border-[#28456B] bg-[#0A2042] p-3">
                      <View className="flex-row items-start gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-lg bg-[#F6A64A26]">
                          <Ionicons name="time-outline" size={20} color="#F6A64A" />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[13px] font-semibold text-[#AFC2DB]">Fecha límite opcional</Text>
                          <TextInput
                            className="mt-2 rounded-lg border border-[#35567D] bg-[#0B2348] px-3 py-2 text-[15px] font-bold text-white"
                            placeholder="2026-07-01 18:30"
                            placeholderTextColor="#7F95B7"
                            value={availableUntilInput}
                            onChangeText={setAvailableUntilInput}
                          />
                          <Text className="mt-2 text-[11px] leading-4 text-[#8FA7C7]">
                            Vacío = siempre abierto. Al pasar la fecha, el tema se bloquea para jugar.
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </SectionCard>
              </View>

              <View className={`${isWide ? 'w-[30%]' : ''}`}>
                <View className="rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <Text className="text-[20px] font-black text-white">Vista previa</Text>
                  <Text className="mt-1 text-[14px] text-[#AFC2DB]">Así aparecerá dentro de la clase.</Text>
                  <View className="mt-4 rounded-2xl border border-[#5A46D8] bg-[#4F46B8] p-5">
                    <View className="mx-auto h-20 w-20 items-center justify-center rounded-full bg-[#3A3398]">
                      <Text className="text-[36px]">{icon}</Text>
                    </View>
                    <Text className="mt-4 text-center text-[28px] font-black text-white">{previewTitle}</Text>
                    <Text className="mt-2 text-center text-[15px] text-[#D9D8FF]">{previewDescription}</Text>
                    <Text className="mt-5 text-center text-[13px] font-bold text-[#D9D8FF]">
                      Orden {Number.parseInt(sortOrder, 10) || 1}
                    </Text>
                    <Text className="mt-2 text-center text-[12px] font-semibold text-[#FDE68A]">
                      {availableUntilInput.trim() ? `Disponible hasta ${availableUntilInput.trim()}` : 'Sin fecha límite'}
                    </Text>
                  </View>
                </View>

                <View className="mt-4 rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <FeatureRow icon="albums-outline" tint="#8B5CF6" title="Tema organizado" detail="Las preguntas asociadas mantienen su relación con este tema." />
                  <FeatureRow icon="analytics-outline" tint="#F6A64A" title="Métricas intactas" detail="Editar el tema no borra progreso ni puntuaciones." className="mt-4" />
                  <FeatureRow icon="eye-outline" tint="#38BDF8" title="Visible al alumno" detail="El título, descripción e icono se actualizan al volver a entrar." className="mt-4" />
                </View>
              </View>
            </View>

            <View className={`mt-4 rounded-2xl border border-[#1A3155] bg-[#071B3D] p-4 ${isWide ? 'flex-row items-center justify-between' : 'gap-3'}`}>
              <Pressable onPress={() => router.back()} className="flex-row items-center gap-2 rounded-xl border border-[#2A456A] bg-[#091A39] px-6 py-3">
                <Ionicons name="close" size={16} color="#DDE7F4" />
                <Text className="text-[15px] font-bold text-[#DDE7F4]">Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                className={`${isWide ? 'min-w-[320px]' : ''} flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] px-10 py-3`}
                style={({ pressed }) => ({ opacity: !canSave ? 0.7 : pressed ? 0.86 : 1 })}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />}
                <Text className="text-[15px] font-black text-white">{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionCard({
  step,
  title,
  description,
  className = '',
  children,
}: {
  step: number;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View className={`rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4 ${className}`}>
      <View className="flex-row items-start gap-3">
        <View className="mt-1 h-8 w-8 items-center justify-center rounded-full bg-[#5A46D8]">
          <Text className="font-black text-white">{step}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[22px] font-black text-white">{title}</Text>
          <Text className="mt-1 text-[14px] text-[#AFC2DB]">{description}</Text>
        </View>
      </View>
      <View className="mt-4">{children}</View>
    </View>
  );
}

function Label({ text, className = '' }: { text: string; className?: string }) {
  return <Text className={`text-[15px] font-semibold text-white ${className}`}>{text}</Text>;
}

function parseDateTimeInput(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function FeatureRow({
  icon,
  tint,
  title,
  detail,
  className = '',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  detail: string;
  className?: string;
}) {
  return (
    <View className={`flex-row items-start gap-3 ${className}`}>
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${tint}26` }}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black text-white">{title}</Text>
        <Text className="mt-1 text-[13px] text-[#AFC2DB]">{detail}</Text>
      </View>
    </View>
  );
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
