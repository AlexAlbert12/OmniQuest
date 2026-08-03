import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, type Href } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { trackUsageEvent } from '../../lib/analytics'
import { useAppTheme } from '../../lib/appTheme'
import { getErrorMessage } from '../../lib/typeGuards'

type SearchRole = 'admin' | 'teacher'
type IconName = keyof typeof Ionicons.glyphMap
type SearchResult = { entity_type: 'profile' | 'subject' | 'classroom'; entity_id: string; title: string; subtitle: string | null; role_id: string | null; subject_id: number | null; classroom_id: number | null; relevance: number; total_count?: number | null }
type GlobalSearchButtonProps = { role: SearchRole; compact?: boolean }
type KeyboardShortcutEvent = { ctrlKey?: boolean; metaKey?: boolean; key?: string; preventDefault?: () => void }
type KeyboardShortcutTarget = {
  addEventListener?: (type: 'keydown', listener: (event: KeyboardShortcutEvent) => void) => void
  removeEventListener?: (type: 'keydown', listener: (event: KeyboardShortcutEvent) => void) => void
}

const PAGE_SIZE = 18
const MAX_RECENT_SEARCHES = 6

export default function GlobalSearchButton({ role, compact = false }: GlobalSearchButtonProps) {
  const router = useRouter()
  const { colors, accentColor } = useAppTheme()
  const inputRef = useRef<TextInput>(null)
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const storageKey = `omniquest:global-search:${role}`
  const placeholder = role === 'admin' ? 'Buscar alumno, profesor, curso o clase...' : 'Buscar alumno, curso o clase...'
  const normalizedQuery = query.trim()
  const shortcutLabel = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'

  useEffect(() => { void AsyncStorage.getItem(storageKey).then((value) => { const parsed = value ? JSON.parse(value) : []; setRecentSearches(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES) : []) }).catch(() => setRecentSearches([])) }, [storageKey])
  useEffect(() => { if (!visible) return; const timer = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(timer) }, [visible])
  useEffect(() => { setOffset(0); setResults([]); setTotal(0); setError(null) }, [normalizedQuery, visible])
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const target = globalThis as unknown as KeyboardShortcutTarget
    const handler = (event: KeyboardShortcutEvent) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') { event.preventDefault?.(); setVisible(true) }
      if (event.key === 'Escape') setVisible(false)
    }
    target.addEventListener?.('keydown', handler)
    return () => target.removeEventListener?.('keydown', handler)
  }, [])

  useEffect(() => {
    if (!visible || normalizedQuery.length < 2) { setLoading(false); setLoadingMore(false); return }
    let cancelled = false
    const timer = setTimeout(async () => {
      offset === 0 ? setLoading(true) : setLoadingMore(true)
      setError(null)
      try {
        const { data, error: searchError } = await supabase.rpc('search_app_entities', { p_query: normalizedQuery, p_limit: PAGE_SIZE, p_offset: offset })
        if (searchError) throw searchError
        if (cancelled) return
        const page = (data || []) as SearchResult[]
        setResults((current) => offset === 0 ? page : dedupeResults([...current, ...page]))
        setTotal(Number(page[0]?.total_count || (offset === 0 ? page.length : offset + page.length)))
        void trackUsageEvent('global_search', { properties: { role, query_length: normalizedQuery.length, result_count: page.length, offset } })
      } catch (searchError: unknown) {
        if (!cancelled) { if (offset === 0) setResults([]); setError(getErrorMessage(searchError, 'No se pudo realizar la búsqueda.')) }
      } finally { if (!cancelled) { setLoading(false); setLoadingMore(false) } }
    }, offset === 0 ? 280 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [normalizedQuery, offset, role, visible])

  const groupedResults = useMemo(() => results.reduce<Record<string, SearchResult[]>>((groups, result) => { groups[result.entity_type] = [...(groups[result.entity_type] || []), result]; return groups }, {}), [results])
  const close = useCallback(() => { setVisible(false); setQuery(''); setResults([]); setOffset(0); setTotal(0); setError(null) }, [])
  const rememberSearch = useCallback(async (value: string) => { const updated = [value, ...recentSearches.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, MAX_RECENT_SEARCHES); setRecentSearches(updated); await AsyncStorage.setItem(storageKey, JSON.stringify(updated)) }, [recentSearches, storageKey])
  const clearRecent = useCallback(async () => { setRecentSearches([]); await AsyncStorage.removeItem(storageKey) }, [storageKey])
  const openResult = useCallback((result: SearchResult) => {
    const href = getSafeResultHref(result, role)
    if (!href) { setError('Este resultado no contiene un destino válido.'); return }
    void rememberSearch(normalizedQuery)
    close(); router.push(href as Href)
  }, [close, normalizedQuery, rememberSearch, role, router])

  return <>
    <Pressable accessibilityLabel="Abrir búsqueda global" accessibilityRole="button" accessibilityHint={Platform.OS === 'web' ? 'También puedes usar Control o Comando más K' : undefined} hitSlop={8} onPress={() => setVisible(true)} style={({ pressed }) => [styles.trigger, compact ? styles.triggerCompact : styles.triggerWide, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.76 : 1 }]}>
      <Ionicons name="search-outline" size={compact ? 21 : 18} color={accentColor} />{!compact ? <><Text style={[styles.triggerLabel, { color: colors.text }]}>Buscar</Text>{Platform.OS === 'web' ? <Text style={[styles.shortcut, { color: colors.textMuted, borderColor: colors.border }]}>{shortcutLabel}</Text> : null}</> : null}
    </Pressable>

    <Modal animationType="fade" onRequestClose={close} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}>
      <View style={styles.overlay}><Pressable accessibilityLabel="Cerrar búsqueda" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
        <View style={[styles.modalCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <View style={styles.modalHeader}><View style={styles.modalTitleRow}><View style={[styles.titleIcon, { backgroundColor: `${accentColor}22` }]}><Ionicons name="search" size={22} color={accentColor} /></View><View style={styles.titleCopy}><Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>Búsqueda global</Text><Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{placeholder}</Text></View></View><Pressable accessibilityLabel="Cerrar búsqueda" accessibilityRole="button" hitSlop={8} onPress={close} style={styles.closeButton}><Ionicons name="close" size={23} color={colors.text} /></Pressable></View>
          <View style={[styles.searchInputShell, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}><Ionicons name="search-outline" size={20} color={colors.textMuted} /><TextInput ref={inputRef} accessibilityLabel="Texto de búsqueda global" autoCapitalize="none" autoCorrect={false} onChangeText={setQuery} placeholder={placeholder} placeholderTextColor={colors.textMuted} returnKeyType="search" style={[styles.searchInput, { color: colors.text }]} value={query} />{query ? <Pressable accessibilityLabel="Borrar búsqueda" accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></Pressable> : null}</View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
            {loading ? <StateBox icon="search" text="Buscando..." loading /> : error ? <StateBox icon="warning-outline" text={error} danger /> : normalizedQuery.length < 2 ? recentSearches.length > 0 ? <View style={styles.group}><View style={styles.recentHeader}><Text style={[styles.groupTitle, { color: colors.textMuted }]}>Búsquedas recientes</Text><Pressable onPress={() => void clearRecent()}><Text style={[styles.clearRecent, { color: accentColor }]}>Borrar</Text></Pressable></View><View style={styles.recentList}>{recentSearches.map((item) => <Pressable key={item} onPress={() => setQuery(item)} style={[styles.recentChip, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}><Ionicons name="time-outline" size={15} color={colors.textMuted} /><Text style={[styles.recentText, { color: colors.text }]} numberOfLines={1}>{item}</Text></Pressable>)}</View></View> : <StateBox icon="sparkles-outline" text="Escribe al menos dos caracteres para buscar." /> : results.length === 0 ? <StateBox icon="search-outline" text="No se encontraron resultados." /> : <>{(['profile', 'subject', 'classroom'] as const).map((type) => { const typeResults = groupedResults[type] || []; if (typeResults.length === 0) return null; return <View key={type} style={styles.group}><Text style={[styles.groupTitle, { color: colors.textMuted }]}>{getGroupTitle(type)}</Text><View style={styles.groupRows}>{typeResults.map((result) => <SearchResultRow key={`${result.entity_type}-${result.entity_id}`} query={normalizedQuery} result={result} onSelect={openResult} />)}</View></View> })}{results.length < total ? <Pressable disabled={loadingMore} onPress={() => setOffset((value) => value + PAGE_SIZE)} style={[styles.loadMore, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>{loadingMore ? <ActivityIndicator color={accentColor} /> : <Ionicons name="add-circle-outline" size={18} color={accentColor} />}<Text style={[styles.loadMoreText, { color: colors.text }]}>{loadingMore ? 'Cargando...' : `Cargar más · ${results.length} de ${total}`}</Text></Pressable> : null}</>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>
}

function StateBox({ icon, text, loading, danger }: { icon: IconName; text: string; loading?: boolean; danger?: boolean }) { const { colors, accentColor } = useAppTheme(); return <View style={styles.stateBox}>{loading ? <ActivityIndicator color={accentColor} /> : <Ionicons name={icon} size={30} color={danger ? '#FB7185' : accentColor} />}<Text style={[styles.stateText, { color: colors.textMuted }]}>{text}</Text></View> }
const SearchResultRow = React.memo(function SearchResultRow({ result, onSelect, query }: { result: SearchResult; onSelect: (result: SearchResult) => void; query: string }) { const { colors, accentColor } = useAppTheme(); const meta = getResultMeta(result); const handlePress = useCallback(() => onSelect(result), [onSelect, result]); return <Pressable accessibilityLabel={`${result.title}. ${result.subtitle || meta.label}`} accessibilityRole="button" onPress={handlePress} style={({ pressed }) => [styles.resultRow, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.backgroundAlt }]}><View style={[styles.resultIcon, { backgroundColor: `${meta.color}22` }]}><Ionicons name={meta.icon} size={21} color={meta.color} /></View><View style={styles.resultCopy}><HighlightedText value={result.title} query={query} baseStyle={[styles.resultTitle, { color: colors.text }]} highlightColor={accentColor} numberOfLines={1} /><HighlightedText value={result.subtitle || meta.label} query={query} baseStyle={[styles.resultSubtitle, { color: colors.textMuted }]} highlightColor={accentColor} numberOfLines={2} /></View><Ionicons name="chevron-forward" size={18} color={accentColor} /></Pressable> })
function HighlightedText({ value, query, baseStyle, highlightColor, numberOfLines }: { value: string; query: string; baseStyle: StyleProp<TextStyle>; highlightColor: string; numberOfLines: number }) { const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1); if (terms.length === 0) return <Text numberOfLines={numberOfLines} style={baseStyle}>{value}</Text>; const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig'); return <Text numberOfLines={numberOfLines} style={baseStyle}>{value.split(pattern).map((part, index) => terms.includes(part.toLowerCase()) ? <Text key={`${part}-${index}`} style={{ color: highlightColor, fontWeight: '900' }}>{part}</Text> : part)}</Text> }
function dedupeResults(rows: SearchResult[]) { const seen = new Set<string>(); return rows.filter((row) => { const key = `${row.entity_type}:${row.entity_id}`; if (seen.has(key)) return false; seen.add(key); return true }) }
function getSafeResultHref(result: SearchResult, role: SearchRole) {
  const entityId = result.entity_id.trim(); if (!entityId) return null
  if (role === 'admin') {
    if (result.entity_type === 'profile') { if (!isUuid(entityId)) return null; return result.role_id === 'teacher' ? `/(admin)/teachers?teacherId=${encodeURIComponent(entityId)}` : `/(admin)/students?profileId=${encodeURIComponent(entityId)}` }
    if (result.entity_type === 'subject') { const id = positiveInteger(entityId); return id ? `/(admin)/courses?subjectId=${id}&search=${encodeURIComponent(result.title)}` : null }
    const id = positiveInteger(entityId); return id ? `/(admin)/classrooms?classroomId=${id}&search=${encodeURIComponent(result.title)}` : null
  }
  if (result.entity_type === 'profile') return isUuid(entityId) ? `/(teacher)/student/${encodeURIComponent(entityId)}/history` : null
  if (result.entity_type === 'subject') { const id = positiveInteger(entityId); return id ? `/(teacher)/subject/${id}` : null }
  const subjectId = positiveInteger(String(result.subject_id || '')); return subjectId ? `/(teacher)/subject/${subjectId}` : '/(teacher)/classes'
}
function positiveInteger(value: string) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function getGroupTitle(type: SearchResult['entity_type']) { if (type === 'profile') return 'Personas'; if (type === 'subject') return 'Cursos'; return 'Clases' }
function getResultMeta(result: SearchResult): { icon: IconName; color: string; label: string } { if (result.entity_type === 'subject') return { icon: 'book', color: '#38BDF8', label: 'Curso' }; if (result.entity_type === 'classroom') return { icon: 'albums', color: '#F59E0B', label: 'Clase' }; if (result.role_id === 'teacher') return { icon: 'school', color: '#A78BFA', label: 'Profesor' }; return { icon: 'person', color: '#34D399', label: 'Alumno' } }

const styles = StyleSheet.create({
  trigger: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14 }, triggerCompact: { width: 46, height: 46 }, triggerWide: { height: 46, flexDirection: 'row', gap: 8, paddingHorizontal: 15 }, triggerLabel: { fontSize: 13, fontWeight: '800' }, shortcut: { marginLeft: 4, borderWidth: 1, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, fontWeight: '900' }, overlay: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', backgroundColor: 'rgba(1, 5, 15, 0.82)', paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 72 : 58 }, modalCard: { width: '100%', maxWidth: 720, maxHeight: '82%', borderWidth: 1, borderRadius: 24, padding: 18, ...Platform.select({ android: { elevation: 24 }, ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.36, shadowRadius: 30 }, default: { boxShadow: '0 24px 70px rgba(0,0,0,0.48)' } }) }, modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, modalTitleRow: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, titleIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, titleCopy: { minWidth: 0, flex: 1 }, modalTitle: { fontSize: 20, fontWeight: '900' }, modalSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 }, closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, searchInputShell: { height: 52, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 }, searchInput: { minWidth: 0, flex: 1, fontSize: 15, fontWeight: '600' }, resultsScroll: { marginTop: 12 }, resultsContent: { paddingBottom: 6 }, stateBox: { minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 }, stateText: { maxWidth: 390, textAlign: 'center', fontSize: 13, lineHeight: 20, fontWeight: '600' }, group: { marginTop: 10 }, groupTitle: { marginBottom: 8, paddingHorizontal: 2, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 }, groupRows: { gap: 8 }, resultRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, paddingVertical: 10 }, resultIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, resultCopy: { minWidth: 0, flex: 1 }, resultTitle: { fontSize: 14, fontWeight: '900' }, resultSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 }, recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, clearRecent: { fontSize: 11, fontWeight: '900' }, recentList: { gap: 8 }, recentChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13 }, recentText: { minWidth: 0, flex: 1, fontSize: 13, fontWeight: '700' }, loadMore: { minHeight: 48, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 15 }, loadMoreText: { fontSize: 12, fontWeight: '900' },
})
