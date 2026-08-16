import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { useState } from 'react'
import type { AppLocale } from '../../lib/i18n'
import { useI18n } from '../../lib/i18n'
import { createShadowStyle } from '../../lib/platformShadow'

type InfoIcon = keyof typeof Ionicons.glyphMap

type LandingCopy = {
  about: {
    eyebrow: string
    title: string
    description: string
    points: { icon: InfoIcon; title: string; description: string }[]
  }
  how: {
    eyebrow: string
    title: string
    description: string
    steps: { icon: InfoIcon; title: string; description: string }[]
  }
  faq: {
    eyebrow: string
    title: string
    description: string
    items: { question: string; answer: string }[]
    show: string
    hide: string
  }
}

const copy: Record<AppLocale, LandingCopy> = {
  'es-ES': {
    about: {
      eyebrow: 'QUÉ ES OMNIQUEST',
      title: 'Aprender, practicar y mejorar en un mismo espacio',
      description: 'OmniQuest es una plataforma educativa gamificada que conecta al alumnado con sus clases y ofrece al profesorado herramientas para crear contenido, acompañar el aprendizaje y consultar el progreso.',
      points: [
        { icon: 'game-controller-outline', title: 'Aprendizaje activo', description: 'Preguntas interactivas, experiencia, insignias y feedback para practicar de forma más motivadora.' },
        { icon: 'school-outline', title: 'Control docente', description: 'Cursos, clases, temas y preguntas organizados desde un panel diseñado para el seguimiento diario.' },
        { icon: 'analytics-outline', title: 'Progreso visible', description: 'Historial, estadísticas, revisiones y ranking ayudan a identificar avances y puntos de refuerzo.' },
      ],
    },
    how: {
      eyebrow: 'CÓMO FUNCIONA',
      title: 'De la clase a la práctica en cuatro pasos',
      description: 'El flujo está pensado para que cada rol llegue rápido a lo que necesita, sin perder el contexto de la clase.',
      steps: [
        { icon: 'log-in-outline', title: '1. Accede a OmniQuest', description: 'El alumnado puede registrarse; profesores y administradores acceden mediante cuentas autorizadas.' },
        { icon: 'people-outline', title: '2. Conecta con la clase', description: 'El profesor organiza cursos y clases. El alumno se incorpora mediante el código compartido por su docente.' },
        { icon: 'extension-puzzle-outline', title: '3. Practica y recibe feedback', description: 'Los temas reúnen distintos tipos de preguntas, pistas y explicaciones para reforzar el aprendizaje.' },
        { icon: 'trending-up-outline', title: '4. Revisa la evolución', description: 'Alumno y profesor consultan progreso, actividad y revisiones para saber qué funciona y qué necesita atención.' },
      ],
    },
    faq: {
      eyebrow: 'PREGUNTAS FRECUENTES',
      title: 'Lo esencial antes de empezar',
      description: 'Respuestas rápidas sobre acceso, modo invitado y conservación del progreso.',
      items: [
        { question: '¿Quién puede crear una cuenta?', answer: 'El alumnado puede registrarse de forma pública y verificar su correo. Las cuentas de profesor y administrador se crean mediante invitación o alta administrativa.' },
        { question: '¿Puedo probar OmniQuest sin registrarme?', answer: 'Sí. El modo invitado permite explorar la experiencia, pero su progreso es temporal y la cuenta anónima puede limpiarse automáticamente.' },
        { question: '¿Se conserva mi progreso?', answer: 'En una cuenta registrada, la actividad y el progreso quedan asociados al perfil. El modo invitado está pensado únicamente para una exploración temporal.' },
      ],
      show: 'Mostrar respuesta',
      hide: 'Ocultar respuesta',
    },
  },
  'en-US': {
    about: {
      eyebrow: 'WHAT IS OMNIQUEST',
      title: 'Learn, practise and improve in one place',
      description: 'OmniQuest is a gamified learning platform that connects students with their classes and gives teachers tools to create content, support learning and review progress.',
      points: [
        { icon: 'game-controller-outline', title: 'Active learning', description: 'Interactive questions, experience, badges and feedback make practice more engaging.' },
        { icon: 'school-outline', title: 'Teacher control', description: 'Courses, classes, topics and questions are organised from a workspace built for day-to-day follow-up.' },
        { icon: 'analytics-outline', title: 'Visible progress', description: 'History, analytics, reviews and ranking help surface progress and areas that need reinforcement.' },
      ],
    },
    how: {
      eyebrow: 'HOW IT WORKS',
      title: 'From class to practice in four steps',
      description: 'The flow helps each role reach what they need quickly while keeping the class context visible.',
      steps: [
        { icon: 'log-in-outline', title: '1. Access OmniQuest', description: 'Students can register, while teacher and administrator accounts are created through authorised access.' },
        { icon: 'people-outline', title: '2. Connect with the class', description: 'Teachers organise courses and classes. Students join using the code shared by their teacher.' },
        { icon: 'extension-puzzle-outline', title: '3. Practise and get feedback', description: 'Topics combine different question types, hints and explanations to reinforce learning.' },
        { icon: 'trending-up-outline', title: '4. Review progress', description: 'Students and teachers review progress, activity and feedback to understand what is working and what needs attention.' },
      ],
    },
    faq: {
      eyebrow: 'FREQUENTLY ASKED QUESTIONS',
      title: 'The essentials before you start',
      description: 'Quick answers about access, guest mode and keeping your progress.',
      items: [
        { question: 'Who can create an account?', answer: 'Students can register publicly and verify their email. Teacher and administrator accounts are created through invitation or authorised administration.' },
        { question: 'Can I try OmniQuest without registering?', answer: 'Yes. Guest mode lets you explore the experience, but its progress is temporary and the anonymous account may be cleaned automatically.' },
        { question: 'Is my progress kept?', answer: 'With a registered account, activity and progress remain linked to your profile. Guest mode is intended only for temporary exploration.' },
      ],
      show: 'Show answer',
      hide: 'Hide answer',
    },
  },
}

