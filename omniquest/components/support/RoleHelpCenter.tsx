import OmniLoadingScreen from '../ui/OmniLoadingScreen'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
import { useResponsiveLayout } from '../../lib/responsive'
import {
  addSupportReply,
  createSupportTicket,
  fetchOwnSupportTickets,
  fetchOwnSupportTicketsPage,
  fetchOwnSupportTicketById,
  fetchOwnSupportEmailHistory,
  fetchSupportContactChannels,
  fetchSupportThread,
  fetchSupportThreadPage,
  openSupportAttachment,
  openSupportContactChannel,
  pickSupportAttachment,
  type PickedSupportAttachment,
  type SupportAttachment,
  type SupportContactChannel,
  type SupportContactPreference,
  type SupportEmailDelivery,
  type SupportMessage,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../../lib/support'
import { supabase } from '../../lib/supabase'
import { trackUsageEvent } from '../../lib/analytics'
import { getNextLevelProgress, getStudentLevel } from '../../lib/studentLevel'
import { signOutCurrentDeviceSession } from '../../lib/pushNotifications'
import RolePageHeader from '../ui/RolePageHeader'
import StudentBottomNav from '../student/StudentBottomNav'
import StudentSidebar from '../student/StudentSidebar'
import TeacherBottomNav from '../teacher/TeacherBottomNav'
import TeacherSidebar from '../teacher/TeacherSidebar'
import AppButton from '../ui/AppButton'
import AppBackButton from '../ui/AppBackButton'
import { useAppModal } from '../AppModalProvider'

type HelpCenterRole = 'student' | 'teacher'

const categoryKeys: SupportTicketCategory[] = ['plataforma', 'cursos', 'preguntas', 'cuenta', 'otro']
const priorityKeys: SupportTicketPriority[] = ['low', 'medium', 'high']
const contactPreferenceKeys: SupportContactPreference[] = ['in_app', 'email', 'both']

export default function RoleHelpCenter({ role }: { role: HelpCenterRole }) {
  const router = useRouter()
  const params = useLocalSearchParams<{ ticket?: string }>()
  const responsive = useResponsiveLayout()
  const { accentColor, colors } = useAppTheme()
  const { t, formatDate } = useI18n()
  const { showModal } = useAppModal()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [replying, setReplying] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [shellAlias, setShellAlias] = useState(role === 'teacher' ? 'Profesor' : 'Alumno')
  const [shellAvatar, setShellAvatar] = useState<string | null>(null)
  const [shellPoints, setShellPoints] = useState(0)
  const [subjectsCount, setSubjectsCount] = useState(0)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketsTotal, setTicketsTotal] = useState(0)
  const [ticketsHasMore, setTicketsHasMore] = useState(false)
  const [loadingMoreTickets, setLoadingMoreTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const selectedTicketIdRef = useRef<number | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [attachments, setAttachments] = useState<SupportAttachment[]>([])
  const [threadHasMore, setThreadHasMore] = useState(false)
  const [nextBeforeMessageId, setNextBeforeMessageId] = useState<number | null>(null)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [contactChannels, setContactChannels] = useState<SupportContactChannel[]>([])
  const [emailHistory, setEmailHistory] = useState<SupportEmailDelivery[]>([])
  const [emailHistoryTotal, setEmailHistoryTotal] = useState(0)
  const [loadingMoreEmailHistory, setLoadingMoreEmailHistory] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<SupportTicketCategory>('plataforma')
  const [priority, setPriority] = useState<SupportTicketPriority>('medium')
  const [preferredChannel, setPreferredChannel] = useState<SupportContactPreference>('in_app')
  const [defaultSupportChannel, setDefaultSupportChannel] = useState<SupportContactPreference>('in_app')
  const [supportPreferenceEmail, setSupportPreferenceEmail] = useState('')
  const [savingSupportPreference, setSavingSupportPreference] = useState(false)
  const [attachment, setAttachment] = useState<PickedSupportAttachment | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyAttachment, setReplyAttachment] = useState<PickedSupportAttachment | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const isDesktop = responsive.isDesktop
  const canSubmitTicket = subject.trim().length >= 5 && body.trim().length >= 15
  const externalContactChannels = useMemo(() => contactChannels.filter((channel) => channel.channel_type !== 'in_app' && Boolean(channel.value)), [contactChannels])
  const studentLevel = getStudentLevel(shellPoints)
  const studentNextLevelProgress = getNextLevelProgress(shellPoints)

  const showAlert = useCallback((title: string, description: string) => {
    showModal({ title, message: description, variant: 'info' })
  }, [showModal])

  const openTicket = useCallback(async (ticket: SupportTicket) => {
    selectedTicketIdRef.current = ticket.id
    setSelectedTicket(ticket)
    setThreadLoading(true)
    try {
      const thread = await fetchSupportThread(ticket.id)
      setMessages(thread.messages)
      setAttachments(thread.attachments)
      setThreadHasMore(thread.hasMore)
      setNextBeforeMessageId(thread.nextBeforeId)
    } catch (error) {
      showAlert(t('support.error.title'), getErrorMessage(error, t('support.error.loadThread')))
    } finally {
      setThreadLoading(false)
    }
  }, [showAlert, t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.replace('/(auth)/login' as never)
        return
      }
      setUserId(data.session.user.id)
      setEmail(data.session.user.email || '')

      void fetchOwnSupportTickets
      const [ticketPage, channels, deliveryHistory, profileResult, subjectsResult, teacherPreferenceResult] = await Promise.all([
        fetchOwnSupportTicketsPage({ limit: 10, offset: 0 }),
        fetchSupportContactChannels(),
        fetchOwnSupportEmailHistory(10, 0),
        supabase.from('profiles').select('alias, avatar, points').eq('id', data.session.user.id).maybeSingle(),
        role === 'teacher'
          ? supabase.from('subjects').select('id').eq('teacher_id', data.session.user.id).eq('is_archived', false)
          : Promise.resolve({ data: [] as { id: number }[], error: null }),
        role === 'teacher'
          ? supabase.rpc('get_teacher_notification_settings')
          : Promise.resolve({ data: null, error: null }),
      ])
      if (!profileResult.error && profileResult.data) {
        setShellAlias(profileResult.data.alias?.trim() || (role === 'teacher' ? 'Profesor' : 'Alumno'))
        setShellAvatar(profileResult.data.avatar || null)
        setShellPoints(Number(profileResult.data.points || 0))
      }
      if (!subjectsResult.error) setSubjectsCount((subjectsResult.data || []).length)
      if (role === 'teacher' && !teacherPreferenceResult.error) {
        const supportPreference = readTeacherSupportPreference(teacherPreferenceResult.data, data.session.user.email || '')
        setDefaultSupportChannel(supportPreference.channel)
        setPreferredChannel(supportPreference.channel)
        setSupportPreferenceEmail(supportPreference.email)
      }
      const nextTickets = ticketPage.tickets
      setTickets(nextTickets)
      setTicketsTotal(ticketPage.total)
      setTicketsHasMore(ticketPage.hasMore)
      setContactChannels(channels)
      setEmailHistory(deliveryHistory.deliveries)
      setEmailHistoryTotal(deliveryHistory.total)
      const requestedTicketId = Number(params.ticket)
      if (Number.isFinite(requestedTicketId)) {
        const requestedTicket = nextTickets.find((ticket) => ticket.id === requestedTicketId)
          || await fetchOwnSupportTicketById(requestedTicketId)
        if (requestedTicket) {
          setTickets((current) => current.some((ticket) => ticket.id === requestedTicket.id)
            ? current
            : [requestedTicket, ...current])
          await openTicket(requestedTicket)
        }
      } else if (selectedTicketIdRef.current !== null) {
        const refreshed = nextTickets.find((ticket) => ticket.id === selectedTicketIdRef.current)
        if (refreshed) await openTicket(refreshed)
      }
    } catch (error) {
      showAlert(t('support.error.title'), getErrorMessage(error, t('support.error.load')))
    } finally {
      setLoading(false)
    }
  }, [openTicket, params.ticket, role, router, showAlert, t])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const backToSettings = useCallback(() => {
    router.replace(`/${role === 'teacher' ? '(teacher)' : '(student)'}/settings?section=about` as never)
  }, [role, router])

  const handleSignOut = useCallback(async () => {
    await signOutCurrentDeviceSession()
    router.replace('/(auth)/login' as never)
  }, [router])

  const loadMoreTickets = useCallback(async () => {
    if (!ticketsHasMore || loadingMoreTickets) return
    setLoadingMoreTickets(true)
    try {
      const page = await fetchOwnSupportTicketsPage({ limit: 10, offset: tickets.length })
      setTickets((current) => {
        const seen = new Set(current.map((ticket) => ticket.id))
        return [...current, ...page.tickets.filter((ticket) => !seen.has(ticket.id))]
      })
      setTicketsTotal(page.total)
      setTicketsHasMore(page.hasMore)
    } catch (error) {
      showAlert(t('support.error.title'), getErrorMessage(error, t('support.error.load')))
    } finally {
      setLoadingMoreTickets(false)
    }
  }, [loadingMoreTickets, showAlert, t, tickets.length, ticketsHasMore])

  const loadMoreEmailHistory = useCallback(async () => {
    if (loadingMoreEmailHistory || emailHistory.length >= emailHistoryTotal) return
    setLoadingMoreEmailHistory(true)
    try {
      const page = await fetchOwnSupportEmailHistory(10, emailHistory.length)
      setEmailHistory((current) => {
        const seen = new Set(current.map((delivery) => delivery.id))
        return [...current, ...page.deliveries.filter((delivery) => !seen.has(delivery.id))]
      })
      setEmailHistoryTotal(page.total)
    } catch (error) {
      showAlert(t('support.error.title'), getErrorMessage(error, 'No se pudo cargar el historial de emails.'))
    } finally {
      setLoadingMoreEmailHistory(false)
    }
  }, [emailHistory.length, emailHistoryTotal, loadingMoreEmailHistory, showAlert, t])

  const loadOlderMessages = useCallback(async () => {
    if (!selectedTicket || !threadHasMore || !nextBeforeMessageId || loadingOlderMessages) return
    setLoadingOlderMessages(true)
    try {
      const page = await fetchSupportThreadPage({
        ticketId: selectedTicket.id,
        limit: 30,
        beforeId: nextBeforeMessageId,
      })
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id))
        return [...page.messages.filter((message) => !seen.has(message.id)), ...current]
      })
      setAttachments((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [...page.attachments.filter((item) => !seen.has(item.id)), ...current]
      })
      setThreadHasMore(page.hasMore)
      setNextBeforeMessageId(page.nextBeforeId)
    } catch (error) {
      showAlert(t('support.error.title'), getErrorMessage(error, t('support.error.loadThread')))
    } finally {
      setLoadingOlderMessages(false)
    }
  }, [loadingOlderMessages, nextBeforeMessageId, selectedTicket, showAlert, t, threadHasMore])

  const summary = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    inProgress: tickets.filter((ticket) => ticket.status === 'in_progress').length,
    resolved: tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length,
  }), [tickets])

  const faqs = role === 'teacher'
    ? [0, 1, 2, 3].map((index) => ({ question: t(`support.faq.teacher.${index}.q`), answer: t(`support.faq.teacher.${index}.a`) }))
    : [0, 1, 2, 3].map((index) => ({ question: t(`support.faq.student.${index}.q`), answer: t(`support.faq.student.${index}.a`) }))

  const pickAttachment = async (reply = false) => {
    try {
      const picked = await pickSupportAttachment()
      if (reply) setReplyAttachment(picked)
      else setAttachment(picked)
    } catch (error) {
      showAlert(t('support.attachment.error'), getErrorMessage(error, t('support.attachment.invalid')))
    }
  }

  const saveTeacherSupportPreference = async () => {
    if (role !== 'teacher') return
    setSavingSupportPreference(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('set_teacher_support_preference', {
        p_channel: defaultSupportChannel,
        p_contact_email: defaultSupportChannel === 'in_app' ? undefined : supportPreferenceEmail.trim() || undefined,
      })
      if (rpcError) throw rpcError
      const saved = readTeacherSupportPreference(data, email)
      setDefaultSupportChannel(saved.channel)
      setPreferredChannel(saved.channel)
      setSupportPreferenceEmail(saved.email)
      showModal({ title: t('support.preference.saved'), message: t('support.preference.savedDetail'), variant: 'success' })
    } catch (error) {
      showAlert(t('support.error.title'), getErrorMessage(error, t('support.error.retry')))
    } finally {
      setSavingSupportPreference(false)
    }
  }

  const submitTicket = async () => {
    if (!userId) return
    if (subject.trim().length < 5 || body.trim().length < 15) {
      showAlert(t('support.form.incomplete'), t('support.form.validation'))
      return
    }
    setSubmitting(true)
    try {
      const result = await createSupportTicket({
        userId,
        role,
        contactEmail: role === 'teacher' && preferredChannel !== 'in_app' ? (supportPreferenceEmail.trim() || email || null) : email || null,
        subject,
        body,
        category,
        priority,
        preferredChannel,
        attachment,
      })
      setSubject('')
      setBody('')
      setCategory('plataforma')
      setPriority('medium')
      setPreferredChannel(defaultSupportChannel)
      setAttachment(null)
      void trackUsageEvent('support_ticket_created', { properties: { role, category, priority } })
      await load()
      await openTicket(result.ticket)
      showModal({
        title: t('support.form.created'),
        message: result.attachmentError ? `${t('support.form.createdDetail')} ${result.attachmentError}` : t('support.form.createdDetail'),
        variant: 'success',
      })
    } catch (error) {
      showAlert(t('support.error.create'), getErrorMessage(error, t('support.error.retry')))
    } finally {
      setSubmitting(false)
    }
  }

  const submitReply = async () => {
    if (!userId || !selectedTicket || replyBody.trim().length < 2) return
    setReplying(true)
    try {
      const result = await addSupportReply({
        ticketId: selectedTicket.id,
        userId,
        body: replyBody,
        attachment: replyAttachment,
      })
      setReplyBody('')
      setReplyAttachment(null)
      await openTicket(selectedTicket)
      await load()
      if (result.attachmentError) showAlert(t('support.attachment.error'), result.attachmentError)
    } catch (error) {
      showAlert(t('support.error.reply'), getErrorMessage(error, t('support.error.retry')))
    } finally {
      setReplying(false)
    }
  }

  if (loading) return <OmniLoadingScreen />

  const faqPanel = (
    <SupportPanel title={t('support.faq.title')} icon="help-circle-outline">
      <View className="gap-2">
        {faqs.map((faq, index) => (
          <Pressable
            key={faq.question}
            accessibilityRole="button"
            accessibilityState={{ expanded: openFaq === index }}
            onPress={() => setOpenFaq(openFaq === index ? null : index)}
            className="rounded-xl border p-4"
            style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 font-black" style={{ color: colors.text }}>{faq.question}</Text>
              <Ionicons name={openFaq === index ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textSecondary} />
            </View>
            {openFaq === index ? <Text className="mt-3 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{faq.answer}</Text> : null}
          </Pressable>
        ))}
      </View>
    </SupportPanel>
  )

  const tutorialPanel = (
    <SupportPanel title={t('support.tutorial.title')} icon="compass-outline">
      <Text className="mb-4 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{t(role === 'teacher' ? 'support.tutorial.teacherDescription' : 'support.tutorial.studentDescription')}</Text>
      <AppButton label={t('support.tutorial.action')} icon="play-circle-outline" variant="primary" role={role} onPress={() => router.push(`/${role === 'teacher' ? '(teacher)' : '(student)'}/onboarding?replay=1` as never)} />
    </SupportPanel>
  )

  const supportPreferencePanel = role === 'teacher' ? (
    <SupportPanel title={t('support.preference.title')} icon="chatbubbles-outline">
      <Text className="mb-4 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{t('support.preference.description')}</Text>
      <ChoiceGroup
        label={t('support.form.contactPreference')}
        values={contactPreferenceKeys}
        value={defaultSupportChannel}
        onChange={setDefaultSupportChannel}
        labelFor={(value) => value === 'in_app' ? t('support.channel.inApp') : value === 'email' ? t('support.channel.email') : t('support.channel.both')}
        accentColor={accentColor}
        colors={colors}
        isDesktop={isDesktop}
      />
      {defaultSupportChannel !== 'in_app' ? (
        <SupportInput label={t('support.preference.email')} value={supportPreferenceEmail} onChangeText={setSupportPreferenceEmail} colors={colors} placeholder={email || 'profesor@centro.es'} />
      ) : null}
      <AppButton label={t('support.preference.save')} icon="save-outline" role="teacher" variant="primary" loading={savingSupportPreference} onPress={() => void saveTeacherSupportPreference()} />
    </SupportPanel>
  ) : null

  const createTicketPanel = (
    <SupportPanel title={t('support.form.title')} icon="create-outline">
      <SupportInput label={t('support.form.subject')} value={subject} onChangeText={setSubject} colors={colors} placeholder={t('support.form.subjectPlaceholder')} />
      <SupportInput label={t('support.form.description')} value={body} onChangeText={setBody} colors={colors} placeholder={t('support.form.descriptionPlaceholder')} multiline />

      <ChoiceGroup
        label={t('support.form.category')}
        values={categoryKeys}
        value={category}
        onChange={setCategory}
        labelFor={(value) => t(`support.category.${value}`)}
        accentColor={accentColor}
        colors={colors}
        balancedMobile
        isDesktop={isDesktop}
      />
      <ChoiceGroup
        label={t('support.form.priority')}
        values={priorityKeys}
        value={priority}
        onChange={setPriority}
        labelFor={(value) => t(`support.priority.${value}`)}
        accentColor={accentColor}
        colors={colors}
        isDesktop={isDesktop}
      />
      <ChoiceGroup
        label={role === 'teacher' ? t('support.preference.ticketChannel') : t('support.form.contactPreference')}
        values={contactPreferenceKeys}
        value={preferredChannel}
        onChange={setPreferredChannel}
        labelFor={(value) => value === 'in_app' ? t('support.channel.inApp') : value === 'email' ? t('support.channel.email') : t('support.channel.both')}
        accentColor={accentColor}
        colors={colors}
        isDesktop={isDesktop}
      />

      <AttachmentPicker attachment={attachment} colors={colors} onPick={() => void pickAttachment()} onRemove={() => setAttachment(null)} t={t} />
      <AppButton
        accessibilityHint={t('support.form.submitHint')}
        disabled={!canSubmitTicket}
        fullWidth
        icon="send-outline"
        label={submitting ? t('support.form.sending') : t('support.form.submit')}
        loading={submitting}
        onPress={() => void submitTicket()}
        role={role}
        size="md"
        style={{ marginTop: 16 }}
      />
    </SupportPanel>
  )

  const ticketsPanel = (
    <SupportPanel title={`${t('support.tickets.title')} (${ticketsTotal})`} icon="ticket-outline">
      <View className="mb-4 flex-row gap-3">
        <SummaryItem compact={ticketsTotal === 0} label={t('support.status.open')} value={summary.open} color="#F6A64A" colors={colors} />
        <SummaryItem compact={ticketsTotal === 0} label={t('support.status.in_progress')} value={summary.inProgress} color="#58B5FF" colors={colors} />
        <SummaryItem compact={ticketsTotal === 0} label={t('support.status.resolved')} value={summary.resolved} color="#34D399" colors={colors} />
      </View>
      <View className="gap-3">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} selected={ticket.id === selectedTicket?.id} onPress={() => void openTicket(ticket)} colors={colors} accentColor={accentColor} t={t} formatDate={formatDate} />
        ))}
        {tickets.length === 0 ? <Text className="py-4 text-center" style={{ color: colors.textMuted }}>{t('support.tickets.empty')}</Text> : null}
        {ticketsHasMore ? (
          <AppButton
            label={t('support.tickets.loadMore')}
            icon="chevron-down-outline"
            variant="secondary"
            loading={loadingMoreTickets}
            onPress={() => void loadMoreTickets()}
          />
        ) : null}
      </View>
    </SupportPanel>
  )

  const conversationPanel = selectedTicket ? (
    <SupportPanel title={`#${selectedTicket.id} · ${selectedTicket.subject}`} icon="chatbubbles-outline">
      <TicketSla ticket={selectedTicket} colors={colors} t={t} formatDate={formatDate} />
      {threadLoading ? <ActivityIndicator className="my-8" color={accentColor} /> : (
        <View className="mt-4 gap-3">
          {threadHasMore ? (
            <AppButton
              label={t('support.thread.loadOlder')}
              icon="time-outline"
              variant="secondary"
              loading={loadingOlderMessages}
              onPress={() => void loadOlderMessages()}
            />
          ) : null}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} attachments={attachments.filter((item) => item.message_id === message.id)} role={role} colors={colors} t={t} formatDate={formatDate} showAlert={showAlert} />
          ))}
          {attachments.filter((item) => item.message_id === null).map((item) => (
            <AttachmentButton key={item.id} attachment={item} colors={colors} t={t} showAlert={showAlert} />
          ))}
        </View>
      )}

      {selectedTicket.status !== 'closed' ? (
        <View className="mt-5 border-t pt-4" style={{ borderTopColor: colors.border }}>
          <SupportInput label={t('support.reply.title')} value={replyBody} onChangeText={setReplyBody} colors={colors} placeholder={t('support.reply.placeholder')} multiline />
          <AttachmentPicker attachment={replyAttachment} colors={colors} onPick={() => void pickAttachment(true)} onRemove={() => setReplyAttachment(null)} t={t} />
          <AppButton
            disabled={replyBody.trim().length < 2}
            fullWidth
            icon="send-outline"
            label={t('support.reply.send')}
            loading={replying}
            onPress={() => void submitReply()}
            role={role}
            style={{ marginTop: 12 }}
          />
        </View>
      ) : null}
    </SupportPanel>
  ) : (
    <SupportPanel title={t('support.detail.title')} icon="chatbubble-ellipses-outline">
      {ticketsTotal === 0 ? (
        <SupportEmptyState title={t('support.detail.noTicketsTitle')} description={t('support.detail.noTicketsDescription')} colors={colors} />
      ) : (
        <SupportEmptyState title={t('support.detail.empty')} colors={colors} />
      )}
    </SupportPanel>
  )

  const channelsPanel = externalContactChannels.length > 0 ? (
    <SupportPanel title={t('support.channels.title')} icon="call-outline">
      <View className="gap-3">
        {externalContactChannels.map((channel) => (
          <View key={channel.channel_key} className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
            <Text className="font-black" style={{ color: colors.text }}>{channel.label}</Text>
            {channel.description ? <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{channel.description}</Text> : null}
            {channel.value ? <Text selectable className="mt-2 text-[11px] font-bold" style={{ color: accentColor }}>{channel.value}</Text> : null}
            <AppButton
              style={{ marginTop: 10 }}
              accessibilityLabel={t('support.channels.openNamed', { name: channel.label })}
              label={t('support.channels.open')}
              icon={channel.channel_type === 'email' ? 'mail-outline' : 'open-outline'}
              size="sm"
              variant="secondary"
              onPress={() => void openSupportContactChannel(channel).catch((error) => showAlert(t('support.channels.openErrorTitle'), getErrorMessage(error, t('support.channels.openErrorDetail'))))}
            />
          </View>
        ))}
      </View>
    </SupportPanel>
  ) : null

  const emailHistoryPanel = (
    <SupportPanel title={t('support.emailHistory.title')} icon="mail-outline">
      <View className="gap-3">
        {emailHistory.map((delivery) => (
          <View key={delivery.id} className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
            <View className="flex-row items-center gap-2">
              <Ionicons name={delivery.status === 'sent' ? 'checkmark-circle-outline' : delivery.status === 'failed' ? 'alert-circle-outline' : 'time-outline'} size={17} color={delivery.status === 'sent' ? colors.success : delivery.status === 'failed' ? colors.danger : accentColor} />
              <Text className="min-w-0 flex-1 font-black" numberOfLines={2} style={{ color: colors.text }}>{delivery.subject}</Text>
            </View>
            <Text className="mt-2 text-[11px]" style={{ color: colors.textMuted }}>Ticket #{delivery.ticket_id} · {delivery.status} · {formatDate(delivery.sent_at || delivery.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</Text>
            {delivery.error_message ? <Text className="mt-1 text-[11px]" style={{ color: colors.danger }}>{delivery.error_message}</Text> : null}
          </View>
        ))}
        {emailHistory.length === 0 ? <Text style={{ color: colors.textMuted }}>{t('support.emailHistory.empty')}</Text> : null}
        {emailHistory.length < emailHistoryTotal ? (
          <AppButton
            label={t('support.emailHistory.loadMore')}
            icon="chevron-down-outline"
            variant="secondary"
            loading={loadingMoreEmailHistory}
            onPress={() => void loadMoreEmailHistory()}
          />
        ) : null}
      </View>
    </SupportPanel>
  )

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 flex-row">
        {isDesktop ? role === 'teacher' ? (
          <TeacherSidebar activeSection="settings" subjectsCount={subjectsCount} onSignOut={handleSignOut} alias={shellAlias} avatar={shellAvatar} />
        ) : (
          <StudentSidebar activeSection="settings" alias={shellAlias} avatar={shellAvatar} level={studentLevel} points={shellPoints} nextLevelProgress={studentNextLevelProgress} onSignOut={handleSignOut} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: isDesktop ? 28 : 16, paddingTop: isDesktop ? 22 : 18, paddingBottom: isDesktop ? 40 : MOBILE_BOTTOM_NAV_SPACER }}
          showsVerticalScrollIndicator={false}
        >
          <AppBackButton
            accessibilityLabel={t('settings.back')}
            label={t('settings.back')}
            onPress={backToSettings}
            size="sm"
            style={{ marginBottom: 12 }}
          />

          <RolePageHeader
            role={role}
            compactMobileTitle
            icon="help-buoy-outline"
            isDesktop={isDesktop}
            title={t('support.title')}
            notificationOnPress={() => router.push(`/${role === 'teacher' ? '(teacher)' : '(student)'}/notifications` as never)}
          />

          {isDesktop ? (
            <View className="flex-row gap-5">
              <View className="min-w-0 flex-[1.25] gap-5">
                {supportPreferencePanel}
                {createTicketPanel}
                {ticketsPanel}
              </View>
              <View className="min-w-0 flex-1 gap-5">
                {faqPanel}
                {tutorialPanel}
                {conversationPanel}
                {channelsPanel}
                {emailHistoryPanel}
              </View>
            </View>
          ) : (
            <View className="gap-5">
              {faqPanel}
              {tutorialPanel}
              {supportPreferencePanel}
              {createTicketPanel}
              {ticketsPanel}
              {conversationPanel}
              {channelsPanel}
              {emailHistoryPanel}
            </View>
          )}
        </ScrollView>
      </View>
      {!isDesktop ? role === 'teacher' ? <TeacherBottomNav active="settings" /> : <StudentBottomNav active="settings" /> : null}
    </SafeAreaView>
  )
}

