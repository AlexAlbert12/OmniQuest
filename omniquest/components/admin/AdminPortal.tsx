import React from 'react'
import AdminPortalCore from './portal/AdminPortalCore'
export function AdminHomeScreen() { return <AdminPortalCore section="home" /> }
export function AdminTeachersScreen() { return <AdminPortalCore section="teachers" /> }
export function AdminStudentsScreen() { return <AdminPortalCore section="students" /> }
export function AdminCoursesScreen() { return <AdminPortalCore section="courses" /> }
export function AdminClassroomsScreen() { return <AdminPortalCore section="classrooms" /> }
export function AdminSupportScreen() { return <AdminPortalCore section="support" /> }
export function AdminAuditScreen() { return <AdminPortalCore section="audit" /> }
export { AdminDashboard } from './dashboard/AdminDashboard'
export { AdminTeachersSection } from './users/AdminTeachersSection'
export { AdminStudentsSection } from './users/AdminStudentsSection'
export { AdminCoursesSection } from './courses/AdminCoursesSection'
export { AdminClassroomsSection } from './classrooms/AdminClassroomsSection'
export { AdminSupportSection } from './support/AdminSupportSection'
export { AdminAuditSection } from './audit/AdminAuditSection'
export { default as AdminProfileActivityScreen } from './users/AdminProfileActivityScreen'
