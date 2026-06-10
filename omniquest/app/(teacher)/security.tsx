import React from 'react'
import { UnifiedSettingsScreen } from '../(student)/settings'

export default function TeacherSecurityScreen() {
  return <UnifiedSettingsScreen forcedRole="teacher" securityOnly />
}
