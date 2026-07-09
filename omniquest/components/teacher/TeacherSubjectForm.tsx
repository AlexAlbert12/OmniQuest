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
import { supabase } from '../../lib/supabase';
import TeacherBottomNav from './TeacherBottomNav';
import {
  generateUniqueClassCode,
  isClassCodeAvailable,
  isValidInviteCode,
  normalizeInviteCode,
} from '../../lib/classCode';

type TeacherSubjectFormProps = {
  mode: 'create' | 'edit';
  subjectId?: string;
};

type InviteMode = 'auto' | 'custom';

const iconChoices = ['📚', '🎓', '🧮', '🌐', '🧪', '🎨', '🔤', '🧲'] as const;
const educationLevels = ['1º ESO', '2º ESO', '3º ESO', '4º ESO', '1º Bachillerato', '2º Bachillerato'] as const;
const schoolYears = ['2024 - 2025', '2025 - 2026', '2026 - 2027'] as const;
const subjectsCatalog = ['Matemáticas', 'Lengua', 'Inglés', 'Ciencias', 'Historia', 'Tecnología'] as const;

export default function TeacherSubjectForm({ mode, subjectId }: TeacherSubjectFormProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<(typeof iconChoices)[number]>('📚');
  const [educationLevel, setEducationLevel] = useState<(typeof educationLevels)[number]>('2º Bachillerato');
  const [schoolYear, setSchoolYear] = useState<(typeof schoolYears)[number]>('2024 - 2025');
  const [subjectLabel, setSubjectLabel] = useState<(typeof subjectsCatalog)[number] | ''>('');
  const [inviteMode, setInviteMode] = useState<InviteMode>('auto');
  const [customCode, setCustomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [existingCode, setExistingCode] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(isEdit);
  const [codeLoading, setCodeLoading] = useState(!isEdit);
  const [saving, setSaving] = useState(false);

  const isWide = width >= 980;
  const studentsHint = '0 alumnos';
  const nameCounter = `${name.trim().length}/50`;
  const descriptionCounter = `${description.trim().length}/120`;

  const canSave =
    !saving &&
    !codeLoading &&
    name.trim().length > 0 &&
    (isEdit || (inviteMode === 'auto' && isValidInviteCode(generatedCode)) || (inviteMode === 'custom' && isValidInviteCode(customCode)));

  const previewTitle = useMemo(() => {
    const cleanName = name.trim();
    return cleanName.length > 0 ? cleanName : 'Nombre del curso';
  }, [name]);

  const previewMeta = useMemo(() => `${educationLevel}  •  ${schoolYear}`, [educationLevel, schoolYear]);

  useEffect(() => {
    if (isEdit) return;

    const loadUniqueCode = async () => {
      try {
        setCodeLoading(true);
        setGeneratedCode(await generateUniqueClassCode());
      } catch (error: any) {
        showAlert('Error', error.message || 'No se pudo generar un código de invitación.');
      } finally {
        setCodeLoading(false);
      }
    };

    void loadUniqueCode();
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit || !subjectId) return;

    const fetchSubject = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const teacherId = sessionData.session?.user.id;

        if (!teacherId) {
          throw new Error('No se encontró una sesión activa.');
        }

        const { data, error } = await supabase
          .from('subjects')
          .select('name, description, icon, code, education_level, academic_year, subject_label')
          .eq('id', Number(subjectId))
          .eq('teacher_id', teacherId)
          .single();

        if (error) throw error;

        const subjectIcon = data.icon && iconChoices.includes(data.icon as (typeof iconChoices)[number]) ? (data.icon as (typeof iconChoices)[number]) : '📚';
        const legacyMetadata = parseLegacySubjectMetadata(data.description || '');
        const cleanDescription = legacyMetadata.description;
        setName(data.name || '');
        setDescription(cleanDescription);
        setIcon(subjectIcon);
        setEducationLevel((data.education_level || legacyMetadata.educationLevel || educationLevels[0]) as (typeof educationLevels)[number]);
        setSchoolYear((data.academic_year || legacyMetadata.academicYear || schoolYears[0]) as (typeof schoolYears)[number]);
        setSubjectLabel((data.subject_label || legacyMetadata.subjectLabel || '') as (typeof subjectsCatalog)[number] | '');
        setExistingCode(data.code || '');
      } catch (error: any) {
        showAlert('Error', error.message || 'No se pudo cargar el curso.');
        router.back();
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchSubject();
  }, [isEdit, router, subjectId]);

  const handleRegenerateCode = async () => {
    if (isEdit) return;

    try {
      setCodeLoading(true);
      setGeneratedCode(await generateUniqueClassCode());
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo generar un código único.');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    const cleanDescription = description.trim();

    if (!cleanName) {
      showAlert('Error', 'El nombre del curso es obligatorio.');
      return;
    }

    if (cleanName.length > 50) {
      showAlert('Error', 'El nombre no puede superar 50 caracteres.');
      return;
    }

    if (cleanDescription.length > 120) {
      showAlert('Error', 'La descripción no puede superar 120 caracteres.');
      return;
    }

    if (!isEdit && inviteMode === 'custom' && !isValidInviteCode(customCode)) {
      showAlert('Error', 'El código personalizado debe tener 6 caracteres alfanuméricos.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        if (!subjectId) throw new Error('No se encontró el curso a editar.');

        const { data: sessionData } = await supabase.auth.getSession();
        const teacherId = sessionData.session?.user.id;

        if (!teacherId) {
          throw new Error('No se encontró una sesión activa.');
        }

        const { data, error } = await supabase.functions.invoke('teacher-update-subject', {
          body: {
            subjectId: Number(subjectId),
            name: cleanName,
            description: cleanDescription || null,
            icon,
            educationLevel,
            academicYear: schoolYear,
            subjectLabel: subjectLabel || null,
          },
        });

        if (error) throw error;
        if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);

        showAlert('Curso actualizado', 'Los cambios se guardaron correctamente.');
        router.back();
        return;
      }

      let code = inviteMode === 'auto' ? generatedCode : normalizeInviteCode(customCode);
      if (!isValidInviteCode(code)) {
        throw new Error('El código de invitación no es válido.');
      }

      const codeAvailable = await isClassCodeAvailable(code);
      if (!codeAvailable) {
        if (inviteMode === 'auto') {
          code = await generateUniqueClassCode();
          setGeneratedCode(code);
        } else {
          throw new Error('Ese código de invitación ya existe. Elige otro o genera uno nuevo.');
        }
      }

      const { data: createdSubject, error: createSubjectError } = await supabase.rpc('create_subject_with_default_topic', {
        p_name: cleanName,
        p_description: cleanDescription || null,
        p_icon: icon,
        p_code: inviteMode === 'auto' ? null : code,
        p_education_level: educationLevel,
        p_academic_year: schoolYear,
        p_subject_label: subjectLabel || null,
        p_theme_color: null,
      });

      if (createSubjectError) throw createSubjectError;

      const createdCode =
        createdSubject && typeof createdSubject === 'object' && !Array.isArray(createdSubject)
          ? String((createdSubject as { code?: string }).code || code)
          : code;

      showAlert('Curso creado', `Código de invitación: ${createdCode}`);
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message || 'No se pudo guardar el curso.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#6574FF" />
        <Text className="mt-4 text-[#8FA7C7]">Cargando curso...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#040E25]">
      <View className="absolute inset-0 bg-[#061126]" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: isWide ? 20 : 112 }} showsVerticalScrollIndicator={false}>
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
                <Text className="text-[36px] font-black text-white">{isEdit ? 'Editar Curso' : 'Nuevo Curso'}</Text>
                <Text className="mt-1 text-[14px] text-[#AFC2DB]">
                  Crea un nuevo curso y comienza a añadir clases, contenido y alumnos.
                </Text>
              </View>
            </View>

            <View className={`mt-5 gap-4 ${isWide ? 'flex-row' : ''}`}>
              <View className={`${isWide ? 'flex-[1.65]' : ''}`}>
                <SectionCard step={1} title="Información básica" description="Completa los datos principales de tu curso.">
                  <View className={`gap-4 ${width >= 760 ? 'flex-row' : ''}`}>
                    <View className={`${width >= 760 ? 'w-[34%]' : ''}`}>
                      <Label text="Icono (Emoji)" />
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
                      <Label text="Nombre del curso" />
                      <TextInput
                        className="mt-3 rounded-xl border border-[#28456B] bg-[#0A2042] px-4 py-3 text-[16px] text-white"
                        placeholder="Ej. Matemáticas Avanzadas"
                        placeholderTextColor="#7F95B7"
                        value={name}
                        onChangeText={setName}
                        maxLength={50}
                      />
                      <Text className="mt-2 text-right text-[12px] text-[#8FA7C7]">{nameCounter}</Text>

                      <Label text="Breve descripción (opcional)" className="mt-3" />
                      <TextInput
                        className="mt-3 min-h-[86px] rounded-xl border border-[#28456B] bg-[#0A2042] px-4 py-3 text-[15px] text-white"
                        placeholder="Describe brevemente de qué trata este curso..."
                        placeholderTextColor="#7F95B7"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        textAlignVertical="top"
                        maxLength={120}
                      />
                      <Text className="mt-2 text-right text-[12px] text-[#8FA7C7]">{descriptionCounter}</Text>
                    </View>
                  </View>
                </SectionCard>

                <SectionCard
                  step={2}
                  title="Configuración del curso"
                  description="Ajusta las opciones principales de tu curso."
                  className="mt-4"
                >
                  <View className={`gap-3 ${width >= 760 ? 'flex-row' : ''}`}>
                    <SelectBox
                      icon="people-outline"
                      tint="#8B5CF6"
                      label="Nivel educativo"
                      value={educationLevel}
                      onPress={() => {
                        const index = educationLevels.indexOf(educationLevel);
                        setEducationLevel(educationLevels[(index + 1) % educationLevels.length]);
                      }}
                    />
                    <SelectBox
                      icon="calendar-outline"
                      tint="#8B5CF6"
                      label="Año académico (opcional)"
                      value={schoolYear}
                      onPress={() => {
                        const index = schoolYears.indexOf(schoolYear);
                        setSchoolYear(schoolYears[(index + 1) % schoolYears.length]);
                      }}
                    />
                    <SelectBox
                      icon="pricetag-outline"
                      tint="#34D399"
                      label="Materia (opcional)"
                      value={subjectLabel || 'Selecciona una materia'}
                      onPress={() => {
                        if (!subjectLabel) {
                          setSubjectLabel(subjectsCatalog[0]);
                          return;
                        }
                        const index = subjectsCatalog.indexOf(subjectLabel);
                        setSubjectLabel(subjectsCatalog[(index + 1) % subjectsCatalog.length]);
                      }}
                    />
                  </View>
                </SectionCard>

                <SectionCard
                  step={3}
                  title="Código de invitación"
                  description="El código permitirá a tus alumnos unirse al curso y entrar en su clase principal."
                  className="mt-4"
                >
                  {isEdit ? (
                    <View className={`gap-4 ${width >= 840 ? 'flex-row items-center justify-between' : ''}`}>
                      <View className={`${width >= 840 ? 'flex-1' : ''}`}>
                        <Text className="font-bold text-[#B9A7FF]">Código actual del curso</Text>
                        <Text className="mt-1 text-[13px] text-[#AFC2DB]">
                          Este código ya está en uso por tus alumnos y se mantiene sin cambios.
                        </Text>
                      </View>
                      <View className={`${width >= 840 ? 'w-[320px]' : ''}`}>
                        <View className="rounded-2xl border border-dashed border-[#4C4CC6] bg-[#0A2042] p-4">
                          <Text className="text-center text-[17px] text-[#AFC2DB]">Código de invitación</Text>
                          <Text className="mt-3 text-center text-[52px] font-black tracking-[8px] text-[#9B8CFF]">
                            {existingCode || '------'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className={`gap-4 ${width >= 840 ? 'flex-row items-center justify-between' : ''}`}>
                      <View className={`${width >= 840 ? 'flex-1' : ''}`}>
                        <RadioOption
                          active={inviteMode === 'auto'}
                          title="Generar código automáticamente"
                          detail="Se generará un código único y seguro."
                          onPress={() => setInviteMode('auto')}
                        />
                        <RadioOption
                          active={inviteMode === 'custom'}
                          title="Personalizar código"
                          detail="Elige tu propio código de 6 caracteres."
                          onPress={() => setInviteMode('custom')}
                          className="mt-3"
                        />
                      </View>

                      <View className={`${width >= 840 ? 'w-[320px]' : ''}`}>
                        <View className="rounded-2xl border border-dashed border-[#4C4CC6] bg-[#0A2042] p-4">
                          <Text className="text-center text-[17px] text-[#AFC2DB]">
                            {inviteMode === 'auto' ? 'Código generado' : 'Código personalizado'}
                          </Text>
                          {inviteMode === 'custom' ? (
                            <TextInput
                              className="mt-3 rounded-xl border border-[#2A456A] bg-[#081A37] px-4 py-3 text-center text-[42px] font-black tracking-[8px] text-[#9B8CFF]"
                              value={normalizeInviteCode(customCode)}
                              onChangeText={(text) => setCustomCode(normalizeInviteCode(text))}
                              placeholder="ABC123"
                              placeholderTextColor="#5E6EA6"
                              autoCapitalize="characters"
                            />
                          ) : (
                            <Text className="mt-3 text-center text-[52px] font-black tracking-[8px] text-[#9B8CFF]">
                              {codeLoading ? '------' : generatedCode}
                            </Text>
                          )}
                        </View>
                        <Pressable
                          onPress={handleRegenerateCode}
                          disabled={codeLoading || inviteMode !== 'auto'}
                          className="mt-3 self-end rounded-xl border border-[#2A456A] bg-[#0A2042] p-3"
                          style={({ pressed }) => ({ opacity: codeLoading || inviteMode !== 'auto' ? 0.5 : pressed ? 0.82 : 1 })}
                        >
                          <Ionicons name="refresh" size={18} color="#AFC2DB" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </SectionCard>
              </View>

              <View className={`${isWide ? 'w-[30%]' : ''}`}>
                <View className="rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <Text className="text-[20px] font-black text-white">Vista previa</Text>
                  <Text className="mt-1 text-[14px] text-[#AFC2DB]">Así es como verán tus alumnos el curso.</Text>
                  <View className="mt-4 rounded-2xl border border-[#5A46D8] bg-[#4F46B8] p-5">
                    <View className="mx-auto h-20 w-20 items-center justify-center rounded-full bg-[#3A3398]">
                      <Text className="text-[36px]">{icon}</Text>
                    </View>
                    <Text className="mt-4 text-center text-[28px] font-black text-white">{previewTitle}</Text>
                    <Text className="mt-2 text-center text-[15px] text-[#D9D8FF]">{previewMeta}</Text>
                    <Text className="mt-5 text-center text-[15px] text-[#D9D8FF]">{studentsHint}</Text>
                  </View>
                </View>

                <View className="mt-4 rounded-2xl border border-[#1C3962] bg-[#071B3D] p-4">
                  <FeatureRow icon="shield-checkmark-outline" tint="#8B5CF6" title="Entorno seguro" detail="Solo los alumnos con el código podrán unirse." />
                  <FeatureRow icon="trophy-outline" tint="#F6A64A" title="Progreso del alumnado" detail="Los alumnos recibirán puntuación y podrán completar retos." className="mt-4" />
                  <FeatureRow icon="bar-chart-outline" tint="#FBBF24" title="Seguimiento" detail="Podrás ver el progreso y rendimiento de tus alumnos." className="mt-4" />
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
                <Text className="text-[15px] font-black text-white">
                  {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear Curso'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
      {!isWide ? <TeacherBottomNav active="classes" /> : null}
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

function SelectBox({
  icon,
  tint,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View className="min-w-[220px] flex-1 rounded-xl border border-[#28456B] bg-[#0A2042] p-3">
      <View className="flex-row items-center gap-2">
        <View className="h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: `${tint}2A` }}>
          <Ionicons name={icon} size={19} color={tint} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-semibold text-[#AFC2DB]">{label}</Text>
          <Pressable onPress={onPress} className="mt-2 flex-row items-center justify-between rounded-lg border border-[#35567D] bg-[#0B2348] px-3 py-2">
            <Text className="font-semibold text-white">{value}</Text>
            <Ionicons name="chevron-down" size={15} color="#AFC2DB" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RadioOption({
  active,
  title,
  detail,
  onPress,
  className = '',
}: {
  active: boolean;
  title: string;
  detail: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-start gap-3 ${className}`}>
      <View className={`mt-0.5 h-6 w-6 items-center justify-center rounded-full border ${active ? 'border-[#8B5CF6]' : 'border-[#5F7395]'}`}>
        {active ? <View className="h-3 w-3 rounded-full bg-[#8B5CF6]" /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`font-bold ${active ? 'text-[#B9A7FF]' : 'text-white'}`}>{title}</Text>
        <Text className="mt-1 text-[13px] text-[#AFC2DB]">{detail}</Text>
      </View>
    </Pressable>
  );
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

function parseLegacySubjectMetadata(value: string) {
  const parts = value.split(' · ').map((part) => part.trim()).filter(Boolean);
  let educationLevel = '';
  let academicYear = '';
  let subjectLabel = '';
  const descriptionParts: string[] = [];

  parts.forEach((part) => {
    if (part.startsWith('Materia: ')) {
      subjectLabel = part.replace('Materia: ', '').trim();
      return;
    }

    if (part.startsWith('Nivel: ')) {
      educationLevel = part.replace('Nivel: ', '').trim();
      return;
    }

    if (part.startsWith('Curso: ')) {
      academicYear = part.replace('Curso: ', '').trim();
      return;
    }

    descriptionParts.push(part);
  });

  return {
    description: descriptionParts.join(' · '),
    educationLevel,
    academicYear,
    subjectLabel,
  };
}
