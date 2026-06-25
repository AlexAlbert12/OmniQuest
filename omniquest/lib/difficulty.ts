export type DifficultyLevel = 1 | 2 | 3

export const difficultyOptions: {
  value: DifficultyLevel
  label: string
  shortLabel: string
  color: string
}[] = [
  { value: 1, label: 'Fácil', shortLabel: 'Fácil', color: '#43D991' },
  { value: 2, label: 'Medio', shortLabel: 'Medio', color: '#F6A64A' },
  { value: 3, label: 'Difícil', shortLabel: 'Difícil', color: '#FB7185' },
]

export function normalizeDifficulty(value: unknown): DifficultyLevel | null {
  const numeric = Number(Array.isArray(value) ? value[0] : value)
  return numeric === 1 || numeric === 2 || numeric === 3 ? numeric : null
}

export function getDifficultyMeta(value: unknown) {
  const normalized = normalizeDifficulty(value) || 1
  return difficultyOptions.find((option) => option.value === normalized) || difficultyOptions[0]
}
