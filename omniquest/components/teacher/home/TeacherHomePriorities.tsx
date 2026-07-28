import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { withAlpha } from '../../../lib/color'

type IconName = keyof typeof Ionicons.glyphMap

export type TeacherAttentionItem = {
  id: string
  icon: IconName
  color: string
  title: string
  detail: string
  actionLabel: string
}

export function TeacherTodayFocus({
  primaryLabel,
  teacherAlias,
  onPrimary,
}: {
  primaryLabel: string
  teacherAlias: string
  onPrimary: () => void
}) {
  return (
    <LinearGradient
      colors={['#111E54', '#101946', '#211044']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 22, borderWidth: 1, borderColor: '#263B72', overflow: 'hidden' }}
    >
      <View className="relative gap-5 p-5 md:flex-row md:items-center md:justify-between">
        <View className="absolute -right-8 top-4 h-28 w-44 rounded-3xl bg-surface-selected" style={{ transform: [{ rotate: '-22deg' }] }} />
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-black uppercase tracking-[1.5px] text-brand-teacher">Tu prioridad de hoy</Text>
          <Text className="mt-2 text-[28px] font-black leading-9 text-white" numberOfLines={2}>Hola, {teacherAlias}. Empieza por lo pendiente.</Text>
          <Text className="mt-2 max-w-[620px] text-[15px] leading-6 text-text-secondary">
            Atiende primero a los alumnos bloqueados y a las respuestas que esperan revisión.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onPrimary}
          className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-student px-5"
          style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}
        >
          <Ionicons name={primaryLabel.startsWith('Revisar') ? 'checkmark-done-outline' : 'add-circle-outline'} size={21} color="#FFFFFF" />
          <Text className="font-black text-white">{primaryLabel}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </LinearGradient>
  )
}

export function TeacherPriorityOverview({
  attentionItems,
  classroomsCount,
  coursesCount,
  isDesktop,
  openReviewCount,
  onOpenAttention,
  onOpenClasses,
  onOpenReviews,
  onOpenStudents,
}: {
  attentionItems: TeacherAttentionItem[]
  classroomsCount: number
  coursesCount: number
  isDesktop: boolean
  openReviewCount: number
  onOpenAttention: (item: TeacherAttentionItem) => void
  onOpenClasses: () => void
  onOpenReviews: () => void
  onOpenStudents: () => void
}) {
  return (
    <View className={`${isDesktop ? 'flex-row' : ''} mt-5 gap-4`}>
      <PrioritySection
        accent="#EC4899"
        index="1"
        title="Alumnos que necesitan atención"
        subtitle="Inactividad y cursos sin alumnos"
        onViewAll={onOpenStudents}
      >
        {attentionItems.length > 0 ? attentionItems.slice(0, 2).map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onOpenAttention(item)}
            className="flex-row items-center gap-3 rounded-xl border border-border-default bg-surface-raised p-3"
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(item.color, '28') }}>
              <Ionicons name={item.icon} size={21} color={item.color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-black text-white" numberOfLines={1}>{item.title}</Text>
              <Text className="mt-1 text-[12px] text-text-secondary" numberOfLines={2}>{item.detail}</Text>
            </View>
            <Text className="text-[12px] font-black" style={{ color: item.color }}>{item.actionLabel}</Text>
          </Pressable>
        )) : (
          <EmptyPriority icon="checkmark-circle-outline" text="No hay alumnos bloqueados detectados." />
        )}
      </PrioritySection>

      <PrioritySection
        accent="#A78BFA"
        index="2"
        title="Preguntas abiertas por revisar"
        subtitle="Respuestas que esperan tu criterio"
        onViewAll={onOpenReviews}
      >
        <Pressable onPress={onOpenReviews} className="min-h-[78px] flex-row items-center gap-4 rounded-xl border border-border-active bg-surface-disabled p-4">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-selected">
            <Text className="text-[22px] font-black text-brand-teacher">{openReviewCount}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-white">{openReviewCount > 0 ? 'Revisión pendiente' : 'Cola al día'}</Text>
            <Text className="mt-1 text-[12px] text-text-secondary">
              {openReviewCount > 0 ? 'Abre la cola y corrige las respuestas.' : 'No hay respuestas abiertas pendientes.'}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={19} color="#C4B5FD" />
        </Pressable>
      </PrioritySection>

      <PrioritySection
        accent="#38BDF8"
        index="3"
        title="Cursos y clases activos"
        subtitle="Acceso directo a la gestión"
        onViewAll={onOpenClasses}
      >
        <Pressable onPress={onOpenClasses} className="min-h-[78px] flex-row items-center gap-4 rounded-xl border border-border-default bg-surface-raised p-4">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-semantic-surface-info">
            <Ionicons name="school-outline" size={23} color="#38BDF8" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-white">{coursesCount} cursos · {classroomsCount} clases</Text>
            <Text className="mt-1 text-[12px] text-text-secondary">Abre contenidos, alumnos y resultados.</Text>
          </View>
          <Ionicons name="arrow-forward" size={19} color="#7DD3FC" />
        </Pressable>
      </PrioritySection>
    </View>
  )
}

function PrioritySection({ accent, children, index, onViewAll, subtitle, title }: {
  accent: string
  children: React.ReactNode
  index: string
  onViewAll: () => void
  subtitle: string
  title: string
}) {
  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-border-default bg-surface-default p-4">
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(accent, '2F') }}>
          <Text className="font-black" style={{ color: accent }}>{index}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-white" numberOfLines={2}>{title}</Text>
          <Text className="mt-1 text-[11px] text-text-muted">{subtitle}</Text>
        </View>
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Ionicons name="arrow-forward" size={18} color={accent} />
        </Pressable>
      </View>
      <View className="gap-3">{children}</View>
    </View>
  )
}

function EmptyPriority({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="min-h-[78px] flex-row items-center gap-3 rounded-xl border border-dashed border-border-default bg-surface-default p-4">
      <Ionicons name={icon} size={23} color="#34D399" />
      <Text className="min-w-0 flex-1 text-[12px] text-text-secondary">{text}</Text>
    </View>
  )
}
