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
    <View className={`rounded-2xl border border-[#1A3155] bg-[#09162C] p-5 ${className}`}>
      {title ? (
        <View className="mb-4">
          <Text className="text-[15px] font-black text-white">{title}</Text>
          {subtitle ? <Text className="mt-1 text-[12px] text-[#8FA7C7]">{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  )
}
