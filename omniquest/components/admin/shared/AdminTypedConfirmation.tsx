import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AppButton from '../../ui/AppButton'
import AppPressable from '../../ui/AppPressable'
import { useAppTheme } from '../../../lib/appTheme'

export type AdminTypedConfirmationOptions = {
  title: string
  message: string
  confirmationText: string
  confirmLabel: string
  destructive?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}

export type AdminConfirmationRequester = (options: AdminTypedConfirmationOptions) => Promise<boolean>

type ConfirmationState = AdminTypedConfirmationOptions & { visible: boolean }

const EMPTY_STATE: ConfirmationState = {
  visible: false,
  title: '',
  message: '',
  confirmationText: '',
  confirmLabel: '',
  destructive: true,
  icon: 'warning-outline',
}

export function useAdminTypedConfirmation() {
  const [state, setState] = useState<ConfirmationState>(EMPTY_STATE)
  const [typedValue, setTypedValue] = useState('')
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed)
    resolverRef.current = null
    setTypedValue('')
    setState(EMPTY_STATE)
  }, [])

  const request = useCallback<AdminConfirmationRequester>((options) => {
    resolverRef.current?.(false)
    setTypedValue('')
    setState({ ...options, visible: true })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  useEffect(() => () => resolverRef.current?.(false), [])

  const modal = (
    <AdminTypedConfirmationModal
      state={state}
      typedValue={typedValue}
      onChangeTypedValue={setTypedValue}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  )

  return { request, modal }
}

function AdminTypedConfirmationModal({
  state,
  typedValue,
  onChangeTypedValue,
  onCancel,
  onConfirm,
}: {
  state: ConfirmationState
  typedValue: string
  onChangeTypedValue: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const { tokens } = useAppTheme()
  const expected = state.confirmationText.trim().toUpperCase()
  const matches = typedValue.trim().toUpperCase() === expected
  const dangerColor = state.destructive === false ? tokens.semantic.warning : tokens.semantic.danger

  return (
    <Modal visible={state.visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <AppPressable accessibilityLabel="Cerrar confirmación" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              backgroundColor: tokens.background.primary,
              borderColor: dangerColor,
            },
          ]}
        >
          <ScrollView
            style={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: `${dangerColor}22` }]}>
              <Ionicons name={state.icon || 'warning-outline'} size={27} color={dangerColor} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: dangerColor }]}>CONFIRMACIÓN SENSIBLE</Text>
              <Text style={[styles.title, { color: tokens.text.primary }]}>{state.title}</Text>
            </View>
            <AppButton accessibilityLabel="Cerrar" icon="close" iconOnly size="sm" variant="ghost" onPress={onCancel} />
          </View>

          <Text style={[styles.message, { color: tokens.text.secondary }]}>{state.message}</Text>

          <View style={[styles.instruction, { backgroundColor: tokens.surface.raised, borderColor: tokens.border.default }]}>
            <Ionicons name="keypad-outline" size={18} color={tokens.text.secondary} />
            <Text style={[styles.instructionText, { color: tokens.text.secondary }]}>Escribe </Text>
            <Text style={[styles.code, { color: dangerColor }]}>{expected}</Text>
            <Text style={[styles.instructionText, { color: tokens.text.secondary }]}> para continuar.</Text>
          </View>

          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={`Escribe ${expected} para confirmar`}
            value={typedValue}
            onChangeText={onChangeTypedValue}
            placeholder={expected}
            placeholderTextColor={tokens.text.muted}
            style={[
              styles.input,
              {
                color: tokens.text.primary,
                backgroundColor: tokens.surface.interactive,
                borderColor: matches ? tokens.semantic.success : tokens.border.default,
              },
            ]}
          />

          <View style={styles.actions}>
            <AppButton label="Cancelar" variant="secondary" onPress={onCancel} />
            <AppButton
              label={state.confirmLabel}
              icon={state.destructive === false ? 'checkmark-circle-outline' : 'warning-outline'}
              variant={state.destructive === false ? 'secondary' : 'danger'}
              disabled={!matches}
              onPress={onConfirm}
            />
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(1, 5, 15, 0.86)',
  },
  card: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  scrollContent: {
    minHeight: 0,
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    minWidth: 0,
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 3,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  message: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 21,
  },
  instruction: {
    marginTop: 18,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  code: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  input: {
    marginTop: 14,
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
})
