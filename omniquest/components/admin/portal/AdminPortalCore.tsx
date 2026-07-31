import React from 'react'
import type { AdminSection } from '../types/admin'
import { AdminDashboard } from '../dashboard/AdminDashboard'
import { AdminTeachersSection } from '../users/AdminTeachersSection'
import { AdminStudentsSection } from '../users/AdminStudentsSection'
import { AdminCoursesSection } from '../courses/AdminCoursesSection'
import { AdminClassroomsSection } from '../classrooms/AdminClassroomsSection'
import { AdminAuditSection } from '../audit/AdminAuditSection'
import { AdminSupportSection } from '../support/AdminSupportSection'

/**
 * Route coordinator only. Feature data, actions, types and visual sections live
 * in their respective admin modules rather than in this navigation boundary.
 */
export default function AdminPortalCore({ section }: { section: AdminSection }) {
  if (section === 'teachers') return <AdminTeachersSection />
  if (section === 'students') return <AdminStudentsSection />
  if (section === 'courses') return <AdminCoursesSection />
  if (section === 'classrooms') return <AdminClassroomsSection />
  if (section === 'audit') return <AdminAuditSection />
  if (section === 'support') return <AdminSupportSection />
  return <AdminDashboard />
}
