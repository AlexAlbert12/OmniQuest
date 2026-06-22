import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type StudentStatGridItem = {
  color: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}

type StudentStatGridProps = {
  isDesktop: boolean
  items: StudentStatGridItem[]
}

export default function StudentStatGrid({ isDesktop, items }: StudentStatGridProps) {
  return (
    <View className={isDesktop ? 'flex-row gap-4' : 'flex-row flex-wrap gap-4'}>
      {items.map((item) => (
        <View
          key={item.label}
          className="min-w-[112px] flex-1 items-center justify-center rounded-2xl border border-[#1A3155] bg-[#09162C] px-3 py-5"
        >
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}24` }}>
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <Text className="mt-3 text-center text-[13px] text-[#AFC2DB]">{item.label}</Text>
          <Text className="mt-1 text-[26px] font-black text-white">{item.value}</Text>
        </View>
      ))}
    </View>
  )
}
