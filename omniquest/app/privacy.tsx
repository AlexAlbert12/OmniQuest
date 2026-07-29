import PublicLegalScreen from '../components/public/PublicLegalScreen'
import { useI18n } from '../lib/i18n'

export default function PrivacyScreen() {
  const { t } = useI18n()
  return (
    <PublicLegalScreen
      icon="shield-checkmark-outline"
      title={t('privacy.title')}
      subtitle={t('privacy.subtitle')}
      sections={[
        { title: t('privacy.section.data.title'), paragraphs: [t('privacy.section.data.body')] },
        { title: t('privacy.section.analytics.title'), paragraphs: [t('privacy.section.analytics.body')] },
        { title: t('privacy.section.guest.title'), paragraphs: [t('privacy.section.guest.body')] },
        { title: t('privacy.section.security.title'), paragraphs: [t('privacy.section.security.body')] },
        { title: t('privacy.section.rights.title'), paragraphs: [t('privacy.section.rights.body')] },
      ]}
    />
  )
}
