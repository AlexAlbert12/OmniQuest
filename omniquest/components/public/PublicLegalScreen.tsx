import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import BrandLogo from '../BrandLogo'
import { useResponsiveLayout } from '../../lib/responsive'
import { useI18n } from '../../lib/i18n'

type LegalSection = {
  title: string
  paragraphs: string[]
}

export default function PublicLegalScreen({
  icon,
  title,
  subtitle,
  sections,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  sections: LegalSection[]
}) {
  const responsive = useResponsiveLayout()
  const { t } = useI18n()

  return (
    <ScrollView className="flex-1 bg-background-primary" contentContainerStyle={{ flexGrow: 1 }}>
      <View
        className="mx-auto w-full px-5 py-8"
        style={{ maxWidth: responsive.isWide ? 1080 : 860, paddingHorizontal: responsive.horizontalPadding }}
      >
        <View className="flex-row flex-wrap items-center justify-between gap-4">
          <BrandLogo size={42} />
          <Link href="/" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('legal.backHome')}
              accessibilityHint={t('legal.backHomeHint')}
              className="flex-row items-center gap-2 rounded-full border border-border-default bg-surface-default px-4 py-3"
            >
              <Ionicons name="home-outline" size={18} color="#8CD5FF" />
              <Text maxFontSizeMultiplier={2} className="font-extrabold text-text-primary">{t('legal.backHome')}</Text>
            </Pressable>
          </Link>
        </View>

        <View className="mt-8 rounded-[28px] border border-border-default bg-surface-raised p-6">
          <View className="flex-row items-start gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-semantic-surface-info">
              <Ionicons name={icon} size={28} color="#8CD5FF" />
            </View>
            <View className="min-w-0 flex-1">
              <Text maxFontSizeMultiplier={2} className="text-[28px] font-black leading-9 text-text-primary">{title}</Text>
              <Text maxFontSizeMultiplier={2} className="mt-2 text-[14px] leading-6 text-text-secondary">{subtitle}</Text>
            </View>
          </View>
        </View>

        <View className="mt-6 gap-4">
          {sections.map((section) => (
            <View key={section.title} className="rounded-3xl border border-border-default bg-surface-default p-5">
              <Text maxFontSizeMultiplier={2} className="text-[18px] font-black leading-7 text-text-primary">{section.title}</Text>
              <View className="mt-3 gap-3">
                {section.paragraphs.map((paragraph) => (
                  <Text key={paragraph} maxFontSizeMultiplier={2} className="text-[14px] leading-6 text-text-secondary">
                    {paragraph}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
