import RolePageHeader, { type RolePageHeaderProps } from '../ui/RolePageHeader'

export type StudentPageHeaderProps = Omit<RolePageHeaderProps, 'role'>

export default function StudentPageHeader(props: StudentPageHeaderProps) {
  return <RolePageHeader role="student" {...props} />
}
