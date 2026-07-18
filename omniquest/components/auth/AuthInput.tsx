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
      <Text className="ml-1 text-[13px] font-extrabold text-[#DDE8FF]">{label}</Text>
      <View
        className="flex-row items-center border"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.045)',
          borderColor: error ? '#F87171' : 'rgba(148, 163, 184, 0.14)',
          borderRadius: 22,
          minHeight: 62,
        }}
      >
        <View
          className="ml-3 items-center justify-center"
          style={{
            backgroundColor: error ? 'rgba(248, 113, 113, 0.12)' : 'rgba(66, 185, 255, 0.10)',
            borderRadius: 15,
            height: 42,
            width: 42,
          }}
        >
          <Ionicons name={icon} size={20} color={error ? '#FCA5A5' : '#8CD5FF'} />
        </View>
        <TextInput
          className="flex-1 px-3 py-4 text-[15px] font-semibold text-[#F5FBFF]"
          placeholderTextColor="#93A8C8"
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
              size={20}
              color="#AEBBDD"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="ml-1 text-[12px] font-semibold text-[#FCA5A5]">{error}</Text>
      ) : helper ? (
        <Text className="ml-1 text-[12px] font-semibold text-[#AEBBDD]">{helper}</Text>
      ) : null}
    </View>
  )
}