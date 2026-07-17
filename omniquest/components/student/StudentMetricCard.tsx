import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../ui/mobile/MobileMetricCard'

export default function StudentMetricCard({
  title,
  value,
  icon,
  color,
  onPress,
  className = '',
}: {
  title: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  color?: string
  onPress?: () => void
  className?: string
}) {
  return (
    <MobileMetricCard
      className={`min-w-[170px] flex-1 ${className}`}
      color={color || '#8B5CF6'}
      icon={icon}
      label={title}
      onPress={onPress}
      value={value}
    />
  )
}
