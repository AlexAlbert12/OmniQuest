import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { trackUsageEvent } from '../../lib/analytics'
import { useAppTheme } from '../../lib/appTheme'

type SearchRole = 'admin' | 'teacher'
type IconName = keyof typeof Ionicons.glyphMap

type SearchResult = {
  entity_type: 'profile' | 'subject' | 'classroom'
  entity_id: string
  title: string
  subtitle: string | null
  role_id: string | null
  subject_id: number | null
  classroom_id: number | null
  relevance: number
}

type GlobalSearchButtonProps = {
  role: SearchRole
  compact?: boolean
}

export default function GlobalSearchButton({ role, compact = false }: GlobalSearchButtonProps) {
  const router = useRouter()
  const { colors, accentColor } = useAppTheme()
  const inputRef = useRef<TextInput>(null)
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeholder = role === 'admin'
    ? 'Buscar alumno, profesor, curso o clase...'
    : 'Buscar alumno, curso o clase...'

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => inputRef.current?.focus(), 160)
    return () => clearTimeout(timer)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const normalized = query.trim()
    if (normalized.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: searchError } = await supabase.rpc('search_app_entities', {
          p_query: normalized,
          p_limit: 18,
        })
        if (searchError) throw searchError
        if (!cancelled) {
          setResults((data || []) as SearchResult[])
          void trackUsageEvent('global_search', {
            properties: {
              role,
              query_length: normalized.length,
              result_count: Array.isArray(data) ? data.length : 0,
            },
          })
        }
      } catch (searchError: any) {
        if (!cancelled) {
          setResults([])
          setError(searchError?.message || 'No se pudo realizar la búsqueda.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 280)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, role, visible])

  const groupedResults = useMemo(() => {
    return results.reduce<Record<string, SearchResult[]>>((groups, result) => {
      const key = result.entity_type
      groups[key] = [...(groups[key] || []), result]
      return groups
    }, {})
  }, [results])

  const close = () => {
    setVisible(false)
    setQuery('')
    setResults([])
    setError(null)
  }

  const openResult = (result: SearchResult) => {
    const href = getResultHref(result, role)
    close()
    router.push(href as never)
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Abrir búsqueda global"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          compact ? styles.triggerCompact : styles.triggerWide,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.76 : 1,
          },
        ]}
      >
        <Ionicons name="search-outline" size={compact ? 21 : 18} color={accentColor} />
        {!compact ? <Text style={[styles.triggerLabel, { color: colors.text }]}>Buscar</Text> : null}
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={close}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <Pressable accessibilityLabel="Cerrar búsqueda" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.titleIcon, { backgroundColor: `${accentColor}22` }]}>
                  <Ionicons name="search" size={22} color={accentColor} />
                </View>
                <View style={styles.titleCopy}>
                  <Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>Búsqueda global</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{placeholder}</Text>
                </View>
              </View>
              <Pressable accessibilityLabel="Cerrar búsqueda" accessibilityRole="button" hitSlop={8} onPress={close} style={styles.closeButton}>
                <Ionicons name="close" size={23} color={colors.text} />
              </Pressable>
            </View>

            <View style={[styles.searchInputShell, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <TextInput
                ref={inputRef}
                accessibilityLabel="Texto de búsqueda global"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={[styles.searchInput, { color: colors.text }]}
                value={query}
              />
              {query ? (
                <Pressable accessibilityLabel="Borrar búsqueda" accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.resultsScroll}
              contentContainerStyle={styles.resultsContent}
            >
              {loading ? (
                <View style={styles.stateBox}>
                  <ActivityIndicator color={accentColor} />
                  <Text style={[styles.stateText, { color: colors.textMuted }]}>Buscando...</Text>
                </View>
              ) : error ? (
                <View style={styles.stateBox}>
                  <Ionicons name="warning-outline" size={28} color="#FB7185" />
                  <Text style={[styles.stateText, { color: colors.textMuted }]}>{error}</Text>
                </View>
              ) : query.trim().length < 2 ? (
                <View style={styles.stateBox}>
                  <Ionicons name="sparkles-outline" size={30} color={accentColor} />
                  <Text style={[styles.stateText, { color: colors.textMuted }]}>Escribe al menos dos caracteres para buscar.</Text>
                </View>
              ) : results.length === 0 ? (
                <View style={styles.stateBox}>
                  <Ionicons name="search-outline" size={30} color={colors.textMuted} />
                  <Text style={[styles.stateText, { color: colors.textMuted }]}>No se encontraron resultados.</Text>
                </View>
              ) : (
                (['profile', 'subject', 'classroom'] as const).map((type) => {
                  const typeResults = groupedResults[type] || []
                  if (typeResults.length === 0) return null
                  return (
                    <View key={type} style={styles.group}>
                      <Text style={[styles.groupTitle, { color: colors.textMuted }]}>{getGroupTitle(type)}</Text>
                      <View style={styles.groupRows}>
                        {typeResults.map((result) => (
                          <SearchResultRow key={`${result.entity_type}-${result.entity_id}`} result={result} onPress={() => openResult(result)} />
                        ))}
                      </View>
                    </View>
                  )
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

function SearchResultRow({ result, onPress }: { result: SearchResult; onPress: () => void }) {
  const { colors, accentColor } = useAppTheme()
  const meta = getResultMeta(result)

  return (
    <Pressable
      accessibilityLabel={`${result.title}. ${result.subtitle || meta.label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultRow,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.backgroundAlt,
        },
      ]}
    >
      <View style={[styles.resultIcon, { backgroundColor: `${meta.color}22` }]}>
        <Ionicons name={meta.icon} size={21} color={meta.color} />
      </View>
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={[styles.resultTitle, { color: colors.text }]}>{result.title}</Text>
        <Text numberOfLines={2} style={[styles.resultSubtitle, { color: colors.textMuted }]}>{result.subtitle || meta.label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={accentColor} />
    </Pressable>
  )
}

function getResultHref(result: SearchResult, role: SearchRole) {
  if (role === 'admin') {
    if (result.entity_type === 'profile' && result.role_id === 'teacher') {
      return `/(admin)/teachers?teacherId=${encodeURIComponent(result.entity_id)}`
    }
    if (result.entity_type === 'profile') {
      return `/(admin)/students?profileId=${encodeURIComponent(result.entity_id)}`
    }
    if (result.entity_type === 'subject') {
      return `/(admin)/courses?search=${encodeURIComponent(result.title)}`
    }
    return `/(admin)/classrooms?search=${encodeURIComponent(result.title)}`
  }

  if (result.entity_type === 'profile') {
    return `/(teacher)/student/${encodeURIComponent(result.entity_id)}/history`
  }
  if (result.entity_type === 'subject') {
    return `/(teacher)/subject/${encodeURIComponent(result.entity_id)}`
  }
  if (result.subject_id) {
    return `/(teacher)/subject/${result.subject_id}`
  }
  return '/(teacher)/classes'
}

function getGroupTitle(type: SearchResult['entity_type']) {
  if (type === 'profile') return 'Personas'
  if (type === 'subject') return 'Cursos'
  return 'Clases'
}

function getResultMeta(result: SearchResult): { icon: IconName; color: string; label: string } {
  if (result.entity_type === 'subject') return { icon: 'book', color: '#38BDF8', label: 'Curso' }
  if (result.entity_type === 'classroom') return { icon: 'albums', color: '#F59E0B', label: 'Clase' }
  if (result.role_id === 'teacher') return { icon: 'school', color: '#A78BFA', label: 'Profesor' }
  return { icon: 'person', color: '#34D399', label: 'Alumno' }
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
  },
  triggerCompact: {
    width: 46,
    height: 46,
  },
  triggerWide: {
    height: 46,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 15,
  },
  triggerLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(1, 5, 15, 0.82)',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 72 : 58,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '82%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    ...Platform.select({
      android: { elevation: 24 },
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.36,
        shadowRadius: 30,
      },
      default: { boxShadow: '0 24px 70px rgba(0,0,0,0.48)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitleRow: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCopy: { minWidth: 0, flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  searchInputShell: {
    height: 52,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  searchInput: { minWidth: 0, flex: 1, fontSize: 15, fontWeight: '600', outlineStyle: 'none' } as any,
  resultsScroll: { marginTop: 12 },
  resultsContent: { paddingBottom: 6 },
  stateBox: { minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  stateText: { maxWidth: 390, textAlign: 'center', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  group: { marginTop: 10 },
  groupTitle: { marginBottom: 8, paddingHorizontal: 2, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  groupRows: { gap: 8 },
  resultRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, paddingVertical: 10 },
  resultIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  resultCopy: { minWidth: 0, flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '900' },
  resultSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
})