function SupportPanel({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { colors, accentColor } = useAppTheme()
  return <View className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
    <View className="mb-4 flex-row items-center gap-3"><Ionicons name={icon} size={20} color={accentColor} /><Text className="min-w-0 flex-1 text-[16px] font-black" style={{ color: colors.text }}>{title}</Text></View>
    {children}
  </View>
}

function SupportInput({ label, value, onChangeText, placeholder, multiline = false, colors }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return <View className="mb-4"><Text className="mb-2 text-[12px] font-bold" style={{ color: colors.textSecondary }}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} className={`rounded-xl border px-4 py-3 ${multiline ? 'min-h-[120px]' : ''}`} style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.text }} /></View>
}

function ChoiceGroup<T extends string>({ label, values, value, onChange, labelFor, accentColor, colors, balancedMobile = false, isDesktop = false }: { label: string; values: T[]; value: T; onChange: (value: T) => void; labelFor: (value: T) => string; accentColor: string; colors: ReturnType<typeof useAppTheme>['colors']; balancedMobile?: boolean; isDesktop?: boolean }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-[12px] font-bold" style={{ color: colors.textSecondary }}>{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {values.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: item === value }}
            onPress={() => onChange(item)}
            className="min-h-[42px] items-center justify-center rounded-full border px-3 py-2"
            style={{
              borderColor: item === value ? accentColor : colors.border,
              backgroundColor: item === value ? `${accentColor}22` : colors.surfaceRaised,
              ...(!isDesktop && balancedMobile ? { flexBasis: '30%' as `${number}%`, flexGrow: 1 } : {}),
            }}
          >
            <Text className="text-center text-[11px] font-black" style={{ color: item === value ? accentColor : colors.textSecondary }}>{labelFor(item)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function AttachmentPicker({ attachment, onPick, onRemove, colors, t }: { attachment: PickedSupportAttachment | null; onPick: () => void; onRemove: () => void; colors: ReturnType<typeof useAppTheme>['colors']; t: ReturnType<typeof useI18n>['t'] }) {
  return <View className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>{attachment ? <View className="flex-row items-center gap-3"><Ionicons name="document-attach-outline" size={20} color={colors.textSecondary} /><View className="min-w-0 flex-1"><Text className="font-bold" numberOfLines={1} style={{ color: colors.text }}>{attachment.fileName}</Text><Text className="text-[11px]" style={{ color: colors.textMuted }}>{formatBytes(attachment.sizeBytes)}</Text></View><Pressable accessibilityLabel={t('support.attachment.remove')} onPress={onRemove}><Ionicons name="close-circle" size={22} color={colors.danger} /></Pressable></View> : <Pressable onPress={onPick} className="flex-row items-center justify-center gap-2 py-2"><Ionicons name="attach-outline" size={19} color={colors.textSecondary} /><Text className="font-bold" style={{ color: colors.textSecondary }}>{t('support.attachment.add')}</Text></Pressable>}</View>
}

function SummaryItem({ label, value, color, colors, compact = false }: { label: string; value: number; color: string; colors: ReturnType<typeof useAppTheme>['colors']; compact?: boolean }) {
  return (
    <View className={`min-w-0 flex-1 rounded-xl border ${compact ? 'px-3 py-2' : 'p-3'}`} style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
      <Text className={`${compact ? 'text-[18px]' : 'text-[20px]'} font-black`} style={{ color }}>{value}</Text>
      <Text className={`${compact ? 'mt-0.5' : 'mt-1'} text-[10px] font-bold`} numberOfLines={1} style={{ color: colors.textMuted }}>{label}</Text>
    </View>
  )
}

function SupportEmptyState({ title, description, colors }: { title: string; description?: string; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return (
    <View className="items-center px-4 py-7">
      <Text className="text-center text-[14px] font-black" style={{ color: colors.text }}>{title}</Text>
      {description ? <Text className="mt-2 max-w-[360px] text-center text-[12px] leading-5" style={{ color: colors.textMuted }}>{description}</Text> : null}
    </View>
  )
}

function TicketCard({ ticket, selected, onPress, colors, accentColor, t, formatDate }: { ticket: SupportTicket; selected: boolean; onPress: () => void; colors: ReturnType<typeof useAppTheme>['colors']; accentColor: string; t: ReturnType<typeof useI18n>['t']; formatDate: ReturnType<typeof useI18n>['formatDate'] }) {
  return <Pressable onPress={onPress} className="rounded-xl border p-4" style={{ borderColor: selected ? accentColor : colors.border, backgroundColor: selected ? `${accentColor}14` : colors.surfaceRaised }}><View className="flex-row items-start justify-between gap-3"><View className="min-w-0 flex-1"><Text className="font-black" style={{ color: colors.text }}>{ticket.subject}</Text><Text className="mt-1 text-[11px]" style={{ color: colors.textMuted }}>#{ticket.id} · {formatDate(ticket.updated_at, { dateStyle: 'medium', timeStyle: 'short' })}</Text></View><StatusPill status={ticket.status} t={t} /></View><Text className="mt-3 text-[12px]" style={{ color: colors.textSecondary }}>{getSlaSummary(ticket, t)}</Text></Pressable>
}

function StatusPill({ status, t }: { status: SupportTicketStatus; t: ReturnType<typeof useI18n>['t'] }) {
  const color = status === 'resolved' || status === 'closed' ? '#34D399' : status === 'in_progress' ? '#58B5FF' : '#F6A64A'
  return <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}22` }}><Text className="text-[10px] font-black" style={{ color }}>{t(`support.status.${status}`)}</Text></View>
}

function TicketSla({ ticket, colors, t, formatDate }: { ticket: SupportTicket; colors: ReturnType<typeof useAppTheme>['colors']; t: ReturnType<typeof useI18n>['t']; formatDate: ReturnType<typeof useI18n>['formatDate'] }) {
  const due = ticket.first_responded_at ? ticket.resolution_due_at : ticket.first_response_due_at
  return <View className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}><View className="flex-row items-center gap-2"><Ionicons name="time-outline" size={17} color="#F6A64A" /><Text className="font-black" style={{ color: colors.text }}>{t('support.sla.title')}</Text></View><Text className="mt-2 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{ticket.status === 'resolved' || ticket.status === 'closed' ? t('support.sla.completed') : due ? t(ticket.first_responded_at ? 'support.sla.resolution' : 'support.sla.firstResponse', { date: formatDate(due, { dateStyle: 'medium', timeStyle: 'short' }) }) : t('support.sla.unavailable')}</Text></View>
}

function MessageBubble({ message, attachments, role, colors, t, formatDate, showAlert }: { message: SupportMessage; attachments: SupportAttachment[]; role: HelpCenterRole; colors: ReturnType<typeof useAppTheme>['colors']; t: ReturnType<typeof useI18n>['t']; formatDate: ReturnType<typeof useI18n>['formatDate']; showAlert: (title: string, description: string) => void }) {
  const own = message.author_role === role
  return <View className={`max-w-[92%] rounded-2xl border p-4 ${own ? 'self-end' : 'self-start'}`} style={{ borderColor: colors.border, backgroundColor: own ? colors.surfaceMuted : colors.surfaceRaised }}><Text className="text-[10px] font-black uppercase" style={{ color: colors.textMuted }}>{own ? t('support.message.you') : message.author_role === 'admin' ? t('support.message.support') : t('support.message.system')}</Text><Text className="mt-2 text-[13px] leading-5" style={{ color: colors.text }}>{message.body}</Text><Text className="mt-2 text-[10px]" style={{ color: colors.textMuted }}>{formatDate(message.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</Text>{attachments.map((item) => <AttachmentButton key={item.id} attachment={item} colors={colors} t={t} showAlert={showAlert} />)}</View>
}

function AttachmentButton({ attachment, colors, t, showAlert }: { attachment: SupportAttachment; colors: ReturnType<typeof useAppTheme>['colors']; t: ReturnType<typeof useI18n>['t']; showAlert: (title: string, description: string) => void }) {
  return <Pressable onPress={() => void openSupportAttachment(attachment).catch((error) => showAlert(t('support.attachment.error'), getErrorMessage(error, t('support.attachment.expired'))))} className="mt-3 flex-row items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: colors.border }}><Ionicons name="document-attach-outline" size={16} color={colors.textSecondary} /><Text className="min-w-0 flex-1 text-[11px] font-bold" numberOfLines={1} style={{ color: colors.textSecondary }}>{attachment.file_name}</Text><Text className="text-[10px]" style={{ color: colors.textMuted }}>{formatBytes(attachment.size_bytes)}</Text></Pressable>
}

function getSlaSummary(ticket: SupportTicket, t: ReturnType<typeof useI18n>['t']) {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return t('support.sla.completed')
  const due = ticket.first_responded_at ? ticket.resolution_due_at : ticket.first_response_due_at
  if (!due) return t('support.sla.unavailable')
  const remainingMs = new Date(due).getTime() - Date.now()
  if (remainingMs <= 0) return t('support.sla.overdue')
  const hours = Math.max(1, Math.ceil(remainingMs / 3_600_000))
  return t('support.sla.remaining', { hours })
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function readTeacherSupportPreference(value: unknown, fallbackEmail: string) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const globalValue = payload.global && typeof payload.global === 'object' && !Array.isArray(payload.global) ? payload.global as Record<string, unknown> : {}
  const rawChannel = globalValue.support_preferred_channel
  const channel: SupportContactPreference = rawChannel === 'email' || rawChannel === 'both' ? rawChannel : 'in_app'
  const emailValue = typeof globalValue.support_contact_email === 'string' ? globalValue.support_contact_email : fallbackEmail
  return { channel, email: emailValue }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