export default function LandingInfoSections({ isDesktop }: { isDesktop: boolean }) {
  const { locale } = useI18n()
  const content = copy[locale]

  return (
    <View className="mt-12 w-full" style={{ gap: isDesktop ? 32 : 24 }}>
      <AboutSection content={content.about} isDesktop={isDesktop} />
      <HowItWorksSection content={content.how} isDesktop={isDesktop} />
      <FaqSection content={content.faq} isDesktop={isDesktop} />
    </View>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <View className="items-center">
      <Text maxFontSizeMultiplier={2} className="text-center text-[12px] font-black text-semantic-info" style={{ letterSpacing: 2.4 }}>{eyebrow}</Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={2} className="mt-3 max-w-[760px] text-center text-[28px] font-black leading-9 text-white">{title}</Text>
      <Text maxFontSizeMultiplier={2} className="mt-3 max-w-[760px] text-center text-[15px] leading-6 text-text-secondary">{description}</Text>
    </View>
  )
}

function AboutSection({ content, isDesktop }: { content: LandingCopy['about']; isDesktop: boolean }) {
  return (
    <View accessibilityLabel={content.eyebrow} className="rounded-[30px] border border-border-default bg-surface-default px-5 py-7" style={{ ...createShadowStyle({ color: '#38BDF8', opacity: 0.08, radius: 24, offsetY: 12, web: '0 18px 34px rgba(56, 189, 248, 0.10)' }) }}>
      <SectionHeading eyebrow={content.eyebrow} title={content.title} description={content.description} />
      <View className="mt-7" style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
        {content.points.map((point) => (
          <View key={point.title} className="flex-1 rounded-3xl border border-border-default bg-surface-raised px-5 py-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-semantic-surface-info"><Ionicons name={point.icon} size={24} color="#7DD3FC" /></View>
            <Text maxFontSizeMultiplier={2} className="mt-4 text-[17px] font-black text-text-primary">{point.title}</Text>
            <Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-6 text-text-secondary">{point.description}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function HowItWorksSection({ content, isDesktop }: { content: LandingCopy['how']; isDesktop: boolean }) {
  return (
    <View accessibilityLabel={content.eyebrow} className="rounded-[30px] border border-border-default bg-surface-default px-5 py-7">
      <SectionHeading eyebrow={content.eyebrow} title={content.title} description={content.description} />
      <View className="mt-7" style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 14 }}>
        {content.steps.map((step) => (
          <View key={step.title} className="flex-1 rounded-3xl border border-border-default bg-surface-raised px-5 py-5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-semantic-surface-success"><Ionicons name={step.icon} size={24} color="#5EEAD4" /></View>
            <Text maxFontSizeMultiplier={2} className="mt-4 text-[16px] font-black leading-6 text-text-primary">{step.title}</Text>
            <Text maxFontSizeMultiplier={2} className="mt-2 text-[13px] leading-6 text-text-secondary">{step.description}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function FaqSection({ content, isDesktop }: { content: LandingCopy['faq']; isDesktop: boolean }) {
  return (
    <View accessibilityLabel={content.eyebrow} className="rounded-[30px] border border-border-default bg-surface-default px-5 py-7">
      <SectionHeading eyebrow={content.eyebrow} title={content.title} description={content.description} />
      <View className="mt-7" style={{ gap: 12, alignSelf: 'center', maxWidth: isDesktop ? 860 : undefined, width: '100%' }}>
        {content.items.map((item) => <FaqItem key={item.question} item={item} showLabel={content.show} hideLabel={content.hide} />)}
      </View>
    </View>
  )
}

function FaqItem({ item, showLabel, hideLabel }: { item: LandingCopy['faq']['items'][number]; showLabel: string; hideLabel: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.question}
      accessibilityHint={expanded ? hideLabel : showLabel}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((current) => !current)}
      className="rounded-3xl border border-border-default bg-surface-raised px-5 py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <View className="flex-row items-center gap-4">
        <View className="min-w-0 flex-1">
          <Text maxFontSizeMultiplier={2} className="text-[15px] font-black leading-6 text-text-primary">{item.question}</Text>
          {expanded ? <Text maxFontSizeMultiplier={2} className="mt-3 text-[14px] leading-6 text-text-secondary">{item.answer}</Text> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color="#8BA6D3" />
      </View>
    </Pressable>
  )
}
