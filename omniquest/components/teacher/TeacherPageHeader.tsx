import RolePageHeader, { type RolePageHeaderProps } from '../ui/RolePageHeader'

export type TeacherPageHeaderProps = Omit<RolePageHeaderProps, 'role'>

/** Teacher-role wrapper around the shared authenticated page header. */
export default function TeacherPageHeader(props: TeacherPageHeaderProps) {
  return <RolePageHeader role="teacher" {...props} />
}
