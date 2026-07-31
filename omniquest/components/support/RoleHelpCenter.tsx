import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import { MOBILE_BOTTOM_NAV_SPACER } from '../../lib/mobileLayout'
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
import RolePageHeader from '../ui/RolePageHeader'
import StudentBottomNav from '../student/StudentBottomNav'
import TeacherBottomNav from '../teacher/TeacherBottomNav'
import AppButton from '../ui/AppButton'
import { useAppModal } from '../AppModalProvider'

type HelpCenterRole = 'student' | 'teacher'

const categoryKeys: SupportTicketCategory[] = ['plataforma', 'cursos', 'preguntas', 'cuenta', 'otro']
const priorityKeys: SupportTicketPriority[] = ['low', 'medium', 'high']
const contactPreferenceKeys: SupportContactPreference[] = ['in_app', 'email', 'both']

export default function RoleHelpCenter({ role }: { role: HelpCenterRole }) {
  const router = useRouter()
  const params = useLocalSearchParams<{ ticket?: string }>()
  const { width } = useWindowDimensions()
  const { accentColor, colors } = useAppTheme()
  const { t, formatDate } = useI18n()
  const { showModal } = useAppModal()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [replying, setReplying] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
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
  const [attachment, setAttachment] = useState<PickedSupportAttachment | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyAttachment, setReplyAttachment] = useState<PickedSupportAttachment | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const isDesktop = width >= 1024

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
      // Keep the compatibility wrapper exported for older callers while this screen uses
      // the paginated server contract directly.
      void fetchOwnSupportTickets
      const [ticketPage, channels, deliveryHistory] = await Promise.all([
        fetchOwnSupportTicketsPage({ limit: 10, offset: 0 }),
        fetchSupportContactChannels(),
        fetchOwnSupportEmailHistory(10, 0),
      ])
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
  }, [openTicket, params.ticket, router, showAlert, t])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

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
        contactEmail: email || null,
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
      setPreferredChannel('in_app')
      setAttachment(null)
      void trackUsageEvent('support_ticket_created', { properties: { role, category, priority } })
      await load()
      await openTicket(result.ticket)
      showAlert(
        t('support.form.created'),
        result.attachmentError ? `${t('support.form.createdDetail')} ${result.attachmentError}` : t('support.form.createdDetail')
      )
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={accentColor} />
        <Text className="mt-3" style={{ color: colors.textSecondary }}>{t('support.loading')}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: isDesktop ? 28 : 16, paddingTop: isDesktop ? 22 : 18, paddingBottom: isDesktop ? 40 : MOBILE_BOTTOM_NAV_SPACER }}
        showsVerticalScrollIndicator={false}
      >
        <RolePageHeader
          role={role}
          icon="help-buoy-outline"
          isDesktop={isDesktop}
          title={t('support.title')}
          subtitle={t(role === 'teacher' ? 'support.subtitle.teacher' : 'support.subtitle.student')}
          notificationOnPress={() => router.push(`/${role === 'teacher' ? '(teacher)' : '(student)'}/notifications` as never)}
        />

        <View className={isDesktop ? 'flex-row gap-5' : 'gap-5'}>
          <View className="min-w-0 flex-[1.25] gap-5">
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
              />
              <ChoiceGroup
                label={t('support.form.priority')}
                values={priorityKeys}
                value={priority}
                onChange={setPriority}
                labelFor={(value) => t(`support.priority.${value}`)}
                accentColor={accentColor}
                colors={colors}
              />
              <ChoiceGroup
                label="Canal de respuesta preferido"
                values={contactPreferenceKeys}
                value={preferredChannel}
                onChange={setPreferredChannel}
                labelFor={(value) => value === 'in_app' ? 'OmniQuest' : value === 'email' ? 'Email' : 'Ambos'}
                accentColor={accentColor}
                colors={colors}
              />

              <AttachmentPicker attachment={attachment} colors={colors} onPick={() => void pickAttachment()} onRemove={() => setAttachment(null)} t={t} />
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void submitTicket()}
                className="mt-4 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl px-5 py-3"
                style={({ pressed }) => ({ backgroundColor: accentColor, opacity: submitting ? 0.55 : pressed ? 0.82 : 1 })}
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send-outline" size={18} color="#FFFFFF" />}
                <Text className="font-black text-white">{submitting ? t('support.form.sending') : t('support.form.submit')}</Text>
              </Pressable>
            </SupportPanel>

            <SupportPanel title={`${t('support.tickets.title')} (${ticketsTotal})`} icon="ticket-outline">
              <View className="mb-4 flex-row gap-3">
                <SummaryItem label={t('support.status.open')} value={summary.open} color="#F6A64A" colors={colors} />
                <SummaryItem label={t('support.status.in_progress')} value={summary.inProgress} color="#58B5FF" colors={colors} />
                <SummaryItem label={t('support.status.resolved')} value={summary.resolved} color="#34D399" colors={colors} />
              </View>
              <View className="gap-3">
                {tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} selected={ticket.id === selectedTicket?.id} onPress={() => void openTicket(ticket)} colors={colors} accentColor={accentColor} t={t} formatDate={formatDate} />
                ))}
                {tickets.length === 0 ? <Text className="py-6 text-center" style={{ color: colors.textMuted }}>{t('support.tickets.empty')}</Text> : null}
                {ticketsHasMore ? (
                  <AppButton
                    label="Cargar más tickets"
                    icon="chevron-down-outline"
                    variant="secondary"
                    loading={loadingMoreTickets}
                    onPress={() => void loadMoreTickets()}
                  />
                ) : null}
              </View>
            </SupportPanel>
          </View>

          <View className={isDesktop ? 'min-w-0 flex-1 gap-5' : 'gap-5'}>
            {selectedTicket ? (
              <SupportPanel title={`#${selectedTicket.id} · ${selectedTicket.subject}`} icon="chatbubbles-outline">
                <TicketSla ticket={selectedTicket} colors={colors} t={t} formatDate={formatDate} />
                {threadLoading ? <ActivityIndicator className="my-8" color={accentColor} /> : (
                  <View className="mt-4 gap-3">
                    {threadHasMore ? (
                      <AppButton
                        label="Cargar mensajes anteriores"
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
                    <Pressable
                      accessibilityRole="button"
                      disabled={replying || replyBody.trim().length < 2}
                      onPress={() => void submitReply()}
                      className="mt-3 min-h-[46px] flex-row items-center justify-center gap-2 rounded-xl px-4"
                      style={({ pressed }) => ({ backgroundColor: accentColor, opacity: replying || replyBody.trim().length < 2 ? 0.5 : pressed ? 0.82 : 1 })}
                    >
                      {replying ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send-outline" size={17} color="#FFFFFF" />}
                      <Text className="font-black text-white">{t('support.reply.send')}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </SupportPanel>
            ) : (
              <SupportPanel title={t('support.detail.title')} icon="chatbubble-ellipses-outline">
                <Text className="py-8 text-center" style={{ color: colors.textMuted }}>{t('support.detail.empty')}</Text>
              </SupportPanel>
            )}

            <SupportPanel title="Canales de contacto" icon="call-outline">
              <View className="gap-3">
                {contactChannels.map((channel) => (
                  <View key={channel.channel_key} className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
                    <Text className="font-black" style={{ color: colors.text }}>{channel.label}</Text>
                    {channel.description ? <Text className="mt-1 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{channel.description}</Text> : null}
                    {channel.value ? <Text selectable className="mt-2 text-[11px] font-bold" style={{ color: accentColor }}>{channel.value}</Text> : null}
                    {channel.channel_type !== 'in_app' && channel.value ? (
                      <AppButton
                        style={{ marginTop: 10 }}
                        accessibilityLabel={`Abrir canal ${channel.label}`}
                        label="Abrir canal"
                        icon={channel.channel_type === 'email' ? 'mail-outline' : 'open-outline'}
                        size="sm"
                        variant="secondary"
                        onPress={() => void openSupportContactChannel(channel).catch((error) => showAlert('No se pudo abrir el canal', getErrorMessage(error, 'Comprueba el enlace configurado.')))}
                      />
                    ) : null}
                  </View>
                ))}
                {contactChannels.length === 0 ? <Text style={{ color: colors.textMuted }}>El administrador todavía no ha publicado canales externos.</Text> : null}
              </View>
            </SupportPanel>

            <SupportPanel title="Historial de emails enviados" icon="mail-outline">
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
                {emailHistory.length === 0 ? <Text style={{ color: colors.textMuted }}>Aún no hay emails de soporte registrados.</Text> : null}
                {emailHistory.length < emailHistoryTotal ? (
                  <AppButton
                    label="Cargar más emails"
                    icon="chevron-down-outline"
                    variant="secondary"
                    loading={loadingMoreEmailHistory}
                    onPress={() => void loadMoreEmailHistory()}
                  />
                ) : null}
              </View>
            </SupportPanel>

            <SupportPanel title={t('support.faq.title')} icon="help-circle-outline">
              <View className="gap-2">
                {faqs.map((faq, index) => (
                  <Pressable key={faq.question} onPress={() => setOpenFaq(openFaq === index ? null : index)} className="rounded-xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="min-w-0 flex-1 font-black" style={{ color: colors.text }}>{faq.question}</Text>
                      <Ionicons name={openFaq === index ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textSecondary} />
                    </View>
                    {openFaq === index ? <Text className="mt-3 text-[12px] leading-5" style={{ color: colors.textSecondary }}>{faq.answer}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </SupportPanel>
          </View>
        </View>
      </ScrollView>
      {!isDesktop ? role === 'teacher' ? <TeacherBottomNav active="settings" /> : <StudentBottomNav active="settings" /> : null}
    </View>
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

function ChoiceGroup<T extends string>({ label, values, value, onChange, labelFor, accentColor, colors }: { label: string; values: T[]; value: T; onChange: (value: T) => void; labelFor: (value: T) => string; accentColor: string; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return <View className="mb-4"><Text className="mb-2 text-[12px] font-bold" style={{ color: colors.textSecondary }}>{label}</Text><View className="flex-row flex-wrap gap-2">{values.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: item === value }} onPress={() => onChange(item)} className="rounded-full border px-3 py-2" style={{ borderColor: item === value ? accentColor : colors.border, backgroundColor: item === value ? `${accentColor}22` : colors.surfaceRaised }}><Text className="text-[11px] font-black" style={{ color: item === value ? accentColor : colors.textSecondary }}>{labelFor(item)}</Text></Pressable>)}</View></View>
}

function AttachmentPicker({ attachment, onPick, onRemove, colors, t }: { attachment: PickedSupportAttachment | null; onPick: () => void; onRemove: () => void; colors: ReturnType<typeof useAppTheme>['colors']; t: ReturnType<typeof useI18n>['t'] }) {
  return <View className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>{attachment ? <View className="flex-row items-center gap-3"><Ionicons name="document-attach-outline" size={20} color={colors.textSecondary} /><View className="min-w-0 flex-1"><Text className="font-bold" numberOfLines={1} style={{ color: colors.text }}>{attachment.fileName}</Text><Text className="text-[11px]" style={{ color: colors.textMuted }}>{formatBytes(attachment.sizeBytes)}</Text></View><Pressable accessibilityLabel={t('support.attachment.remove')} onPress={onRemove}><Ionicons name="close-circle" size={22} color={colors.danger} /></Pressable></View> : <Pressable onPress={onPick} className="flex-row items-center justify-center gap-2 py-2"><Ionicons name="attach-outline" size={19} color={colors.textSecondary} /><Text className="font-bold" style={{ color: colors.textSecondary }}>{t('support.attachment.add')}</Text></Pressable>}</View>
}

function SummaryItem({ label, value, color, colors }: { label: string; value: number; color: string; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return <View className="min-w-0 flex-1 rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.surfaceRaised }}><Text className="text-[20px] font-black" style={{ color }}>{value}</Text><Text className="mt-1 text-[10px] font-bold" numberOfLines={1} style={{ color: colors.textMuted }}>{label}</Text></View>
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
