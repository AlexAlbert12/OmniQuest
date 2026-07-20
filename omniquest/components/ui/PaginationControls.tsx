import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/appTheme'
import { useI18n } from '../../lib/i18n'
import { withAlpha } from '../../lib/color'

type PaginationControlsProps = {
  page: number
  pageSize: number
  total: number
  onPrevious: () => void
  onNext: () => void
  compact?: boolean
}

export default function PaginationControls({
  page,
  pageSize,
  total,
  onPrevious,
  onNext,
  compact = false,
}: PaginationControlsProps) {
  const { accentColor, colors } = useAppTheme()
  const { t } = useI18n()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page + 1, pageCount)
  const hasPrevious = page > 0
  const hasNext = (page + 1) * pageSize < total

  if (total <= pageSize && page === 0) return null

  return (
    <View
      accessible
      accessibilityLabel={t('pagination.page', { page: currentPage, pages: pageCount })}
      style={[styles.container, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.previous')}
        accessibilityState={{ disabled: !hasPrevious }}
        disabled={!hasPrevious}
        hitSlop={8}
        onPress={onPrevious}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compactButton,
          {
            borderColor: hasPrevious ? withAlpha(accentColor, '70') : colors.border,
            backgroundColor: hasPrevious ? withAlpha(accentColor, '18') : colors.surfaceMuted,
            opacity: !hasPrevious ? 0.45 : pressed ? 0.72 : 1,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={19} color={hasPrevious ? accentColor : colors.textMuted} />
        {!compact ? <Text style={[styles.buttonLabel, { color: hasPrevious ? accentColor : colors.textMuted }]}>{t('common.previous')}</Text> : null}
      </Pressable>

      <View style={styles.summary}>
        <Text style={[styles.pageText, { color: colors.text }]}>
          {t('pagination.page', { page: currentPage, pages: pageCount })}
        </Text>
        <Text style={[styles.totalText, { color: colors.textMuted }]}>
          {t('pagination.range', { from: total === 0 ? 0 : page * pageSize + 1, to: Math.min((page + 1) * pageSize, total), total })}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.next')}
        accessibilityState={{ disabled: !hasNext }}
        disabled={!hasNext}
        hitSlop={8}
        onPress={onNext}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compactButton,
          {
            borderColor: hasNext ? withAlpha(accentColor, '70') : colors.border,
            backgroundColor: hasNext ? withAlpha(accentColor, '18') : colors.surfaceMuted,
            opacity: !hasNext ? 0.45 : pressed ? 0.72 : 1,
          },
        ]}
      >
        {!compact ? <Text style={[styles.buttonLabel, { color: hasNext ? accentColor : colors.textMuted }]}>{t('common.next')}</Text> : null}
        <Ionicons name="chevron-forward" size={19} color={hasNext ? accentColor : colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minHeight: 58,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    minHeight: 42,
    minWidth: 104,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compactButton: {
    minWidth: 44,
    width: 44,
    paddingHorizontal: 0,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  summary: {
    minWidth: 76,
    alignItems: 'center',
  },
  pageText: {
    fontSize: 12,
    fontWeight: '900',
  },
  totalText: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
  },
})
