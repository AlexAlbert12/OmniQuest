import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native'

type AuthInputProps = TextInputProps & {
  error?: string
  helper?: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onToggleSecureText?: () => void
  secureVisible?: boolean
  showSecureToggle?: boolean
}

export default function AuthInput({
  error,
  helper,
  icon,
  label,
  onToggleSecureText,
  secureVisible,
  showSecureToggle,
  style,
  ...inputProps
}: AuthInputProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text className="ml-1 text-[13px] font-bold text-[#D9EEFF]">{label}</Text>
      <View
        className="flex-row items-center rounded-lg border bg-[#0B2145]"
        style={{ borderColor: error ? '#F87171' : '#35557C' }}
      >
        <Ionicons className="ml-4 mr-4" name={icon} size={18} color={error ? '#FCA5A5' : '#8AAED0'} />
        <TextInput
          className="flex-1 px-3 py-4 text-[15px] text-[#F5FBFF]"
          placeholderTextColor="#8AAED0"
          style={style}
          {...inputProps}
        />
        {showSecureToggle ? (
          <Pressable
            onPress={onToggleSecureText}
            className="mr-3 items-center justify-center rounded-full p-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <Ionicons
              name={secureVisible ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color="#9FC7E2"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="ml-1 text-[12px] font-semibold text-[#FCA5A5]">{error}</Text>
      ) : helper ? (
        <Text className="ml-1 text-[12px] text-[#9FC7E2]">{helper}</Text>
      ) : null}
    </View>
  )
}
