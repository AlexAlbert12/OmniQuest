import { Ionicons } from '@expo/vector-icons'

export type AppRole = 'student' | 'teacher' | 'admin'
export type SemanticColorKey = 'success' | 'warning' | 'danger' | 'info'
export type GamificationColorKey = 'xp' | 'streak' | 'badge'
export type RankingTierKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
export type SemanticIconKey =
  | 'xp'
  | 'streak'
  | 'achievement'
  | 'success'
  | 'attention'
  | 'critical'
  | 'course'
  | 'student'
  | 'audit'

export type DesignColorTokens = {
  background: {
    primary: string
    secondary: string
    overlay: string
  }
  surface: {
    default: string
    raised: string
    interactive: string
    selected: string
    disabled: string
  }
  border: {
    default: string
    subtle: string
    active: string
  }
  text: {
    primary: string
    secondary: string
    muted: string
    inverse: string
    onAccent: string
    disabled: string
  }
  brand: Record<AppRole, string>
  semantic: Record<SemanticColorKey, string>
  semanticSurface: Record<SemanticColorKey, string>
  gamification: Record<GamificationColorKey, string> & {
    rank: Record<RankingTierKey, string>
    performanceLow: string
  }
}

export type SemanticIconDefinition = {
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
  colorKey: SemanticColorKey | GamificationColorKey | 'teacher' | 'student' | 'admin'
}

const BRAND_COLORS: Record<AppRole, string> = {
  student: '#09acf4',
  teacher: '#09acf4',
  admin: '#A78BFA',
}

const DARK_BASE = {
  background: {
    primary: '#061126',
    secondary: '#020B1B',
    overlay: 'rgba(2, 6, 23, 0.82)',
  },
  surface: {
    default: '#07162C',
    raised: '#0D1D3B',
    interactive: '#10213E',
    selected: '#202E6B',
    disabled: '#111D32',
  },
  border: {
    default: '#1A3155',
    subtle: '#13284A',
    active: '#3A5F91',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#C9D7EA',
    muted: '#8FA7C7',
    inverse: '#061126',
    onAccent: '#FFFFFF',
    disabled: '#60799C',
  },
  semantic: {
    success: '#34D399',
    warning: '#F59E0B',
    danger: '#FB7185',
    info: '#38BDF8',
  },
  semanticSurface: {
    success: '#0D2F29',
    warning: '#332A10',
    danger: '#351420',
    info: '#0D2848',
  },
  gamification: {
    xp: '#FBBF24',
    streak: '#F97316',
    badge: '#F6C453',
    performanceLow: '#F9707D',
    rank: {
      bronze: '#CD7F32',
      silver: '#CBD5E1',
      gold: '#FBBF24',
      platinum: '#67E8F9',
      diamond: '#A78BFA',
    },
  },
} as const

const LIGHT_BASE = {
  background: {
    primary: '#F4F7FF',
    secondary: '#EAF0FC',
    overlay: 'rgba(15, 23, 42, 0.46)',
  },
  surface: {
    default: '#FFFFFF',
    raised: '#F8FAFF',
    interactive: '#E7EEFA',
    selected: '#E8E4FF',
    disabled: '#EDF1F7',
  },
  border: {
    default: '#CCD8EA',
    subtle: '#DFE7F2',
    active: '#7E96B8',
  },
  text: {
    primary: '#13233D',
    secondary: '#334A68',
    muted: '#657B98',
    inverse: '#FFFFFF',
    onAccent: '#FFFFFF',
    disabled: '#8797AC',
  },
  semantic: {
    success: '#178A5D',
    warning: '#A86600',
    danger: '#C93855',
    info: '#147CA8',
  },
  semanticSurface: {
    success: '#E5F7EF',
    warning: '#FFF4D6',
    danger: '#FDE8ED',
    info: '#E5F4FA',
  },
  gamification: {
    xp: '#A86600',
    streak: '#C4510A',
    badge: '#9A6B00',
    performanceLow: '#C7465C',
    rank: {
      bronze: '#9A5B24',
      silver: '#64748B',
      gold: '#A86600',
      platinum: '#147CA8',
      diamond: '#6D4DDB',
    },
  },
} as const

/**
 * Canonical semantic palette for OmniQuest. Components consume purpose-based
 * names so a physical colour can change without changing application code.
 */
export function createDesignColorTokens(
  theme: 'dark' | 'light',
  accentColor?: string,
): DesignColorTokens {
  const base = theme === 'dark' ? DARK_BASE : LIGHT_BASE

  return {
    background: { ...base.background },
    surface: { ...base.surface },
    border: {
      ...base.border,
      active: accentColor || base.border.active,
    },
    text: { ...base.text },
    brand: { ...BRAND_COLORS },
    semantic: { ...base.semantic },
    semanticSurface: { ...base.semanticSurface },
    gamification: { ...base.gamification },
  }
}

export const semanticIcons: Record<SemanticIconKey, SemanticIconDefinition> = {
  xp: { icon: 'flash-outline', activeIcon: 'flash', colorKey: 'xp' },
  streak: { icon: 'flame-outline', activeIcon: 'flame', colorKey: 'streak' },
  achievement: { icon: 'trophy-outline', activeIcon: 'trophy', colorKey: 'badge' },
  success: { icon: 'checkmark-circle-outline', activeIcon: 'checkmark-circle', colorKey: 'success' },
  attention: { icon: 'warning-outline', activeIcon: 'warning', colorKey: 'warning' },
  critical: { icon: 'alert-circle-outline', activeIcon: 'alert-circle', colorKey: 'danger' },
  course: { icon: 'book-outline', activeIcon: 'book', colorKey: 'teacher' },
  student: { icon: 'people-outline', activeIcon: 'people', colorKey: 'student' },
  audit: { icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', colorKey: 'admin' },
}

export function getSemanticColor(
  tokens: DesignColorTokens,
  key: SemanticIconDefinition['colorKey'],
) {
  if (key === 'student' || key === 'teacher' || key === 'admin') {
    return tokens.brand[key]
  }
  if (key === 'xp' || key === 'streak' || key === 'badge') {
    return tokens.gamification[key]
  }
  return tokens.semantic[key]
}
