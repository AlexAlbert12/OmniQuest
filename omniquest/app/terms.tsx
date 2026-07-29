import PublicLegalScreen from '../components/public/PublicLegalScreen'
import { useI18n } from '../lib/i18n'

export default function TermsScreen() {
  const { t } = useI18n()
  return (
    <PublicLegalScreen
      icon="document-text-outline"
      title={t('terms.title')}
      subtitle={t('terms.subtitle')}
      sections={[
        { title: t('terms.section.access.title'), paragraphs: [t('terms.section.access.body')] },
        { title: t('terms.section.roles.title'), paragraphs: [t('terms.section.roles.body')] },
        { title: t('terms.section.guest.title'), paragraphs: [t('terms.section.guest.body')] },
        { title: t('terms.section.conduct.title'), paragraphs: [t('terms.section.conduct.body')] },
        { title: t('terms.section.availability.title'), paragraphs: [t('terms.section.availability.body')] },
      ]}
    />
  )
}
