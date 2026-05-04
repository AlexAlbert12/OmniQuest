import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type TicketPriority = 'low' | 'medium' | 'high';
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketCategory = 'plataforma' | 'clases' | 'preguntas' | 'cuenta' | 'otro';

type SupportTicket = {
  id: number
  subject: string
  category: TicketCategory
  status: TicketStatus
  priority: TicketPriority
  created_at: string
};

const faqItems = [
  {
    question: '¿Cómo invito alumnos a una asignatura?',
    answer: 'Abre la asignatura, copia el código de clase y compártelo con tus alumnos.',
  },
  {
    question: '¿Cómo puedo editar una pregunta ya creada?',
    answer: 'Entra en la asignatura, abre el tema y usa la opción editar en la pregunta.',
  },
  {
    question: '¿Dónde veo el progreso de mi clase?',
    answer: 'En el detalle de la asignatura puedes revisar participación, notas y actividad reciente.',
  },
  {
    question: '¿Cómo recupero acceso si olvidé la contraseña?',
    answer: 'Desde login usa recuperación de contraseña o cambia la contraseña en Configuración si tienes sesión.',
  },
];

const categoryOptions: { key: TicketCategory; label: string }[] = [
  { key: 'plataforma', label: 'Plataforma' },
  { key: 'clases', label: 'Clases' },
  { key: 'preguntas', label: 'Preguntas' },
  { key: 'cuenta', label: 'Cuenta' },
  { key: 'otro', label: 'Otro' },
];

const priorityOptions: { key: TicketPriority; label: string }[] = [
  { key: 'low', label: 'Baja' },
  { key: 'medium', label: 'Media' },
  { key: 'high', label: 'Alta' },
];

