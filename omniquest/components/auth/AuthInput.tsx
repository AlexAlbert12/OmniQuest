import { Ionicons } from '@expo/vector-icons'
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputProps,
  View,
} from 'react-native'
import { useI18n } from '../../lib/i18n'
import { readCapsLockFromKeyEvent } from '../../lib/capsLock'

type AuthInputProps = TextInputProps & {
  error?: string
  helper?: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onCapsLockChange?: (active: boolean) => void
  onToggleSecureText?: () => void
  secureVisible?: boolean
  showSecureToggle?: boolean
  valid?: boolean
}

export default function AuthInput({
  error,
  helper,
  icon,
  label,
  onCapsLockChange,
  onKeyPress,
  onToggleSecureText,
  secureVisible,
  showSecureToggle,
  valid = false,
  style,
  ...inputProps
}: AuthInputProps) {
  const { t } = useI18n()
  const borderColor = error ? '#FB7185' : valid ? '#34D399' : 'rgba(148, 163, 184, 0.18)'
  const iconColor = error ? '#FDA4AF' : valid ? '#6EE7B7' : '#8CD5FF'

  const handleKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    onKeyPress?.(event)
    if (Platform.OS !== 'web' || !onCapsLockChange) return
    const capsLock = readCapsLockFromKeyEvent(event)
    if (capsLock !== null) onCapsLockChange(capsLock)
  }

  const secureToggleLabel = secureVisible ? t('auth.password.hide') : t('auth.password.show')

  return (
    <View style={{ gap: 8 }}>
      <Text maxFontSizeMultiplier={2} className="ml-1 text-[13px] font-extrabold text-text-secondary">{label}</Text>
      <View
        className="flex-row items-center border"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor,
          borderRadius: 20,
          minHeight: 58,
        }}
      >
        <View
          className="ml-3 items-center justify-center"
          style={{
            backgroundColor: error
              ? 'rgba(251, 113, 133, 0.13)'
              : valid
                ? 'rgba(52, 211, 153, 0.12)'
                : 'rgba(66, 185, 255, 0.10)',
            borderRadius: 14,
            height: 40,
            width: 40,
          }}
        >
          <Ionicons name={valid ? 'checkmark-circle' : icon} size={20} color={iconColor} />
        </View>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error || helper}
          className="flex-1 px-3 py-4 text-[15px] font-semibold text-text-primary"
          maxFontSizeMultiplier={2}
          onKeyPress={handleKeyPress}
          placeholderTextColor="#93A8C8"
          style={style}
          {...inputProps}
        />
        {showSecureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secureToggleLabel}
            accessibilityHint={t('auth.password.toggleHint')}
            accessibilityState={{ selected: Boolean(secureVisible) }}
            onPress={onToggleSecureText}
            focusable
            className="mr-1 items-center justify-center rounded-full"
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(148, 163, 184, 0.10)' : 'transparent',
              height: 44,
              opacity: pressed ? 0.72 : 1,
              width: 44,
            })}
          >
            <Ionicons
              name={secureVisible ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#AEBBDD"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View accessible accessibilityRole="alert" className="ml-1 flex-row items-start gap-1.5">
          <Ionicons name="alert-circle" size={14} color="#FDA4AF" />
          <Text maxFontSizeMultiplier={2} className="min-w-0 flex-1 text-[12px] font-semibold text-semantic-danger">{error}</Text>
        </View>
      ) : helper ? (
        <Text maxFontSizeMultiplier={2} className="ml-1 text-[12px] font-semibold text-text-muted">{helper}</Text>
      ) : null}
    </View>
  )
}
