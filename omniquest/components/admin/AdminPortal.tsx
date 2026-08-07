import React from 'react'
import type { AdminSection } from './types/admin'
import { AdminDashboard } from './dashboard/AdminDashboard'
import { AdminTeachersSection } from './users/AdminTeachersSection'
import { AdminStudentsSection } from './users/AdminStudentsSection'
import { AdminCoursesSection } from './courses/AdminCoursesSection'
import { AdminClassroomsSection } from './classrooms/AdminClassroomsSection'
import { AdminAuditSection } from './audit/AdminAuditSection'
import { AdminSupportSection } from './support/AdminSupportSection'
import AdminProfileActivityScreen from './users/AdminProfileActivityScreen'

function AdminPortalSection({ section }: { section: AdminSection }) {
  if (section === 'teachers') return <AdminTeachersSection />
  if (section === 'students') return <AdminStudentsSection />
  if (section === 'courses') return <AdminCoursesSection />
  if (section === 'classrooms') return <AdminClassroomsSection />
  if (section === 'audit') return <AdminAuditSection />
  if (section === 'support') return <AdminSupportSection />
  return <AdminDashboard />
}

export function AdminHomeScreen() { return <AdminPortalSection section="home" /> }
export function AdminTeachersScreen() { return <AdminPortalSection section="teachers" /> }
export function AdminStudentsScreen() { return <AdminPortalSection section="students" /> }
export function AdminCoursesScreen() { return <AdminPortalSection section="courses" /> }
export function AdminClassroomsScreen() { return <AdminPortalSection section="classrooms" /> }
export function AdminSupportScreen() { return <AdminPortalSection section="support" /> }
export function AdminAuditScreen() { return <AdminPortalSection section="audit" /> }

export {
  AdminAuditSection,
  AdminClassroomsSection,
  AdminCoursesSection,
  AdminDashboard,
  AdminProfileActivityScreen,
  AdminStudentsSection,
  AdminSupportSection,
  AdminTeachersSection,
}
