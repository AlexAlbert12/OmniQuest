import React from 'react'
import BadgeUnlockModal from '../../gamification/BadgeUnlockModal'
import type { StudentBadge } from '../../../lib/studentBadges'

export default function GameAchievementModal({ badges, onDismiss }: { badges: StudentBadge[]; onDismiss: () => void }) {
  return <BadgeUnlockModal badge={badges[0] || null} visible={badges.length > 0} onClose={onDismiss} />
}
