import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AppStatusBanner from '../../ui/AppStatusBanner'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'
import { formatRelativeDate } from '../../../lib/dateFormat'
import type { TeacherRecentQuestion, TeacherRecentSubject } from '../../../hooks/teacher/useTeacherProfile'

type ResourceState<T> = { items: T[]; loading: boolean; loaded: boolean; error: string | null; total: number }

type Props = {
  subjects: ResourceState<TeacherRecentSubject>
  questions: ResourceState<TeacherRecentQuestion>
  onLoadSubjects: () => void
  onLoadQuestions: () => void
  onOpenSubject: (id: number) => void
  onOpenQuestion: (question: TeacherRecentQuestion) => void
  onViewCourses: () => void
}

export default function TeacherProfileLazyResources(props: Props) {
  return (
    <View style={{ marginTop: 18, gap: 14 }}>
      <LazyPanel
        title="Cursos recientes"
        description="Se cargan solo cuando abres esta sección."
        icon="book-outline"
        state={props.subjects}
        onLoad={props.onLoadSubjects}
        onViewAll={props.onViewCourses}
        renderItem={(subject) => (
          <ResourceRow
            key={subject.id}
            iconText={subject.icon || '📘'}
            title={subject.name}
            description={`${subject.studentCount} alumnos · ${subject.classroomCount} clases · ${formatRelativeDate(subject.createdAt)}`}
            onPress={() => props.onOpenSubject(subject.id)}
          />
        )}
      />
      <LazyPanel
        title="Preguntas recientes"
        description="La consulta se ejecuta de forma independiente al perfil y a los cursos."
        icon="help-circle-outline"
        state={props.questions}
        onLoad={props.onLoadQuestions}
        renderItem={(question) => (
          <ResourceRow
            key={question.id}
            icon="help-circle-outline"
            title={question.text}
            description={`${question.subjectName} · ${formatRelativeDate(question.createdAt)}`}
            onPress={() => props.onOpenQuestion(question)}
          />
        )}
      />
    </View>
  )
}

function LazyPanel<T extends { id: number }>({
  title,
  description,
  icon,
  state,
  onLoad,
  onViewAll,
  renderItem,
}: {
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  state: ResourceState<T>
  onLoad: () => void
  onViewAll?: () => void
  renderItem: (item: T) => React.ReactNode
}) {
  const { tokens } = useAppTheme()
  return (
    <View style={{ borderWidth: 1, borderColor: tokens.border.default, backgroundColor: tokens.surface.default, borderRadius: 20, padding: 17 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name={icon} size={21} color={tokens.brand.teacher} />
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ color: tokens.text.primary, fontSize: 16, fontWeight: '900' }}>{title}</Text>
          <Text style={{ marginTop: 2, color: tokens.text.muted, fontSize: 11, lineHeight: 16 }}>{description}</Text>
        </View>
        {state.loaded && onViewAll ? <AppButton label="Ver todo" size="sm" variant="ghost" onPress={onViewAll} /> : null}
      </View>

      {!state.loaded ? (
        <AppButton label={`Cargar ${title.toLowerCase()}`} icon="download-outline" variant="secondary" fullWidth style={{ marginTop: 14 }} onPress={onLoad} />
      ) : state.loading ? (
        <View style={{ minHeight: 86, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={tokens.brand.teacher} /></View>
      ) : state.error ? (
        <AppStatusBanner style={{ marginTop: 14 }} variant="warning" title="No se pudo cargar" message={state.error} actionLabel="Reintentar" onAction={onLoad} />
      ) : state.items.length === 0 ? (
        <Text style={{ marginTop: 14, color: tokens.text.muted, fontSize: 12 }}>Todavía no hay elementos recientes.</Text>
      ) : (
        <View style={{ marginTop: 14, gap: 9 }}>{state.items.map(renderItem)}</View>
      )}
    </View>
  )
}

function ResourceRow({ icon, iconText, title, description, onPress }: { icon?: keyof typeof Ionicons.glyphMap; iconText?: string; title: string; description: string; onPress: () => void }) {
  const { tokens } = useAppTheme()
  return (
    <AppPressable
      accessibilityLabel={title}
      accessibilityHint="Abre el recurso docente"
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, backgroundColor: tokens.surface.raised, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.surface.interactive }}>
        {iconText ? <Text style={{ fontSize: 20 }}>{iconText}</Text> : <Ionicons name={icon || 'document-outline'} size={20} color={tokens.brand.teacher} />}
      </View>
      <View style={{ minWidth: 0, flex: 1 }}>
        <Text numberOfLines={2} maxFontSizeMultiplier={2} style={{ color: tokens.text.primary, fontSize: 13, lineHeight: 18, fontWeight: '900' }}>{title}</Text>
        <Text numberOfLines={2} maxFontSizeMultiplier={2} style={{ marginTop: 2, color: tokens.text.muted, fontSize: 11, lineHeight: 16 }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={tokens.text.muted} />
    </AppPressable>
  )
}
