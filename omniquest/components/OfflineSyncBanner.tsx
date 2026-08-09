import { Ionicons } from '@expo/vector-icons'
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useOfflineSync } from '../hooks/useOfflineSync'

export default function OfflineSyncBanner() {
  const {
    online,
    pending,
    failed,
    conflicts,
    syncing,
    showingCachedData,
    retryNow,
    discardFailures,
  } = useOfflineSync()

  const visible = !online || pending > 0 || failed > 0 || conflicts > 0 || syncing || showingCachedData
  if (!visible) return null

  const hasProblems = failed > 0 || conflicts > 0
  const color = hasProblems ? '#F59E0B' : !online ? '#64748B' : '#2563EB'
  const message = hasProblems
    ? `${failed + conflicts} cambio${failed + conflicts === 1 ? '' : 's'} necesita${failed + conflicts === 1 ? '' : 'n'} revisión`
    : syncing
      ? 'Sincronizando cambios…'
      : !online
        ? `Sin conexión · mostrando datos guardados${pending > 0 ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}`
        : pending > 0
          ? `${pending} cambio${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'} de sincronizar`
          : 'Mostrando una copia local mientras se recupera la conexión'

  const resolve = () => {
    const retry = () => void retryNow()
    const discard = () => void discardFailures()
    if (Platform.OS === 'web') {
      if (window.confirm(`${message}. Pulsa Aceptar para reintentar o Cancelar para descartar los cambios rechazados.`)) retry()
      else discard()
      return
    }
    Alert.alert('Sincronización pendiente', message, [
      { text: 'Descartar rechazados', style: 'destructive', onPress: discard },
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reintentar', onPress: retry },
    ])
  }

  return (
    <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
      <View accessibilityLiveRegion="polite" style={[styles.banner, { borderColor: color }]}> 
        <Ionicons name={hasProblems ? 'warning-outline' : online ? 'sync-outline' : 'cloud-offline-outline'} size={17} color={color} />
        <Text numberOfLines={2} style={styles.message}>{message}</Text>
        {hasProblems || (online && pending > 0) ? (
          <Pressable accessibilityRole="button" onPress={hasProblems ? resolve : () => void retryNow()} style={styles.action}>
            <Text style={[styles.actionText, { color }]}>{hasProblems ? 'Resolver' : 'Sincronizar'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 12, right: 12, bottom: 82, zIndex: 1000, alignItems: 'center' },
  banner: { maxWidth: 720, minHeight: 44, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: 'rgba(5,15,31,0.97)' },
  message: { minWidth: 0, flex: 1, color: '#E5EDF8', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  action: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 6 },
  actionText: { fontSize: 12, fontWeight: '900' },
})
