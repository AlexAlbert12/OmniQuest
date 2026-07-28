import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import OmniGuide, { type OmniState } from './OmniGuide'
import AppBottomSheet from './ui/AppBottomSheet'
import AppButton from './ui/AppButton'
import { useAppTheme } from '../lib/appTheme'
import { useI18n } from '../lib/i18n'
import type { SemanticColorKey } from '../lib/designTokens'

export type AppConfirmModalVariant = 'danger' | 'info' | 'warning'

export type AppConfirmModalProps = {
  busy?: boolean
  cancelLabel?: string
  confirmLabel: string
  message: string
  omniState?: OmniState
  onCancel: () => void
  onConfirm: () => void
  showOmni?: boolean
  title: string
  variant?: AppConfirmModalVariant
  visible: boolean
}

const variantConfig: Record<AppConfirmModalVariant, {
  semanticKey: SemanticColorKey
  icon: keyof typeof Ionicons.glyphMap
}> = {
  danger: { semanticKey: 'danger', icon: 'warning-outline' },
  info: { semanticKey: 'info', icon: 'bulb-outline' },
  warning: { semanticKey: 'warning', icon: 'alert-circle-outline' },
}

export default function AppConfirmModal({
  busy = false,
  cancelLabel,
  confirmLabel,
  message,
  omniState = 'thinking',
  onCancel,
  onConfirm,
  showOmni = false,
  title,
  variant = 'warning',
  visible,
}: AppConfirmModalProps) {
  const { tokens } = useAppTheme()
  const { t } = useI18n()
  const resolvedCancelLabel = cancelLabel || t('common.cancel')
  const config = variantConfig[variant]
  const color = tokens.semantic[config.semanticKey]
  const surface = tokens.semanticSurface[config.semanticKey]

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onCancel}
      title={title}
      description={message}
      closeOnBackdropPress={!busy}
      contentStyle={styles.content}
      footer={(
        <View style={styles.actions}>
          <AppButton
            label={resolvedCancelLabel}
            variant="secondary"
            disabled={busy}
            onPress={onCancel}
            style={styles.action}
          />
          <AppButton
            label={confirmLabel}
            icon={variant === 'danger' ? 'warning-outline' : 'checkmark-circle-outline'}
            variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'secondary' : 'primary'}
            loading={busy}
            disabled={busy}
            onPress={onConfirm}
            style={styles.action}
          />
        </View>
      )}
    >
      <View style={[styles.summary, { backgroundColor: surface, borderColor: color }]}>
        {showOmni ? (
          <OmniGuide state={omniState} size={64} autoBlink={omniState === 'normal'} />
        ) : (
          <View style={[styles.iconBox, { backgroundColor: tokens.surface.raised }]}>
            <Ionicons name={config.icon} size={28} color={color} />
          </View>
        )}
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, { color }]}>ACCIÓN QUE REQUIERE CONFIRMACIÓN</Text>
          <Text style={[styles.hint, { color: tokens.text.secondary }]}>Revisa la información antes de continuar.</Text>
        </View>
      </View>
    </AppBottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 14,
  },
  summary: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  hint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  action: {
    minWidth: 128,
  },
})
