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
        <View className="absolute -right-8 top-4 h-28 w-44 rounded-3xl bg-[#A855F7]/15" style={{ transform: [{ rotate: '-22deg' }] }} />
        <View className="min-w-0 flex-1">
          <Text className="text-[12px] font-black uppercase tracking-[1.5px] text-[#B9A7FF]">Tu prioridad de hoy</Text>
          <Text className="mt-2 text-[28px] font-black leading-9 text-white" numberOfLines={2}>Hola, {teacherAlias}. Empieza por lo pendiente.</Text>
          <Text className="mt-2 max-w-[620px] text-[15px] leading-6 text-[#D7E2F4]">
            Atiende primero a los alumnos bloqueados y a las respuestas que esperan revisión.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onPrimary}
          className="h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#6D4AFF] px-5"
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
            className="flex-row items-center gap-3 rounded-xl border border-[#20375E] bg-[#0A1D3B] p-3"
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(item.color, '28') }}>
              <Ionicons name={item.icon} size={21} color={item.color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-black text-white" numberOfLines={1}>{item.title}</Text>
              <Text className="mt-1 text-[12px] text-[#AFC2DB]" numberOfLines={2}>{item.detail}</Text>
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
        <Pressable onPress={onOpenReviews} className="min-h-[78px] flex-row items-center gap-4 rounded-xl border border-[#4C3B78] bg-[#17163A] p-4">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#33255D]">
            <Text className="text-[22px] font-black text-[#D8B4FE]">{openReviewCount}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-white">{openReviewCount > 0 ? 'Revisión pendiente' : 'Cola al día'}</Text>
            <Text className="mt-1 text-[12px] text-[#AFC2DB]">
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
        <Pressable onPress={onOpenClasses} className="min-h-[78px] flex-row items-center gap-4 rounded-xl border border-[#1E4D6B] bg-[#0A2037] p-4">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#12314B]">
            <Ionicons name="school-outline" size={23} color="#38BDF8" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black text-white">{coursesCount} cursos · {classroomsCount} clases</Text>
            <Text className="mt-1 text-[12px] text-[#AFC2DB]">Abre contenidos, alumnos y resultados.</Text>
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
    <View className="min-w-0 flex-1 rounded-2xl border border-[#183052] bg-[#07162D] p-4">
      <View className="mb-4 flex-row items-start gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(accent, '2F') }}>
          <Text className="font-black" style={{ color: accent }}>{index}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black text-white" numberOfLines={2}>{title}</Text>
          <Text className="mt-1 text-[11px] text-[#8FA7C7]">{subtitle}</Text>
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
    <View className="min-h-[78px] flex-row items-center gap-3 rounded-xl border border-dashed border-[#29466F] bg-[#09162C] p-4">
      <Ionicons name={icon} size={23} color="#34D399" />
      <Text className="min-w-0 flex-1 text-[12px] text-[#AFC2DB]">{text}</Text>
    </View>
  )
}
