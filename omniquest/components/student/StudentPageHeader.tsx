import RolePageHeader, { type RolePageHeaderProps } from '../ui/RolePageHeader'

export type StudentPageHeaderProps = Omit<RolePageHeaderProps, 'role'>

/** Student-role wrapper around the shared authenticated page header. */
export default function StudentPageHeader(props: StudentPageHeaderProps) {
  return <RolePageHeader role="student" {...props} />
}