export default function TeacherHelpCenterScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<TicketCategory>('plataforma');
  const [priority, setPriority] = useState<TicketPriority>('medium');

  const isDesktop = width >= 1024;

  const ticketsTitle = useMemo(() => {
    return tickets.length > 0 ? `Mis tickets (${tickets.length})` : 'Mis tickets';
  }, [tickets.length]);

  const showAlert = (title: string, description: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${description}`);
      return;
    }
    Alert.alert(title, description);
  };

  const fetchHelpCenterData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace('/(auth)/login' as any);
        return;
      }

      setUserId(session.user.id);
      setEmail(session.user.email || '');

      const { data: ticketsData, error } = await supabase
        .from('user_support_tickets')
        .select('id, subject, category, status, priority, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error && error.code !== '42P01') throw error;
      setTickets((ticketsData || []) as SupportTicket[]);
    } catch (error: any) {
      showAlert('No se pudo cargar el centro de ayuda', error.message || 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchHelpCenterData();
    }, [fetchHelpCenterData])
  );

  const handleContactSupport = async () => {
    const to = 'soporte@omniquest.app';
    const mailSubject = encodeURIComponent('Soporte OmniQuest');
    const body = encodeURIComponent('Hola equipo de soporte, necesito ayuda con...');
    const url = `mailto:${to}?subject=${mailSubject}&body=${body}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      showAlert('Contacto', `Escríbenos a ${to}`);
      return;
    }
    await Linking.openURL(url);
  };

  const handleCreateTicket = async () => {
    if (!userId) {
      showAlert('Sesión no disponible', 'No se pudo identificar tu usuario.');
      return;
    }
    if (!subject.trim() || subject.trim().length < 5) {
      showAlert('Asunto incompleto', 'Escribe un asunto de al menos 5 caracteres.');
      return;
    }
    if (!message.trim() || message.trim().length < 15) {
      showAlert('Descripción incompleta', 'Describe el problema con al menos 15 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('user_support_tickets')
        .insert([
          {
            user_id: userId,
            role: 'teacher',
            category,
            subject: subject.trim(),
            message: message.trim(),
            contact_email: email || null,
            priority,
            status: 'open',
          },
        ])
        .select('id, subject, category, status, priority, created_at')
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Falta la tabla user_support_tickets. Aplica la migración en Supabase.');
        }
        throw error;
      }

      setTickets((current) => [data as SupportTicket, ...current].slice(0, 20));
      setSubject('');
      setMessage('');
      setCategory('plataforma');
      setPriority('medium');
      showAlert('Ticket creado', 'Tu solicitud se envió correctamente.');
    } catch (error: any) {
      showAlert('No se pudo crear el ticket', error.message || 'Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#061126]">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-3 text-[#AFC2DB]">Cargando centro de ayuda...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#061126]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: isDesktop ? 28 : 16,
          paddingTop: isDesktop ? 22 : 18,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-xl border border-[#20375E] bg-[#09162C]"
            >
              <Ionicons name="arrow-back" size={20} color="#DDE7F4" />
            </Pressable>
            <View>
              <Text className="text-[34px] font-black text-white">Centro de ayuda</Text>
              <Text className="mt-1 text-[12px] text-[#AFC2DB]">FAQ, contacto y tickets de soporte.</Text>
            </View>
          </View>
        </View>

        <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
          <Panel title="FAQ" className={isDesktop ? 'flex-1' : ''}>
            {faqItems.map((item, index) => {
              const open = openFaqIndex === index;
              return (
                <View key={item.question} className={`${index < faqItems.length - 1 ? 'border-b border-[#173056]' : ''}`}>
                  <Pressable
                    onPress={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                    className="flex-row items-center justify-between py-4"
                  >
                    <Text className="min-w-0 flex-1 pr-3 font-semibold text-white">{item.question}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#AFC2DB" />
                  </Pressable>
                  {open ? <Text className="pb-4 text-[13px] leading-6 text-[#B7C4D7]">{item.answer}</Text> : null}
                </View>
              );
            })}
          </Panel>

          <Panel title="Contacto rápido" className={isDesktop ? 'w-[360px]' : ''}>
            <Text className="text-[13px] leading-6 text-[#B7C4D7]">
              Si necesitas ayuda urgente, abre un ticket o escríbenos directamente.
            </Text>
            <Pressable
              onPress={handleContactSupport}
              className="mt-4 flex-row items-center justify-between rounded-xl border border-[#35578A] bg-[#0A2042] px-4 py-3"
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="mail-outline" size={18} color="#A78BFA" />
                <Text className="font-semibold text-white">Contactar soporte</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#A78BFA" />
            </Pressable>
          </Panel>
        </View>

        <View className={isDesktop ? 'mt-5 flex-row gap-5' : 'mt-5 gap-5'}>
          <Panel title="Crear ticket" className={isDesktop ? 'flex-1' : ''}>
            <FieldLabel label="Asunto" />
            <TextInput
              className="mt-2 rounded-lg border border-[#264267] bg-[#0A2042] px-4 py-3 text-[14px] text-white"
              placeholder="Ej. No se guardan preguntas en una asignatura"
              placeholderTextColor="#8FA7C7"
              value={subject}
              onChangeText={setSubject}
            />

            <FieldLabel label="Categoría" />
            <View className="mt-2 flex-row flex-wrap gap-2">
              {categoryOptions.map((option) => (
                <ChoiceChip
                  key={option.key}
                  label={option.label}
                  active={category === option.key}
                  onPress={() => setCategory(option.key)}
                />
              ))}
            </View>

            <FieldLabel label="Prioridad" />
            <View className="mt-2 flex-row flex-wrap gap-2">
              {priorityOptions.map((option) => (
                <ChoiceChip
                  key={option.key}
                  label={option.label}
                  active={priority === option.key}
                  onPress={() => setPriority(option.key)}
                />
              ))}
            </View>

            <FieldLabel label="Descripción" />
            <TextInput
              className="mt-2 min-h-[130px] rounded-lg border border-[#264267] bg-[#0A2042] px-4 py-3 text-[14px] text-white"
              placeholder="Cuéntanos el contexto, pasos y error observado."
              placeholderTextColor="#8FA7C7"
              multiline
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />

            <Pressable
              onPress={handleCreateTicket}
              disabled={submitting}
              className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-[#5A46D8] py-3"
              style={({ pressed }) => ({ opacity: submitting ? 0.7 : pressed ? 0.86 : 1 })}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send-outline" size={16} color="#FFFFFF" />}
              <Text className="font-bold text-white">{submitting ? 'Enviando...' : 'Enviar ticket'}</Text>
            </Pressable>
          </Panel>

          <Panel title={ticketsTitle} className={isDesktop ? 'w-[400px]' : ''}>
            {tickets.length === 0 ? (
              <EmptyState text="Aún no has creado tickets de soporte." />
            ) : (
              <View className="gap-3">
                {tickets.map((ticket) => (
                  <View key={ticket.id} className="rounded-xl border border-[#173056] bg-[#0A2042] p-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="min-w-0 flex-1 font-semibold text-white" numberOfLines={1}>
                        {ticket.subject}
                      </Text>
                      <StatusPill status={ticket.status} />
                    </View>
                    <Text className="mt-2 text-[12px] text-[#AFC2DB]">
                      {formatTicketCategory(ticket.category)} • Prioridad {formatTicketPriority(ticket.priority)} •{' '}
                      {formatRelativeDate(ticket.created_at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Panel>
        </View>
      </ScrollView>
    </View>
  );
}

function Panel({ title, className = '', children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <View className={`rounded-2xl border border-[#183052] bg-[#07162D] p-5 ${className}`}>
      <Text className="mb-4 text-[16px] font-black text-white">{title}</Text>
      {children}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text className="mt-3 text-[12px] font-semibold text-[#AFC2DB]">{label}</Text>;
}

function ChoiceChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg border px-3 py-2 ${active ? 'border-[#8B5CF6] bg-[#251E64]' : 'border-[#264267] bg-[#0A2042]'}`}
    >
      <Text className={`text-[12px] font-semibold ${active ? 'text-white' : 'text-[#AFC2DB]'}`}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="rounded-xl border border-dashed border-[#29466F] bg-[#09162C] px-4 py-6">
      <Text className="text-center text-[12px] text-[#8FA7C7]">{text}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: TicketStatus }) {
  const meta = getStatusMeta(status);
  return (
    <View className="rounded-full px-2 py-1" style={{ backgroundColor: meta.bg }}>
      <Text className="text-[11px] font-bold" style={{ color: meta.color }}>
        {meta.label}
      </Text>
    </View>
  );
}

function getStatusMeta(status: TicketStatus) {
  if (status === 'open') return { label: 'Abierto', color: '#C4B5FD', bg: '#2D206A' };
  if (status === 'in_progress') return { label: 'En curso', color: '#93C5FD', bg: '#1A3A67' };
  if (status === 'resolved') return { label: 'Resuelto', color: '#86EFAC', bg: '#173E2F' };
  return { label: 'Cerrado', color: '#FCA5A5', bg: '#4A1E2B' };
}

function formatTicketCategory(category: TicketCategory) {
  if (category === 'plataforma') return 'Plataforma';
  if (category === 'clases') return 'Clases';
  if (category === 'preguntas') return 'Preguntas';
  if (category === 'cuenta') return 'Cuenta';
  return 'Otro';
}

function formatTicketPriority(priority: TicketPriority) {
  if (priority === 'low') return 'baja';
  if (priority === 'high') return 'alta';
  return 'media';
}

function formatRelativeDate(date: string) {
  const target = new Date(date);
  const today = new Date();
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((startToday.getTime() - startTarget.getTime()) / 86400000);
  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  return `hace ${diffDays} días`;
}
