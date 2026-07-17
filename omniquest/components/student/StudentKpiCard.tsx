import { Ionicons } from '@expo/vector-icons'
import MobileMetricCard from '../ui/mobile/MobileMetricCard'

type StudentKpiCardProps = {
  className?: string
  color: string
  detail?: string
  detailColor?: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  value: string
  variant?: 'compact' | 'circle'
}

export default function StudentKpiCard({
  className = '',
  color,
  detail,
  detailColor = '#8FA7C7',
  icon,
  label,
  onPress,
  value,
  variant = 'compact',
}: StudentKpiCardProps) {
  const minWidth = variant === 'circle' ? 'min-w-[170px]' : 'min-w-[175px]'

  return (
    <MobileMetricCard
      className={`${minWidth} flex-1 ${className}`}
      color={color}
      compact={variant === 'compact'}
      detail={detail}
      detailColor={detailColor}
      icon={icon}
      label={label}
      onPress={onPress}
      value={value}
    />
  )
}
