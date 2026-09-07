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
          className="min-w-[112px] flex-1 items-center justify-center rounded-2xl border border-border-default bg-surface-default px-3 py-3"
        >
          <View className="w-full flex-row items-center justify-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}24` }}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            {isDesktop ? <Text className="min-w-0 text-center text-[13px] font-bold text-text-secondary" numberOfLines={1}>{item.label}</Text> : null}
            <Text className={`${isDesktop ? '' : 'flex-1'} min-w-0 text-center text-[26px] font-black text-white`} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
          </View>
          {!isDesktop ? <Text className="mt-1.5 text-center text-[13px] text-text-secondary">{item.label}</Text> : null}
        </View>
      ))}
    </View>
  )
}
