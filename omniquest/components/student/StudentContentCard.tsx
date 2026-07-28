import { ReactNode } from 'react'
import { Text, View } from 'react-native'

type StudentContentCardProps = {
  children: ReactNode
  className?: string
  subtitle?: string
  title?: string
}

export default function StudentContentCard({
  children,
  className = '',
  subtitle,
  title,
}: StudentContentCardProps) {
  return (
    <View className={`rounded-2xl border border-border-default bg-surface-default p-5 ${className}`}>
      {title ? (
        <View className="mb-4">
          <Text className="text-[15px] font-black text-white">{title}</Text>
          {subtitle ? <Text className="mt-1 text-[12px] text-text-muted">{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  )
}
