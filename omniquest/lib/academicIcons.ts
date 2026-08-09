import { Ionicons } from '@expo/vector-icons'

export type AcademicIconName = keyof typeof Ionicons.glyphMap

type AcademicIconChoice = { icon: AcademicIconName; label: string }

export const COURSE_ICON_CHOICES: AcademicIconChoice[] = [
  { icon: 'book-outline', label: 'Libro' },
  { icon: 'school-outline', label: 'Educación' },
  { icon: 'calculator-outline', label: 'Matemáticas' },
  { icon: 'language-outline', label: 'Idiomas' },
  { icon: 'flask-outline', label: 'Ciencias' },
  { icon: 'color-palette-outline', label: 'Arte' },
  { icon: 'earth-outline', label: 'Humanidades' },
  { icon: 'hardware-chip-outline', label: 'Tecnología' },
]

export const TOPIC_ICON_CHOICES: AcademicIconChoice[] = [
  { icon: 'book-outline', label: 'Tema' },
  { icon: 'bulb-outline', label: 'Ideas' },
  { icon: 'calculator-outline', label: 'Cálculo' },
  { icon: 'flask-outline', label: 'Experimento' },
  { icon: 'earth-outline', label: 'Mundo' },
  { icon: 'create-outline', label: 'Escritura' },
  { icon: 'locate-outline', label: 'Objetivo' },
  { icon: 'flash-outline', label: 'Reto' },
]

const LEGACY_ICON_MAP: Record<string, AcademicIconName> = {
  '📚': 'book-outline', '🎓': 'school-outline', '🧮': 'calculator-outline', '🌐': 'language-outline', '🧪': 'flask-outline', '🎨': 'color-palette-outline', '🔤': 'language-outline', '🧲': 'hardware-chip-outline',
  '📘': 'book-outline', '🧠': 'bulb-outline', '🔬': 'flask-outline', '🌍': 'earth-outline', '✍️': 'create-outline', '🎯': 'locate-outline', '⚡': 'flash-outline',
}

export function normalizeAcademicIcon(icon: string | null | undefined, fallback: AcademicIconName = 'book-outline'): AcademicIconName {
  if (!icon) return fallback
  if (LEGACY_ICON_MAP[icon]) return LEGACY_ICON_MAP[icon]
  return icon in Ionicons.glyphMap ? icon as AcademicIconName : fallback
}
