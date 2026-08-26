import { Ionicons } from '@expo/vector-icons'
import type { StyleProp, ViewStyle } from 'react-native'
import MobileMetricCard from '../ui/mobile/MobileMetricCard'

export default function StudentMetricCard({
  title,
  value,
  icon,
  color,
  onPress,
  compact,
  dense,
  className = '',
  style,
}: {
  title: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  color?: string
  onPress?: () => void
  compact?: boolean
  dense?: boolean
  className?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <MobileMetricCard
      className={`flex-1 ${className}`}
      color={color || '#8B5CF6'}
      compact={compact}
      dense={dense}
      icon={icon}
      label={title}
      onPress={onPress}
      style={style}
      value={value}
    />
  )
}
