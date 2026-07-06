import { Ionicons } from '@expo/vector-icons'
import StudentKpiCard from './StudentKpiCard'

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
    <StudentKpiCard
      color={color || '#8B5CF6'}
      icon={icon}
      label={title}
      onPress={onPress}
      value={value}
      variant="circle"
      className={className}
    />
  )
}
